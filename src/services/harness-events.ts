import type { ClaimResponse, ClaimSpec, EvidenceAdapterKind, WitnessRoleId } from "../domain.js";
import type { GossipMessageKind } from "./gossip.js";

export const HarnessEventTypes = [
  "run_started",
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
  "balance_changed",
  "run_finished",
  "run_failed"
] as const;

export type HarnessEventType = (typeof HarnessEventTypes)[number];
export type SettlementAsset = "OUSD";

export interface HarnessEventBase {
  readonly type: HarnessEventType;
  readonly eventId: string;
  readonly runId: string;
  readonly emittedAt: string;
}

export interface HarnessEvidenceSummary {
  readonly uri: string;
  readonly ok: boolean;
  readonly hash: string;
  readonly adapter: EvidenceAdapterKind;
}

export type HarnessEvent =
  | (HarnessEventBase & {
      readonly type: "run_started";
      readonly claimCount: number;
    })
  | (HarnessEventBase & {
      readonly type: "claim_loaded";
      readonly claim: ClaimSpec;
    })
  | (HarnessEventBase & {
      readonly type: "witness_started";
      readonly claimId: string;
      readonly nodeId: string;
      readonly witnessRole: WitnessRoleId;
    })
  | (HarnessEventBase & {
      readonly type: "tool_call_started";
      readonly claimId: string;
      readonly nodeId: string;
      readonly callId: string;
      readonly toolName: string;
    })
  | (HarnessEventBase & {
      readonly type: "tool_call_finished";
      readonly claimId: string;
      readonly nodeId: string;
      readonly callId: string;
      readonly toolName: string;
      readonly ok: boolean;
      readonly outputSummary?: string;
      readonly error?: string;
    })
  | (HarnessEventBase & {
      readonly type: "evidence_collected";
      readonly claimId: string;
      readonly nodeId: string;
      readonly evidence: ReadonlyArray<HarnessEvidenceSummary>;
    })
  | (HarnessEventBase & {
      readonly type: "observation_signed";
      readonly claimId: string;
      readonly nodeId: string;
      readonly signature: string;
      readonly response: ClaimResponse;
    })
  | (HarnessEventBase & {
      readonly type: "gossip_published";
      readonly claimId: string;
      readonly nodeId: string;
      readonly messageHash: string;
      readonly messageKind: GossipMessageKind;
    })
  | (HarnessEventBase & {
      readonly type: "proposal_created";
      readonly claimId: string;
      readonly response: ClaimResponse;
      readonly support: ReadonlyArray<string>;
      readonly expiresAt: string;
    })
  | (HarnessEventBase & {
      readonly type: "dispute_created";
      readonly claimId: string;
      readonly reason: string;
    })
  | (HarnessEventBase & {
      readonly type: "settlement_created";
      readonly claimId: string;
      readonly response: ClaimResponse;
    })
  | (HarnessEventBase & {
      readonly type: "work_receipt_created";
      readonly claimId: string;
      readonly nodeId: string;
      readonly workReceiptId: string;
      readonly asset: SettlementAsset;
      readonly amountAtomic: string;
      readonly payoutAddress: string;
    })
  | (HarnessEventBase & {
      readonly type: "balance_changed";
      readonly accountId: string;
      readonly asset: SettlementAsset;
      readonly deltaAtomic: string;
      readonly balanceAtomic: string;
      readonly reason: "sponsor_funded" | "work_receipt" | "settlement" | "adjustment";
      readonly claimId?: string;
    })
  | (HarnessEventBase & {
      readonly type: "run_finished";
      readonly claimCount: number;
      readonly observationCount: number;
      readonly asset: SettlementAsset;
      readonly payoutAtomic: string;
    })
  | (HarnessEventBase & {
      readonly type: "run_failed";
      readonly error: string;
    });

const eventTypeSet = new Set<string>(HarnessEventTypes);
const witnessRoleIds = new Set<string>(["high", "law", "cut", "signal", "forge", "fault", "research", "gate"]);
const evidenceAdapters = new Set<string>(["http", "price-feed", "hash-document"]);
const gossipKinds = new Set<string>(["observation", "proposal", "dispute", "settlement"]);
const balanceReasons = new Set<string>(["sponsor_funded", "work_receipt", "settlement", "adjustment"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, name: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`${name} is required`);
  return value;
};

const requireString = (record: Record<string, unknown>, key: string, label: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} is required`);
  return value;
};

const requireOptionalString = (record: Record<string, unknown>, key: string, label: string): string | undefined => {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
};

const requireNumber = (record: Record<string, unknown>, key: string, label: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} is required`);
  return value;
};

