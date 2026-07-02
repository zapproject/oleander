export type ClaimKind = "yes_no" | "hash_attestation";
export type ClaimDomain = "stablecoins" | "availability";
export type ClaimStatus = "pending" | "observed";
export type NodeType = "sponsor" | "x402" | "feed" | "claim" | "oracle" | "receipt" | "gossip";
export type RegimeId = "full" | "sponsor" | "availability" | "attestation" | "peg" | "stablecoins";

export interface ClaimSpec {
  readonly id: string;
  readonly kind: ClaimKind;
  readonly domain: ClaimDomain;
  readonly statement: string;
  readonly sources: string[];
  readonly livenessSeconds: number;
}

export interface OracleStats {
  readonly nodeId: string;
  claimIds: string[];
  observations: number;
  ousdAtomic: bigint;
  zapAtomic: bigint;
}

export interface EventItem {
  readonly tick: number;
  readonly label: string;
}

export interface Regime {
  readonly id: RegimeId;
  readonly label: string;
  readonly predicate: (claim: ClaimSpec) => boolean;
}

export interface HarnessConfig {
  readonly autoRunIntervalMs: number;
}

export type LiveHarnessEvent =
  | { readonly type: "run_started"; readonly runId: string; readonly regime: RegimeId; readonly totalClaims: number; readonly emittedAt: string }
  | { readonly type: "sponsor_claims_loaded"; readonly runId: string; readonly claims: readonly ClaimSpec[]; readonly emittedAt: string }
  | { readonly type: "oracle_started"; readonly runId: string; readonly nodeId: string; readonly claimCount: number; readonly emittedAt: string }
  | {
      readonly type: "observation_signed";
      readonly runId: string;
      readonly claimId: string;
      readonly nodeId: string;
      readonly response: { readonly type: "no_answer_possible"; readonly reason: string };
      readonly signature: string;
      readonly emittedAt: string;
    }
  | { readonly type: "work_receipt_created"; readonly runId: string; readonly claimId: string; readonly nodeId: string; readonly workReceiptId: string; readonly emittedAt: string }
  | {
      readonly type: "bounty_created";
      readonly runId: string;
      readonly claimId: string;
      readonly nodeId: string;
      readonly stablecoin: "OUSD";
      readonly amountAtomic: string;
      readonly payoutAddress: string;
      readonly emittedAt: string;
    }
  | {
      readonly type: "zap_reward_created";
      readonly runId: string;
      readonly claimId: string;
      readonly nodeId: string;
      readonly workReceiptId: string;
      readonly zapAmountAtomic: string;
      readonly reason: "observation";
      readonly emittedAt: string;
    }
  | { readonly type: "oracle_finished"; readonly runId: string; readonly nodeId: string; readonly observations: number; readonly stablecoinAtomic: string; readonly zapAtomic: string; readonly emittedAt: string }
  | { readonly type: "run_finished"; readonly runId: string; readonly totalObservations: number; readonly stablecoinAtomic: string; readonly zapAtomic: string; readonly emittedAt: string };

export const bountyAtomic = 1_000_000n;
export const zapAtomic = 1_000_000_000_000_000_000n;

export const regimes: Regime[] = [
  { id: "full", label: "Full Network", predicate: () => true },
  { id: "sponsor", label: "Sponsor Gate", predicate: () => false },
  { id: "availability", label: "Availability Oracles", predicate: (claim) => claim.domain === "availability" },
  {
    id: "attestation",
    label: "Attestation Oracles",
    predicate: (claim) => claim.domain === "stablecoins" && claim.kind === "hash_attestation"
  },
  {
    id: "peg",
    label: "Peg Oracles",
    predicate: (claim) => claim.domain === "stablecoins" && claim.kind === "yes_no"
  },
  { id: "stablecoins", label: "Stablecoin Oracles", predicate: (claim) => claim.domain === "stablecoins" }
];

export const createOracleStats = (): Record<string, OracleStats> => ({
  "witness-availability": { nodeId: "witness-availability", claimIds: [], observations: 0, ousdAtomic: 0n, zapAtomic: 0n },
  "witness-attestation": { nodeId: "witness-attestation", claimIds: [], observations: 0, ousdAtomic: 0n, zapAtomic: 0n },
  "witness-peg": { nodeId: "witness-peg", claimIds: [], observations: 0, ousdAtomic: 0n, zapAtomic: 0n }
});

export const resetOracleStats = (stats: Record<string, OracleStats>) => {
  for (const stat of Object.values(stats)) {
    stat.claimIds = [];
    stat.observations = 0;
    stat.ousdAtomic = 0n;
    stat.zapAtomic = 0n;
  }
};

export const oracleForClaim = (claim: ClaimSpec): string => {
  if (claim.domain === "availability") return "witness-availability";
  if (claim.kind === "hash_attestation") return "witness-attestation";
  return "witness-peg";
};

export const claimCategory = (claim: ClaimSpec): "peg" | "attestation" | "availability" => {
  if (claim.domain === "availability") return "availability";
  if (claim.kind === "hash_attestation") return "attestation";
  return "peg";
};

export const shortClaimId = (id: string): string => id.replace("claim:x402:50:", "");

export const addEventItem = (events: EventItem[], label: string): EventItem[] =>
  [{ tick: events.length + 1, label }, ...events].slice(0, 18);

export const addVerboseLine = (lines: string[], value: unknown, limit = 10): string[] =>
  [JSON.stringify(value, null, 2), ...lines].slice(0, limit);

export const createVerboseReceipt = (claim: ClaimSpec, oracle: string) => ({
  type: "x402_oracle_work",
  sponsor: "sponsor:x402:mock",
  oracle,
  claimId: claim.id,
  workReceipt: `work:${claim.id}:${oracle}`,
  stablecoinBounty: {
    stablecoin: "OUSD",
    amountAtomic: bountyAtomic.toString(),
    payoutAddress: `mock-wallet:${oracle}`
  },
  zapReward: {
    zapAmountAtomic: zapAtomic.toString(),
    reason: "observation"
  }
});

export const liveEventTypes: LiveHarnessEvent["type"][] = [
  "run_started",
  "sponsor_claims_loaded",
  "oracle_started",
  "observation_signed",
  "work_receipt_created",
  "bounty_created",
  "zap_reward_created",
  "oracle_finished",
  "run_finished"
];

export const liveEventLabel = (event: LiveHarnessEvent): string => {
  if (event.type === "run_started") return `Live run started: ${event.regime}`;
  if (event.type === "sponsor_claims_loaded") return `Sponsor loaded ${event.claims.length} claims`;
  if (event.type === "oracle_started") return `${event.nodeId} started ${event.claimCount} claims`;
  if (event.type === "observation_signed") return `${event.nodeId} signed ${shortClaimId(event.claimId)}`;
  if (event.type === "work_receipt_created") return `Receipt created for ${shortClaimId(event.claimId)}`;
  if (event.type === "bounty_created") return `${event.nodeId} earned ${event.amountAtomic} ${event.stablecoin} atomic`;
  if (event.type === "zap_reward_created") return `${event.nodeId} earned ${event.zapAmountAtomic} ZAP atomic`;
  if (event.type === "oracle_finished") return `${event.nodeId} settled ${event.observations} observations`;
  return `Run settled: ${event.totalObservations} observations`;
};
