import { Effect } from "effect";
import type { ClaimSpec, Observation, WitnessRoleId } from "../domain.js";
import {
  type HarnessEvent,
  type HarnessEventBase,
  assertValidHarnessEventOrder
} from "./harness-events.js";
import { workReceiptFromObservation } from "./economy.js";
import { createGossipStore } from "./gossip.js";
import { reduceOracle } from "./oracle.js";

export interface HarnessWitnessRunner {
  readonly nodeId: string;
  readonly witnessRole: WitnessRoleId;
  readonly observe: (input: { readonly claim: ClaimSpec; readonly runId: string }) => Promise<Observation>;
}

export interface HarnessRunEngineOptions {
  readonly runId: string;
  readonly claims: ReadonlyArray<ClaimSpec>;
  readonly witness: HarnessWitnessRunner;
  readonly now?: () => string;
  readonly payoutPerObservationAtomic?: string;
  readonly sponsorAccountId?: string;
  readonly sponsorBudgetAtomic?: string;
}

const defaultPayoutAtomic = "1000000";
const defaultSponsorAccountId = "sponsor:local";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const collectHarnessRunEvents = async (
  options: HarnessRunEngineOptions
): Promise<ReadonlyArray<HarnessEvent>> => {
  const now = options.now ?? (() => new Date().toISOString());
  const payoutAtomic = options.payoutPerObservationAtomic ?? defaultPayoutAtomic;
  const sponsorAccountId = options.sponsorAccountId ?? defaultSponsorAccountId;
  const sponsorBudget = options.sponsorBudgetAtomic !== undefined
    ? BigInt(options.sponsorBudgetAtomic)
    : BigInt(payoutAtomic) * BigInt(options.claims.length);
  const gossip = createGossipStore();
  const events: HarnessEvent[] = [];
  let eventCount = 0;
  let totalPayout = 0n;
  let observationCount = 0;
  let witnessBalance = 0n;
  let sponsorBalance = sponsorBudget;

  const base = (type: HarnessEvent["type"]): HarnessEventBase => {
    eventCount += 1;
    return {
      type,
      eventId: `evt:${options.runId}:${eventCount}`,
      runId: options.runId,
      emittedAt: now()
    };
  };

  events.push({
    ...base("run_started"),
    type: "run_started",
    claimCount: options.claims.length
  });
  events.push({
    ...base("balance_changed"),
    type: "balance_changed",
    accountId: sponsorAccountId,
    asset: "OUSD",
    deltaAtomic: sponsorBudget.toString(),
    balanceAtomic: sponsorBalance.toString(),
    reason: "sponsor_funded"
  });

  try {
    for (const claim of options.claims) {
      events.push({
        ...base("claim_loaded"),
        type: "claim_loaded",
        claim
      });
      events.push({
        ...base("witness_started"),
        type: "witness_started",
        claimId: claim.id,
        nodeId: options.witness.nodeId,
        witnessRole: options.witness.witnessRole
      });

      const callId = `call:${claim.id}:${options.witness.nodeId}:observe`;
      events.push({
        ...base("tool_call_started"),
        type: "tool_call_started",
        claimId: claim.id,
        nodeId: options.witness.nodeId,
        callId,
        toolName: "witness.observe"
      });

      let observation: Observation;
      try {
        observation = await options.witness.observe({ claim, runId: options.runId });
      } catch (error) {
        events.push({
          ...base("tool_call_finished"),
          type: "tool_call_finished",
          claimId: claim.id,
          nodeId: options.witness.nodeId,
          callId,
          toolName: "witness.observe",
          ok: false,
          error: errorMessage(error)
        });
        throw error;
      }

      events.push({
        ...base("tool_call_finished"),
        type: "tool_call_finished",
        claimId: claim.id,
        nodeId: options.witness.nodeId,
        callId,
        toolName: "witness.observe",
        ok: true,
        outputSummary: `signed observation ${observation.signature}`
      });
      events.push({
        ...base("observation_signed"),
        type: "observation_signed",
        claimId: observation.claimId,
        nodeId: observation.nodeId,
        signature: observation.signature,
        response: observation.response
      });

      const envelope = await Effect.runPromise(gossip.publishObservation(observation));
      events.push({
        ...base("gossip_published"),
        type: "gossip_published",
        claimId: observation.claimId,
        nodeId: observation.nodeId,
        messageHash: envelope.hash,
        messageKind: envelope.kind
      });

      const oracle = reduceOracle(claim, [observation], new Date(now()));
      if (oracle.proposal) {
        events.push({
          ...base("proposal_created"),
          type: "proposal_created",
          claimId: oracle.proposal.claimId,
          response: oracle.proposal.response,
          support: oracle.proposal.support,
          expiresAt: oracle.proposal.expiresAt
        });
      }
      if (oracle.dispute) {
        events.push({
          ...base("dispute_created"),
          type: "dispute_created",
          claimId: oracle.dispute.claimId,
          reason: oracle.dispute.reason
        });
      }
      if (oracle.settlement) {
        events.push({
          ...base("settlement_created"),
          type: "settlement_created",
          claimId: oracle.settlement.claimId,
          response: oracle.settlement.response
        });
      }

      const receipt = workReceiptFromObservation(observation, now());
      events.push({
        ...base("work_receipt_created"),
        type: "work_receipt_created",
        claimId: receipt.claimId,
        nodeId: receipt.nodeId,
        workReceiptId: receipt.id,
        asset: "OUSD",
        amountAtomic: payoutAtomic,
        payoutAddress: `mock-wallet:${receipt.nodeId}`
      });

      const payout = BigInt(payoutAtomic);
      totalPayout += payout;
      sponsorBalance -= payout;
      witnessBalance += payout;
      observationCount += 1;
      events.push({
        ...base("balance_changed"),
        type: "balance_changed",
        accountId: sponsorAccountId,
        asset: "OUSD",
        deltaAtomic: `-${payout.toString()}`,
        balanceAtomic: sponsorBalance.toString(),
        reason: "settlement",
        claimId: receipt.claimId
      });
      events.push({
        ...base("balance_changed"),
        type: "balance_changed",
        accountId: receipt.nodeId,
        asset: "OUSD",
        deltaAtomic: payout.toString(),
        balanceAtomic: witnessBalance.toString(),
        reason: "work_receipt",
        claimId: receipt.claimId
      });
    }

    events.push({
      ...base("run_finished"),
      type: "run_finished",
      claimCount: options.claims.length,
      observationCount,
      asset: "OUSD",
      payoutAtomic: totalPayout.toString()
    });
  } catch (error) {
    events.push({
      ...base("run_failed"),
      type: "run_failed",
      error: errorMessage(error)
    });
  }

  assertValidHarnessEventOrder(events);
  return events;
};