const requireBoolean = (record: Record<string, unknown>, key: string, label: string): boolean => {
  const value = record[key];
  if (typeof value !== "boolean") throw new Error(`${label} is required`);
  return value;
};

const requireStringArray = (record: Record<string, unknown>, key: string, label: string): ReadonlyArray<string> => {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${label} is required`);
  }
  return value;
};

const requireOusd = (record: Record<string, unknown>, key: string, label: string): SettlementAsset => {
  const value = requireString(record, key, label);
  if (value !== "OUSD") throw new Error(`${label} must be OUSD`);
  return value;
};

const requireWitnessRole = (record: Record<string, unknown>, key: string, label: string): WitnessRoleId => {
  const value = requireString(record, key, label);
  if (!witnessRoleIds.has(value)) throw new Error(`${label} is invalid`);
  return value as WitnessRoleId;
};

const requireGossipKind = (record: Record<string, unknown>, key: string, label: string): GossipMessageKind => {
  const value = requireString(record, key, label);
  if (!gossipKinds.has(value)) throw new Error(`${label} is invalid`);
  return value as GossipMessageKind;
};

const requireBalanceReason = (
  record: Record<string, unknown>,
  key: string,
  label: string
): "sponsor_funded" | "work_receipt" | "settlement" | "adjustment" => {
  const value = requireString(record, key, label);
  if (!balanceReasons.has(value)) throw new Error(`${label} is invalid`);
  return value as "sponsor_funded" | "work_receipt" | "settlement" | "adjustment";
};

const isClaimResponse = (value: unknown): value is ClaimResponse => {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "too_early" || value.type === "no_answer_possible") return typeof value.reason === "string";
  if (value.type === "yes_no") return typeof value.value === "boolean";
  if (value.type === "uint32_multi_value") {
    return Array.isArray(value.values) && value.values.every((item) => typeof item === "number");
  }
  if (value.type === "scalar_int") return typeof value.value === "number" && typeof value.decimals === "number";
  if (value.type === "categorical") return typeof value.value === "string";
  if (value.type === "hash_attestation") return typeof value.hash === "string";
  return false;
};

const requireClaimResponse = (record: Record<string, unknown>, key: string, label: string): ClaimResponse => {
  const value = record[key];
  if (!isClaimResponse(value)) throw new Error(`${label} is required`);
  return value;
};

const isClaimSpec = (value: unknown): value is ClaimSpec =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.kind === "string" &&
  typeof value.domain === "string" &&
  typeof value.statement === "string" &&
  Array.isArray(value.sources) &&
  value.sources.every((source) => typeof source === "string") &&
  typeof value.livenessSeconds === "number";

const requireClaim = (record: Record<string, unknown>, key: string, label: string): ClaimSpec => {
  const value = record[key];
  if (!isClaimSpec(value)) throw new Error(`${label} is required`);
  return value;
};

const requireEvidence = (
  record: Record<string, unknown>,
  key: string,
  label: string
): ReadonlyArray<HarnessEvidenceSummary> => {
  const value = record[key];
  if (!Array.isArray(value)) throw new Error(`${label} is required`);
  return value.map((item, index) => {
    const evidence = requireRecord(item, `${label}[${index}]`);
    const adapter = requireString(evidence, "adapter", `${label}[${index}].adapter`);
    if (!evidenceAdapters.has(adapter)) throw new Error(`${label}[${index}].adapter is invalid`);
    return {
      uri: requireString(evidence, "uri", `${label}[${index}].uri`),
      ok: requireBoolean(evidence, "ok", `${label}[${index}].ok`),
      hash: requireString(evidence, "hash", `${label}[${index}].hash`),
      adapter: adapter as EvidenceAdapterKind
    };
  });
};

export const serializeHarnessEvent = (event: HarnessEvent): string =>
  JSON.stringify(event);

export const parseHarnessEvent = (input: string | unknown): HarnessEvent => {
  const value = typeof input === "string" ? JSON.parse(input) as unknown : input;
  const record = requireRecord(value, "harness event");
  const type = requireString(record, "type", "event.type");
  if (!eventTypeSet.has(type)) throw new Error(`Unknown harness event type: ${type}`);

  const base = {
    type: type as HarnessEventType,
    eventId: requireString(record, "eventId", `${type}.eventId`),
    runId: requireString(record, "runId", `${type}.runId`),
    emittedAt: requireString(record, "emittedAt", `${type}.emittedAt`)
  };

  switch (type) {
    case "run_started":
      return { ...base, type, claimCount: requireNumber(record, "claimCount", "run_started.claimCount") };
    case "claim_loaded":
      return { ...base, type, claim: requireClaim(record, "claim", "claim_loaded.claim") };
    case "witness_started":
      return {
        ...base,
        type,
        claimId: requireString(record, "claimId", "witness_started.claimId"),
        nodeId: requireString(record, "nodeId", "witness_started.nodeId"),
        witnessRole: requireWitnessRole(record, "witnessRole", "witness_started.witnessRole")
      };
    case "tool_call_started":
      return {
        ...base,
        type,
        claimId: requireString(record, "claimId", "tool_call_started.claimId"),
        nodeId: requireString(record, "nodeId", "tool_call_started.nodeId"),
        callId: requireString(record, "callId", "tool_call_started.callId"),
        toolName: requireString(record, "toolName", "tool_call_started.toolName")
      };
    case "tool_call_finished":
      return {
        ...base,
        type,
        claimId: requireString(record, "claimId", "tool_call_finished.claimId"),
        nodeId: requireString(record, "nodeId", "tool_call_finished.nodeId"),
        callId: requireString(record, "callId", "tool_call_finished.callId"),
        toolName: requireString(record, "toolName", "tool_call_finished.toolName"),
        ok: requireBoolean(record, "ok", "tool_call_finished.ok"),
        outputSummary: requireOptionalString(record, "outputSummary", "tool_call_finished.outputSummary"),
        error: requireOptionalString(record, "error", "tool_call_finished.error")
      };
    case "evidence_collected":
      return {
        ...base,
        type,
        claimId: requireString(record, "claimId", "evidence_collected.claimId"),
        nodeId: requireString(record, "nodeId", "evidence_collected.nodeId"),
        evidence: requireEvidence(record, "evidence", "evidence_collected.evidence")
      };
    case "observation_signed":
      return {
        ...base,
        type,
        claimId: requireString(record, "claimId", "observation_signed.claimId"),
        nodeId: requireString(record, "nodeId", "observation_signed.nodeId"),
        signature: requireString(record, "signature", "observation_signed.signature"),
        response: requireClaimResponse(record, "response", "observation_signed.response")
      };
    case "gossip_published":
      return {
        ...base,
        type,
        claimId: requireString(record, "claimId", "gossip_published.claimId"),
        nodeId: requireString(record, "nodeId", "gossip_published.nodeId"),
        messageHash: requireString(record, "messageHash", "gossip_published.messageHash"),
        messageKind: requireGossipKind(record, "messageKind", "gossip_published.messageKind")
      };
    case "proposal_created":
      return {
        ...base,
        type,
        claimId: requireString(record, "claimId", "proposal_created.claimId"),
        response: requireClaimResponse(record, "response", "proposal_created.response"),
        support: requireStringArray(record, "support", "proposal_created.support"),
        expiresAt: requireString(record, "expiresAt", "proposal_created.expiresAt")
      };
    case "dispute_created":
      return {
        ...base,
        type,
        claimId: requireString(record, "claimId", "dispute_created.claimId"),
        reason: requireString(record, "reason", "dispute_created.reason")
      };
    case "settlement_created":
      return {
        ...base,
        type,
        claimId: requireString(record, "claimId", "settlement_created.claimId"),
        response: requireClaimResponse(record, "response", "settlement_created.response")
      };
    case "work_receipt_created":
      return {
        ...base,
        type,
        claimId: requireString(record, "claimId", "work_receipt_created.claimId"),
        nodeId: requireString(record, "nodeId", "work_receipt_created.nodeId"),
        workReceiptId: requireString(record, "workReceiptId", "work_receipt_created.workReceiptId"),
        asset: requireOusd(record, "asset", "work_receipt_created.asset"),
        amountAtomic: requireString(record, "amountAtomic", "work_receipt_created.amountAtomic"),
        payoutAddress: requireString(record, "payoutAddress", "work_receipt_created.payoutAddress")
      };
    case "balance_changed":
      return {
        ...base,
        type,
        accountId: requireString(record, "accountId", "balance_changed.accountId"),
        asset: requireOusd(record, "asset", "balance_changed.asset"),
        deltaAtomic: requireString(record, "deltaAtomic", "balance_changed.deltaAtomic"),
        balanceAtomic: requireString(record, "balanceAtomic", "balance_changed.balanceAtomic"),
        reason: requireBalanceReason(record, "reason", "balance_changed.reason"),
        claimId: requireOptionalString(record, "claimId", "balance_changed.claimId")
      };
    case "run_finished":
      return {
        ...base,
        type,
        claimCount: requireNumber(record, "claimCount", "run_finished.claimCount"),
        observationCount: requireNumber(record, "observationCount", "run_finished.observationCount"),
        asset: requireOusd(record, "asset", "run_finished.asset"),
        payoutAtomic: requireString(record, "payoutAtomic", "run_finished.payoutAtomic")
      };
    case "run_failed":
      return {
        ...base,
        type,
        error: requireString(record, "error", "run_failed.error")
      };
  }
  throw new Error(`Unhandled harness event type: ${type}`);
};

const witnessKey = (claimId: string, nodeId: string): string => `${claimId}/${nodeId}`;

export const validateHarnessEventOrder = (events: ReadonlyArray<HarnessEvent>): ReadonlyArray<string> => {
  const errors: string[] = [];
  if (events.length === 0) return ["run has no events"];
  if (events[0]?.type !== "run_started") errors.push("first event must be run_started");

  const runId = events[0]?.runId;
  const loadedClaims = new Set<string>();
  const startedWitnesses = new Set<string>();
  const completedWitnesses = new Set<string>();
  const startedToolCalls = new Set<string>();
  const signedObservations = new Set<string>();
  const workReceipts = new Set<string>();
  let runClosed = false;

  for (const event of events) {
    if (runId && event.runId !== runId) errors.push(`${event.type} has mismatched runId ${event.runId}`);
    if (runClosed) errors.push(`${event.type} emitted after run closed`);

    switch (event.type) {
      case "run_started":
        break;
      case "claim_loaded":
        loadedClaims.add(event.claim.id);
        break;
      case "witness_started": {
        if (!loadedClaims.has(event.claimId)) errors.push(`witness_started before claim_loaded for ${event.claimId}`);
        startedWitnesses.add(witnessKey(event.claimId, event.nodeId));
        break;
      }
      case "tool_call_started": {
        const key = witnessKey(event.claimId, event.nodeId);
        if (!startedWitnesses.has(key)) errors.push(`tool_call_started before witness_started for ${key}`);
        startedToolCalls.add(`${key}/${event.callId}`);
        break;
      }
      case "tool_call_finished": {
        const key = `${witnessKey(event.claimId, event.nodeId)}/${event.callId}`;
        if (!startedToolCalls.has(key)) errors.push(`tool_call_finished before tool_call_started for ${key}`);
        break;
      }
      case "evidence_collected": {
        const key = witnessKey(event.claimId, event.nodeId);
        if (!startedWitnesses.has(key)) errors.push(`evidence_collected before witness_started for ${key}`);
        break;
      }
      case "observation_signed": {
        const key = witnessKey(event.claimId, event.nodeId);
        if (!startedWitnesses.has(key)) errors.push(`observation_signed before witness_started for ${key}`);
        signedObservations.add(key);
        completedWitnesses.add(key);
        break;
      }
      case "gossip_published": {
        const key = witnessKey(event.claimId, event.nodeId);
        if (!signedObservations.has(key)) errors.push(`gossip_published before observation_signed for ${key}`);
        break;
      }
      case "proposal_created":
      case "dispute_created":
      case "settlement_created":
        if (!loadedClaims.has(event.claimId)) errors.push(`${event.type} before claim_loaded for ${event.claimId}`);
        break;
      case "work_receipt_created": {
        const key = witnessKey(event.claimId, event.nodeId);
        if (!signedObservations.has(key)) errors.push(`work_receipt_created for ${key} before observation_signed`);
        workReceipts.add(event.workReceiptId);
        break;
      }
      case "balance_changed":
        if (event.reason === "work_receipt" && event.claimId && workReceipts.size === 0) {
          errors.push(`balance_changed for ${event.accountId} before work_receipt_created`);
        }
        break;
      case "run_finished":
        for (const key of startedWitnesses) {
          if (!completedWitnesses.has(key)) {
            const [claimId, nodeId] = key.split("/");
            errors.push(`run_finished before witness ${nodeId} completed ${claimId}`);
          }
        }
        runClosed = true;
        break;
      case "run_failed":
        runClosed = true;
        break;
    }
  }

  return errors;
};

export const assertValidHarnessEventOrder = (events: ReadonlyArray<HarnessEvent>): void => {
  const errors = validateHarnessEventOrder(events);
  if (errors.length > 0) throw new Error(`Invalid harness event order: ${errors.join("; ")}`);
};
