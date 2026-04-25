import { Context, Effect, Layer } from "effect";
import type { ClaimResponse, ClaimSpec, Observation, WitnessRole } from "../domain.js";
import { ConfigService } from "./config.js";
import { DeepSeek } from "./deepseek.js";
import { Signer } from "./signer.js";
import { Validator } from "./validator.js";

export interface OpenClawService {
  readonly observe: (role: WitnessRole, claim: ClaimSpec) => Effect.Effect<Observation, Error>;
}

export class OpenClaw extends Context.Tag("OpenClaw")<
  OpenClaw,
  OpenClawService
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

const responseFromModel = (claim: ClaimSpec, content: string): ClaimResponse => {
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

export const OpenClawLive = Layer.effect(
  OpenClaw,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const deepseek = yield* DeepSeek;
    const signer = yield* Signer;
    const validator = yield* Validator;

    return {
      observe: (role, claim) =>
        Effect.gen(function* () {
          yield* validator.validateClaim(claim);

          const content = yield* deepseek.complete([
            {
              role: "system",
              content: [
                "You are a ZAP Witness Council agent.",
                `Role: ${role.title}.`,
                `Responsibility: ${role.responsibility}.`,
                "Return a concise assessment. Prefer 'insufficient evidence' unless the claim can be evaluated from provided sources alone.",
                "Do not invent facts."
              ].join("\n")
            },
            {
              role: "user",
              content: JSON.stringify(claim, null, 2)
            }
          ]);

          const response = responseFromModel(claim, content);
          yield* validator.validateResponse(claim, response);

          const unsigned = {
            claimId: claim.id,
            witnessRole: role.id,
            nodeId: config.nodeId,
            response,
            confidence: response.type === "no_answer_possible" ? 0.2 : 0.5,
            evidence: claim.sources.map((uri) => ({ uri, note: "Referenced by claim feed" })),
            rationale: content,
            observedAt: new Date().toISOString()
          } satisfies Omit<Observation, "signature">;

          const signature = yield* signer.sign(unsigned);
          return { ...unsigned, signature };
        })
    };
  })
);
