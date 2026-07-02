import type { Observation } from "../domain.js";
import { stablecoinBountyFromWork, workReceiptFromObservation, zapRewardFromWork } from "./economy.js";

export interface X402WorkIncentive {
  readonly claimId: string;
  readonly oracleNodeId: string;
  readonly sponsor: string;
  readonly workReceipt: ReturnType<typeof workReceiptFromObservation>;
  readonly stablecoinBounty: ReturnType<typeof stablecoinBountyFromWork>;
  readonly zapReward: ReturnType<typeof zapRewardFromWork>;
}

export interface X402WorkReport {
  readonly type: "x402_oracle_work";
  readonly sponsor: {
    readonly id: string;
    readonly paymentAsset: "OUSD";
    readonly bountyPerObservationAtomic: string;
    readonly zapRewardPerObservationAtomic: string;
  };
  readonly oracle: {
    readonly nodeId: string;
    readonly observationCount: number;
  };
  readonly observations: ReadonlyArray<Observation>;
  readonly incentives: ReadonlyArray<X402WorkIncentive>;
  readonly totals: {
    readonly observations: number;
    readonly stablecoinAtomic: string;
    readonly zapAtomic: string;
  };
}

const multiplyAtomic = (amountAtomic: string, count: number): string =>
  (BigInt(amountAtomic) * BigInt(count)).toString();

export const x402WorkReportFromObservations = (
  observations: ReadonlyArray<Observation>,
  options?: {
    readonly sponsorId?: string;
    readonly bountyPerObservationAtomic?: string;
    readonly zapRewardPerObservationAtomic?: string;
  }
): X402WorkReport => {
  const sponsorId = options?.sponsorId ?? "sponsor:x402:mock";
  const bountyPerObservationAtomic = options?.bountyPerObservationAtomic ?? "1000000";
  const zapRewardPerObservationAtomic = options?.zapRewardPerObservationAtomic ?? "1000000000000000000";
  const nodeId = observations[0]?.nodeId ?? "unknown-oracle";

  const incentives = observations.map((observation) => {
    const workReceipt = workReceiptFromObservation(observation);
    return {
      claimId: observation.claimId,
      oracleNodeId: observation.nodeId,
      sponsor: sponsorId,
      workReceipt,
      stablecoinBounty: stablecoinBountyFromWork(workReceipt, {
        stablecoin: "OUSD",
        amountAtomic: bountyPerObservationAtomic,
        payoutAddress: `mock-wallet:${observation.nodeId}`
      }),
      zapReward: zapRewardFromWork(workReceipt, zapRewardPerObservationAtomic)
    };
  });

  return {
    type: "x402_oracle_work",
    sponsor: {
      id: sponsorId,
      paymentAsset: "OUSD",
      bountyPerObservationAtomic,
      zapRewardPerObservationAtomic
    },
    oracle: {
      nodeId,
      observationCount: observations.length
    },
    observations,
    incentives,
    totals: {
      observations: observations.length,
      stablecoinAtomic: multiplyAtomic(bountyPerObservationAtomic, observations.length),
      zapAtomic: multiplyAtomic(zapRewardPerObservationAtomic, observations.length)
    }
  };
};
