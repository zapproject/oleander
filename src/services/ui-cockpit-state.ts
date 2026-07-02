import type { ClaimResponse, ClaimSpec, WitnessRoleId } from "../domain.js";
import { reduceHarnessBalances, type HarnessBalanceState } from "./harness-balances.js";
import type { HarnessEvent, HarnessEventType } from "./harness-events.js";

export type UiCockpitRunStatus = "idle" | "running" | "finished" | "failed";
export type UiCockpitClaimStatus = "loaded" | "proposed" | "disputed" | "settled";
export type UiCockpitWitnessStatus = "idle" | "running" | "tool_calling" | "observed" | "paid" | "failed";

export interface UiCockpitClaimState {
  readonly id: string;
  readonly kind: ClaimSpec["kind"];
  readonly domain: string;
  readonly statement: string;
  readonly status: UiCockpitClaimStatus;
  readonly proposal?: {
    readonly response: ClaimResponse;
    readonly support: ReadonlyArray<string>;
    readonly expiresAt: string;
  };
  readonly disputeReason?: string;
  readonly settlement?: {
    readonly response: ClaimResponse;
  };
}

export interface UiCockpitWitnessState {
  readonly nodeId: string;
  readonly witnessRole: WitnessRoleId | undefined;
  readonly status: UiCockpitWitnessStatus;
  readonly activeClaimId: string | undefined;
  readonly observationCount: number;
  readonly earnedAtomic: string;
}

export interface UiCockpitEventLogEntry {
  readonly eventId: string;
  readonly type: HarnessEventType;
  readonly label: string;
  readonly emittedAt: string;
}

export interface UiCockpitSelection {
  readonly type: "claim" | "witness" | undefined;
  readonly id: string | undefined;
}

export interface UiCockpitState {
  readonly runId: string | undefined;
  readonly runStatus: UiCockpitRunStatus;
  readonly claims: Record<string, UiCockpitClaimState>;
  readonly claimOrder: ReadonlyArray<string>;
  readonly witnesses: Record<string, UiCockpitWitnessState>;
  readonly witnessOrder: ReadonlyArray<string>;
  readonly balances: HarnessBalanceState;
  readonly eventLog: ReadonlyArray<UiCockpitEventLogEntry>;
  readonly selected: UiCockpitSelection;
  readonly error: string | undefined;
}

const emptyBalances = (): HarnessBalanceState => ({
  asset: "OUSD",
  sponsorFundedAtomic: "0",
  committedPayoutAtomic: "0",
  paidPayoutAtomic: "0",
  accounts: {}
});

export const initialUiCockpitState = (): UiCockpitState => ({
  runId: undefined,
  runStatus: "idle",
  claims: {},
  claimOrder: [],
  witnesses: {},
  witnessOrder: [],
  balances: emptyBalances(),
  eventLog: [],
  selected: { type: undefined, id: undefined },
  error: undefined
});

const claimStateFromSpec = (claim: ClaimSpec): UiCockpitClaimState => ({
  id: claim.id,
  kind: claim.kind,
  domain: claim.domain,
  statement: claim.statement,
  status: "loaded"
});

const ensureClaim = (
  state: UiCockpitState,
  claimId: string
): UiCockpitClaimState => state.claims[claimId] ?? {
  id: claimId,
  kind: "yes_no",
  domain: "unknown",
  statement: claimId,
  status: "loaded"
};

const ensureWitness = (
  state: UiCockpitState,
  nodeId: string
): UiCockpitWitnessState => state.witnesses[nodeId] ?? {
  nodeId,
  witnessRole: undefined,
  status: "idle",
  activeClaimId: undefined,
  observationCount: 0,
  earnedAtomic: "0"
};

const uniqueAppend = (items: ReadonlyArray<string>, item: string): ReadonlyArray<string> =>
  items.includes(item) ? items : [...items, item];

const eventLabel = (event: HarnessEvent): string => {
  switch (event.type) {
    case "run_started":
      return `run started: ${event.claimCount} claims`;
    case "claim_loaded":
      return `claim loaded: ${event.claim.id}`;
    case "witness_started":
      return `witness started: ${event.nodeId}`;
    case "tool_call_started":
      return `tool started: ${event.toolName}`;
    case "tool_call_finished":
      return event.ok ? `tool finished: ${event.toolName}` : `tool failed: ${event.toolName}`;
    case "evidence_collected":
      return `evidence collected: ${event.evidence.length} records`;
    case "observation_signed":
      return `observation signed: ${event.claimId}`;
    case "gossip_published":
      return `gossip published: ${event.messageKind}`;
    case "proposal_created":
      return `proposal created: ${event.claimId}`;
    case "dispute_created":
      return `dispute created: ${event.claimId}`;
    case "settlement_created":
      return `settlement created: ${event.claimId}`;
    case "work_receipt_created":
      return `OUSD receipt created: ${event.amountAtomic}`;
    case "balance_changed":
      return `OUSD balance changed: ${event.accountId}`;
    case "run_finished":
      return `run finished: ${event.observationCount} observations`;
    case "run_failed":
      return `run failed: ${event.error}`;
  }
};

const withEventLog = (state: UiCockpitState, event: HarnessEvent): UiCockpitState => ({
  ...state,
  eventLog: [
    ...state.eventLog,
    {
      eventId: event.eventId,
      type: event.type,
      label: eventLabel(event),
      emittedAt: event.emittedAt
    }
  ].slice(-200)
});

