import { Context, Effect, Layer } from "effect";
import type { ClaimResponse, ClaimSpec, EvidencePlan, Observation, WitnessRole } from "../domain.js";
import { ConfigService } from "./config.js";
import { DeepSeek } from "./deepseek.js";
import { Evidence } from "./evidence.js";
import { Signer } from "./signer.js";
import { Validator } from "./validator.js";

export interface ToolCallWitnessService {
  readonly plan: (role: WitnessRole, claim: ClaimSpec) => Effect.Effect<EvidencePlan, Error>;
  readonly observe: (role: WitnessRole, claim: ClaimSpec) => Effect.Effect<Observation, Error>;
}

export class ToolCallWitness extends Context.Tag("ToolCallWitness")<
  ToolCallWitness,
  ToolCallWitnessService
>() {}

const fallbackResponse = (claim: ClaimSpec): ClaimResponse => {
  switch (claim.kind) {
    case "yes_no":
      return { type: "no_answer_possible", reason: "No live evidence adapter has been configured yet." };
    case "hash_attestation":
      return { type: "no_answer_possible", reason: "No document fetch/hash adapter has been configured yet." };
    case "uint32_multi_value":
      return { type: "no_answer_possible", reason: "No numeric extraction adapter has been configured yet." };
    case "scalar_int":
      return { type: "no_answer_possible", reason: "No scalar extraction adapter has been configured yet." };
    case "categorical":
      return { type: "no_answer_possible", reason: "No category extraction adapter has been configured yet." };
  }
};

export const responseFromModel = (claim: ClaimSpec, content: string): ClaimResponse => {
  const json = content.match(/\{[\s\S]*\}/);
  if (json) {
    try {
      const parsed = JSON.parse(json[0]) as Partial<ClaimResponse>;
      if (parsed.type === "too_early" && typeof parsed.reason === "string") {
        return { type: "too_early", reason: parsed.reason };
      }
      if (parsed.type === "no_answer_possible" && typeof parsed.reason === "string") {
        return { type: "no_answer_possible", reason: parsed.reason };
      }
      if (parsed.type === "yes_no" && typeof parsed.value === "boolean") {
        return { type: "yes_no", value: parsed.value };
      }
      if (
        parsed.type === "uint32_multi_value" &&
        Array.isArray(parsed.values) &&
        parsed.values.every((value) => typeof value === "number")
      ) {
        return { type: "uint32_multi_value", values: parsed.values };
      }
      if (parsed.type === "scalar_int" && typeof parsed.value === "number" && typeof parsed.decimals === "number") {
        return { type: "scalar_int", value: parsed.value, decimals: parsed.decimals };
      }
      if (parsed.type === "categorical" && typeof parsed.value === "string") {
        return { type: "categorical", value: parsed.value };
      }
      if (parsed.type === "hash_attestation" && typeof parsed.hash === "string") {
        return { type: "hash_attestation", hash: parsed.hash };
      }
    } catch {
      // Fall back to conservative text parsing below.
    }
  }

  const normalized = content.toLowerCase();
  if (normalized.includes("too early")) {
    return { type: "too_early", reason: "Council analysis marked the claim too early to resolve." };
  }
  if (normalized.includes("no answer") || normalized.includes("insufficient")) {
    return { type: "no_answer_possible", reason: "Council analysis found insufficient evidence." };
  }
  if (claim.kind === "yes_no") {
    if (/\btrue\b|\byes\b/.test(normalized)) return { type: "yes_no", value: true };
    if (/\bfalse\b|\bno\b/.test(normalized)) return { type: "yes_no", value: false };
  }
  return fallbackResponse(claim);
};

const confidenceFor = (response: ClaimResponse): number => {
  if (response.type === "no_answer_possible") return 0.2;
  if (response.type === "too_early") return 0.3;
  return 0.5;
};

export const DeepSeekToolCallWitnessLive = Layer.effect(
  ToolCallWitness,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const deepseek = yield* DeepSeek;
    const evidence = yield* Evidence;
    const signer = yield* Signer;
    const validator = yield* Validator;

    return {
      plan: (role, claim) =>
        Effect.gen(function* () {
          yield* validator.validateClaim(claim);
          return {
            claimId: claim.id,
            roleId: role.id,
            steps: [
              `Apply ${role.title} policy to ${claim.kind} claim`,
              "Inspect claim-provided sources as tool-call inputs",
              "Ask DeepSeek tool-call model for constrained assessment",
              "Validate response before signing observation"
            ]
          };
        }),

      observe: (role, claim) =>
        Effect.gen(function* () {
          yield* validator.validateClaim(claim);
          const evidenceRecords = yield* evidence.collect(claim);

          const content = yield* deepseek.complete([
            {
              role: "system",
              content: [
                "You are a ZAP Witness Council agent.",
                `Role: ${role.title}.`,
                `Responsibility: ${role.responsibility}.`,
                "Use DeepSeek as the constrained tool-call model for witness assessment.",
                "Return either concise rationale or a JSON ClaimResponse object.",
                "Prefer no_answer_possible unless the claim can be evaluated from provided sources alone.",
                "Valid JSON response examples:",
                "{\"type\":\"yes_no\",\"value\":true}",
                "{\"type\":\"no_answer_possible\",\"reason\":\"insufficient evidence\"}",
                "Do not invent facts."
              ].join("\n")
            },
            {
              role: "user",
              content: JSON.stringify({ claim, evidence: evidenceRecords }, null, 2)
            }
          ]);

          const response = responseFromModel(claim, content);
          yield* validator.validateResponse(claim, response);

          const unsigned = {
            claimId: claim.id,
            witnessRole: role.id,
            nodeId: config.nodeId,
            response,
            confidence: confidenceFor(response),
            evidence: evidenceRecords.map((record) => ({
              uri: record.uri,
              note: `${record.adapter} ${record.ok ? "ok" : "failed"} sha256:${record.hash}`
            })),
            rationale: content,
            observedAt: new Date().toISOString()
          } satisfies Omit<Observation, "signature">;

          const signature = yield* signer.sign(unsigned);
          return { ...unsigned, signature };
        })
    };
  })
);
