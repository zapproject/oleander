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
  readonly opsAuthEnabled?: boolean;
}

export interface OusdBalanceAccount {
  readonly accountId: string;
  balanceAtomic: bigint;
  fundedAtomic: bigint;
  earnedAtomic: bigint;
  spentAtomic: bigint;
}

export interface OusdBalanceState {
  accounts: Record<string, OusdBalanceAccount>;
  appliedEventIds: Set<string>;
  sponsorAccountId: string | undefined;
}

export interface OusdBalanceSummary {
  readonly sponsorFundedAtomic: bigint;
  readonly sponsorBalanceAtomic: bigint;
  readonly sponsorSpentAtomic: bigint;
  readonly witnessEarnedAtomic: bigint;
}

export type LegacyLiveHarnessEvent =
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

export type EngineHarnessEvent =
  | { readonly type: "run_started"; readonly eventId: string; readonly runId: string; readonly claimCount: number; readonly emittedAt: string }
  | { readonly type: "claim_loaded"; readonly eventId: string; readonly runId: string; readonly claim: ClaimSpec; readonly emittedAt: string }
  | { readonly type: "witness_started"; readonly eventId: string; readonly runId: string; readonly claimId: string; readonly nodeId: string; readonly witnessRole: string; readonly emittedAt: string }
  | {
      readonly type: "tool_call_started";
      readonly eventId: string;
      readonly runId: string;
      readonly claimId: string;
      readonly nodeId: string;
      readonly callId: string;
      readonly toolName: string;
      readonly emittedAt: string;
    }
  | {
      readonly type: "tool_call_finished";
      readonly eventId: string;
      readonly runId: string;
      readonly claimId: string;
      readonly nodeId: string;
      readonly callId: string;
      readonly toolName: string;
      readonly ok: boolean;
      readonly outputSummary?: string;
      readonly error?: string;
      readonly emittedAt: string;
    }
  | {
      readonly type: "evidence_collected";
      readonly eventId: string;
      readonly runId: string;
      readonly claimId: string;
      readonly nodeId: string;
      readonly evidence: ReadonlyArray<{ readonly uri: string; readonly ok: boolean; readonly hash: string; readonly adapter: string }>;
      readonly emittedAt: string;
    }
  | {
      readonly type: "observation_signed";
      readonly eventId: string;
      readonly runId: string;
      readonly claimId: string;
      readonly nodeId: string;
      readonly response: unknown;
      readonly signature: string;
      readonly emittedAt: string;
    }
  | {
      readonly type: "gossip_published";
      readonly eventId: string;
      readonly runId: string;
      readonly claimId: string;
      readonly nodeId: string;
      readonly messageHash: string;
      readonly messageKind: string;
      readonly emittedAt: string;
    }
  | {
      readonly type: "proposal_created";
      readonly eventId: string;
      readonly runId: string;
      readonly claimId: string;
      readonly response: unknown;
      readonly support: readonly string[];
      readonly expiresAt: string;
      readonly emittedAt: string;
    }
  | { readonly type: "dispute_created"; readonly eventId: string; readonly runId: string; readonly claimId: string; readonly reason: string; readonly emittedAt: string }
  | { readonly type: "settlement_created"; readonly eventId: string; readonly runId: string; readonly claimId: string; readonly response: unknown; readonly emittedAt: string }
  | {
      readonly type: "work_receipt_created";
      readonly eventId: string;
      readonly runId: string;
      readonly claimId: string;
      readonly nodeId: string;
      readonly workReceiptId: string;
      readonly asset: "OUSD";
      readonly amountAtomic: string;
      readonly payoutAddress: string;
      readonly emittedAt: string;
    }
  | {
      readonly type: "balance_changed";
      readonly eventId: string;
      readonly runId: string;
      readonly accountId: string;
      readonly asset: "OUSD";
      readonly deltaAtomic: string;
      readonly balanceAtomic: string;
      readonly reason: "sponsor_funded" | "work_receipt" | "settlement" | "adjustment";
      readonly claimId?: string;
      readonly emittedAt: string;
    }
  | { readonly type: "run_finished"; readonly eventId: string; readonly runId: string; readonly claimCount: number; readonly observationCount: number; readonly asset: "OUSD"; readonly payoutAtomic: string; readonly emittedAt: string }
  | { readonly type: "run_failed"; readonly eventId: string; readonly runId: string; readonly error: string; readonly emittedAt: string };

export type LiveHarnessEvent = LegacyLiveHarnessEvent | EngineHarnessEvent;

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

export const createOusdBalanceState = (): OusdBalanceState => ({
  accounts: {},
  appliedEventIds: new Set(),
  sponsorAccountId: undefined
});

export const resetOusdBalanceState = (state: OusdBalanceState) => {
  state.accounts = {};
  state.appliedEventIds.clear();
  state.sponsorAccountId = undefined;
};