const syncWitnessEarnings = (state: UiCockpitState, balances: HarnessBalanceState): UiCockpitState => {
  const witnesses = { ...state.witnesses };
  for (const [nodeId, witness] of Object.entries(witnesses)) {
    const account = balances.accounts[nodeId];
    if (account) {
      witnesses[nodeId] = { ...witness, earnedAtomic: account.settledAtomic };
    }
  }
  return { ...state, witnesses, balances };
};

const applyEvent = (
  state: UiCockpitState,
  event: HarnessEvent,
  balances: HarnessBalanceState
): UiCockpitState => {
  let next = withEventLog({ ...state, runId: state.runId ?? event.runId }, event);

  switch (event.type) {
    case "run_started":
      next = { ...next, runStatus: "running", error: undefined };
      break;
    case "claim_loaded":
      next = {
        ...next,
        claims: { ...next.claims, [event.claim.id]: claimStateFromSpec(event.claim) },
        claimOrder: uniqueAppend(next.claimOrder, event.claim.id)
      };
      break;
    case "witness_started": {
      const existing = ensureWitness(next, event.nodeId);
      next = {
        ...next,
        witnesses: {
          ...next.witnesses,
          [event.nodeId]: {
            ...existing,
            witnessRole: event.witnessRole,
            status: "running",
            activeClaimId: event.claimId
          }
        },
        witnessOrder: uniqueAppend(next.witnessOrder, event.nodeId)
      };
      break;
    }
    case "tool_call_started": {
      const existing = ensureWitness(next, event.nodeId);
      next = {
        ...next,
        witnesses: {
          ...next.witnesses,
          [event.nodeId]: { ...existing, status: "tool_calling", activeClaimId: event.claimId }
        },
        witnessOrder: uniqueAppend(next.witnessOrder, event.nodeId)
      };
      break;
    }
    case "tool_call_finished": {
      const existing = ensureWitness(next, event.nodeId);
      next = {
        ...next,
        witnesses: {
          ...next.witnesses,
          [event.nodeId]: { ...existing, status: event.ok ? "running" : "failed", activeClaimId: event.claimId }
        },
        witnessOrder: uniqueAppend(next.witnessOrder, event.nodeId)
      };
      break;
    }
    case "observation_signed": {
      const existing = ensureWitness(next, event.nodeId);
      next = {
        ...next,
        witnesses: {
          ...next.witnesses,
          [event.nodeId]: {
            ...existing,
            status: "observed",
            activeClaimId: event.claimId,
            observationCount: existing.observationCount + 1
          }
        },
        witnessOrder: uniqueAppend(next.witnessOrder, event.nodeId)
      };
      break;
    }
    case "proposal_created": {
      const existing = ensureClaim(next, event.claimId);
      next = {
        ...next,
        claims: {
          ...next.claims,
          [event.claimId]: {
            ...existing,
            status: "proposed",
            proposal: {
              response: event.response,
              support: event.support,
              expiresAt: event.expiresAt
            }
          }
        },
        claimOrder: uniqueAppend(next.claimOrder, event.claimId)
      };
      break;
    }
    case "dispute_created": {
      const existing = ensureClaim(next, event.claimId);
      next = {
        ...next,
        claims: {
          ...next.claims,
          [event.claimId]: { ...existing, status: "disputed", disputeReason: event.reason }
        },
        claimOrder: uniqueAppend(next.claimOrder, event.claimId)
      };
      break;
    }
    case "settlement_created": {
      const existing = ensureClaim(next, event.claimId);
      next = {
        ...next,
        claims: {
          ...next.claims,
          [event.claimId]: {
            ...existing,
            status: "settled",
            settlement: { response: event.response }
          }
        },
        claimOrder: uniqueAppend(next.claimOrder, event.claimId)
      };
      break;
    }
    case "work_receipt_created": {
      const existing = ensureWitness(next, event.nodeId);
      next = {
        ...next,
        witnesses: {
          ...next.witnesses,
          [event.nodeId]: { ...existing, status: "paid", activeClaimId: event.claimId }
        },
        witnessOrder: uniqueAppend(next.witnessOrder, event.nodeId)
      };
      break;
    }
    case "run_finished":
      next = { ...next, runStatus: "finished" };
      break;
    case "run_failed": {
      const witnesses = Object.fromEntries(
        Object.entries(next.witnesses).map(([nodeId, witness]) => [
          nodeId,
          witness.status === "paid" || witness.status === "observed"
            ? witness
            : { ...witness, status: "failed" as const }
        ])
      );
      next = { ...next, runStatus: "failed", error: event.error, witnesses };
      break;
    }
    case "evidence_collected":
    case "gossip_published":
    case "balance_changed":
      break;
  }

  return syncWitnessEarnings(next, balances);
};

export const reduceUiCockpitState = (
  events: ReadonlyArray<HarnessEvent>,
  initialState: UiCockpitState = initialUiCockpitState()
): UiCockpitState => {
  let state = initialState;
  const processed: HarnessEvent[] = [];
  for (const event of events) {
    processed.push(event);
    state = applyEvent(state, event, reduceHarnessBalances(processed));
  }
  return state;
};

export const selectUiCockpitClaim = (
  state: UiCockpitState,
  claimId: string
): UiCockpitState => ({
  ...state,
  selected: { type: "claim", id: claimId }
});

export const selectUiCockpitWitness = (
  state: UiCockpitState,
  nodeId: string
): UiCockpitState => ({
  ...state,
  selected: { type: "witness", id: nodeId }
});
