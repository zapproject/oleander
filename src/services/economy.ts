import type { Observation } from "../domain.js";
import { messageHash } from "./gossip.js";

export type ContributionCategory =
  | "observation"
  | "proposal"
  | "valid_dispute"
  | "availability"
  | "amplification"
  | "quality";

export interface WorkReceipt {
  readonly id: string;
  readonly category: ContributionCategory;
  readonly claimId: string;
  readonly nodeId: string;
  readonly evidenceHash: string;
  readonly signature: string;
  readonly issuedAt: string;
}

export interface StablecoinBountyReceipt {
  readonly workReceiptId: string;
  readonly stablecoin: "OUSD";
  readonly amountAtomic: string;
  readonly payoutAddress: string;
}

export interface ZapRewardReceipt {
  readonly workReceiptId: string;
  readonly zapAmountAtomic: string;
  readonly reason: ContributionCategory;
}

export interface BurnTreasuryPolicy {
  readonly protocolFeeBps: number;
  readonly burnShareBps: number;
  readonly treasuryShareBps: number;
}

export const defaultBurnTreasuryPolicy: BurnTreasuryPolicy = {
  protocolFeeBps: 500,
  burnShareBps: 2500,
  treasuryShareBps: 7500
};

export const workReceiptFromObservation = (observation: Observation, issuedAt = new Date().toISOString()): WorkReceipt => ({
  id: messageHash("observation", observation),
  category: "observation",
  claimId: observation.claimId,
  nodeId: observation.nodeId,
  evidenceHash: messageHash("observation", observation.evidence),
  signature: observation.signature,
  issuedAt
});

export const stablecoinBountyFromWork = (
  receipt: WorkReceipt,
  input: Omit<StablecoinBountyReceipt, "workReceiptId">
): StablecoinBountyReceipt => {
  if (!receipt.signature) throw new Error("Cannot create bounty without signed work receipt");
  return { ...input, workReceiptId: receipt.id };
};

export const zapRewardFromWork = (
  receipt: WorkReceipt,
  zapAmountAtomic: string
): ZapRewardReceipt => {
  if (!receipt.signature) throw new Error("Cannot create ZAP reward without signed work receipt");
  return {
    workReceiptId: receipt.id,
    zapAmountAtomic,
    reason: receipt.category
  };
};