const accountFor = (state: OusdBalanceState, accountId: string): OusdBalanceAccount => {
  state.accounts[accountId] ??= {
    accountId,
    balanceAtomic: 0n,
    fundedAtomic: 0n,
    earnedAtomic: 0n,
    spentAtomic: 0n
  };
  return state.accounts[accountId];
};

export const applyOusdBalanceEvent = (state: OusdBalanceState, event: LiveHarnessEvent): OusdBalanceState => {
  if (event.type !== "balance_changed" || state.appliedEventIds.has(event.eventId)) return state;
  state.appliedEventIds.add(event.eventId);
  const account = accountFor(state, event.accountId);
  const deltaAtomic = BigInt(event.deltaAtomic);
  account.balanceAtomic = BigInt(event.balanceAtomic);
  if (event.reason === "sponsor_funded") {
    state.sponsorAccountId = event.accountId;
    if (deltaAtomic > 0n) account.fundedAtomic += deltaAtomic;
  }
  if (event.reason === "settlement" && deltaAtomic < 0n) account.spentAtomic += -deltaAtomic;
  if (event.reason === "work_receipt" && deltaAtomic > 0n) account.earnedAtomic += deltaAtomic;
  return state;
};

export const summarizeOusdBalances = (state: OusdBalanceState): OusdBalanceSummary => {
  const accounts = Object.values(state.accounts);
  const sponsor =
    (state.sponsorAccountId ? state.accounts[state.sponsorAccountId] : undefined) ??
    accounts.find((account) => account.accountId.startsWith("sponsor:"));
  return {
    sponsorFundedAtomic: sponsor?.fundedAtomic ?? 0n,
    sponsorBalanceAtomic: sponsor?.balanceAtomic ?? 0n,
    sponsorSpentAtomic: sponsor?.spentAtomic ?? 0n,
    witnessEarnedAtomic: accounts
      .filter((account) => account.accountId.startsWith("witness-"))
      .reduce((total, account) => total + account.earnedAtomic, 0n)
  };
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
  "claim_loaded",
  "witness_started",
  "tool_call_started",
  "tool_call_finished",
  "evidence_collected",
  "observation_signed",
  "gossip_published",
  "proposal_created",
  "dispute_created",
  "settlement_created",
  "work_receipt_created",
  "bounty_created",
  "zap_reward_created",
  "balance_changed",
  "oracle_finished",
  "run_finished",
  "run_failed"
];

export const isEngineHarnessEvent = (event: LiveHarnessEvent): event is EngineHarnessEvent => "eventId" in event;

export const liveEventLabel = (event: LiveHarnessEvent): string => {
  if (event.type === "run_started") {
    if (isEngineHarnessEvent(event)) return `Engine run started: ${event.claimCount} claims`;
    return `Live run started: ${event.regime}`;
  }
  if (event.type === "sponsor_claims_loaded") return `Sponsor loaded ${event.claims.length} claims`;
  if (event.type === "oracle_started") return `${event.nodeId} started ${event.claimCount} claims`;
  if (event.type === "claim_loaded") return `Loaded ${shortClaimId(event.claim.id)}`;
  if (event.type === "witness_started") return `${event.nodeId} started ${shortClaimId(event.claimId)}`;
  if (event.type === "tool_call_started") return `${event.nodeId} called ${event.toolName}`;
  if (event.type === "tool_call_finished") return `${event.nodeId} ${event.ok ? "finished" : "failed"} ${event.toolName}`;
  if (event.type === "evidence_collected") return `${event.nodeId} collected ${event.evidence.length} evidence items`;
  if (event.type === "observation_signed") return `${event.nodeId} signed ${shortClaimId(event.claimId)}`;
  if (event.type === "gossip_published") return `${event.nodeId} published ${event.messageKind}`;
  if (event.type === "proposal_created") return `Proposal created for ${shortClaimId(event.claimId)}`;
  if (event.type === "dispute_created") return `Dispute opened for ${shortClaimId(event.claimId)}`;
  if (event.type === "settlement_created") return `Settlement created for ${shortClaimId(event.claimId)}`;
  if (event.type === "work_receipt_created") {
    if (isEngineHarnessEvent(event)) return `${event.nodeId} earned ${event.amountAtomic} ${event.asset} atomic`;
    return `Receipt created for ${shortClaimId(event.claimId)}`;
  }
  if (event.type === "bounty_created") return `${event.nodeId} earned ${event.amountAtomic} ${event.stablecoin} atomic`;
  if (event.type === "zap_reward_created") return `${event.nodeId} earned ${event.zapAmountAtomic} ZAP atomic`;
  if (event.type === "balance_changed") return `${event.accountId} balance ${event.balanceAtomic} ${event.asset} atomic`;
  if (event.type === "oracle_finished") return `${event.nodeId} settled ${event.observations} observations`;
  if (event.type === "run_failed") return `Run failed: ${event.error}`;
  if (isEngineHarnessEvent(event)) return `Run settled: ${event.observationCount} observations`;
  return `Run settled: ${event.totalObservations} observations`;
};
