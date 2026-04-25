export type ClaimKind =
  | "yes_no"
  | "uint32_multi_value"
  | "scalar_int"
  | "categorical"
  | "hash_attestation";

export const ClaimKinds: ReadonlyArray<ClaimKind> = [
  "yes_no",
  "uint32_multi_value",
  "scalar_int",
  "categorical",
  "hash_attestation"
];

export const isClaimKind = (value: unknown): value is ClaimKind =>
  typeof value === "string" && ClaimKinds.includes(value as ClaimKind);

export interface ClaimSpec {
  readonly id: string;
  readonly kind: ClaimKind;
  readonly domain: string;
  readonly statement: string;
  readonly sources: ReadonlyArray<string>;
  readonly livenessSeconds: number;
}

export type ClaimResponse =
  | { readonly type: "yes_no"; readonly value: boolean }
  | { readonly type: "uint32_multi_value"; readonly values: ReadonlyArray<number> }
  | { readonly type: "scalar_int"; readonly value: number; readonly decimals: number }
  | { readonly type: "categorical"; readonly value: string }
  | { readonly type: "hash_attestation"; readonly hash: string }
  | { readonly type: "too_early"; readonly reason: string }
  | { readonly type: "no_answer_possible"; readonly reason: string };

export interface EvidenceRef {
  readonly uri: string;
  readonly note: string;
}

export interface EvidencePlan {
  readonly claimId: string;
  readonly roleId: WitnessRoleId;
  readonly steps: ReadonlyArray<string>;
}

export interface Observation {
  readonly claimId: string;
  readonly witnessRole: WitnessRoleId;
  readonly nodeId: string;
  readonly response: ClaimResponse;
  readonly confidence: number;
  readonly evidence: ReadonlyArray<EvidenceRef>;
  readonly rationale: string;
  readonly observedAt: string;
  readonly signature: string;
}

export interface WitnessRole {
  readonly id: WitnessRoleId;
  readonly title: string;
  readonly responsibility: string;
}

export interface CouncilHelloTurn {
  readonly witnessRole: WitnessRoleId;
  readonly title: string;
  readonly model: string;
  readonly prompt: string;
  readonly output: string;
  readonly observedAt: string;
}

export type WitnessRoleId =
  | "high"
  | "law"
  | "cut"
  | "signal"
  | "forge"
  | "fault"
  | "research"
  | "gate";

export const WitnessRoles: ReadonlyArray<WitnessRole> = [
  {
    id: "high",
    title: "High Witness",
    responsibility: "Evaluate protocol fit, lifecycle boundaries, and settlement assumptions."
  },
  {
    id: "law",
    title: "Law Witness",
    responsibility: "Evaluate claim schema, response type, and dispute rule clarity."
  },
  {
    id: "cut",
    title: "Cut Witness",
    responsibility: "Evaluate deterministic validation and reducer requirements."
  },
  {
    id: "signal",
    title: "Signal Witness",
    responsibility: "Evaluate CRDT/gossip readiness and convergence risks."
  },
  {
    id: "forge",
    title: "Forge Witness",
    responsibility: "Evaluate runtime packaging, CLI operation, and testbed reproducibility."
  },
  {
    id: "fault",
    title: "Fault Witness",
    responsibility: "Evaluate adversarial inputs, invalid messages, and dispute triggers."
  },
  {
    id: "research",
    title: "Research Witness",
    responsibility: "Evaluate evidence collection strategy through OpenCLAW."
  },
  {
    id: "gate",
    title: "Gate Witness",
    responsibility: "Evaluate admission control, spam pressure, and reward-abuse risk."
  }
];
