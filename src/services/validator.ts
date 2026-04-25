import { Context, Effect, Layer } from "effect";
import type { ClaimResponse, ClaimSpec } from "../domain.js";

export interface ValidatorService {
  readonly validateClaim: (claim: ClaimSpec) => Effect.Effect<void, Error>;
  readonly validateResponse: (claim: ClaimSpec, response: ClaimResponse) => Effect.Effect<void, Error>;
}

export class Validator extends Context.Tag("Validator")<
  Validator,
  ValidatorService
>() {}

export const ValidatorLive = Layer.succeed(Validator, {
  validateClaim: (claim) =>
    Effect.sync(() => {
      if (!claim.id.startsWith("claim:")) throw new Error(`Invalid claim id: ${claim.id}`);
      if (claim.statement.trim().length < 12) throw new Error(`Claim ${claim.id} statement is too short`);
      if (claim.livenessSeconds <= 0) throw new Error(`Claim ${claim.id} has invalid liveness`);
    }),

  validateResponse: (claim, response) =>
    Effect.sync(() => {
      if (response.type === "too_early" || response.type === "no_answer_possible") return;
      if (claim.kind !== response.type) {
        throw new Error(`Response type ${response.type} does not match claim kind ${claim.kind}`);
      }
      if (response.type === "uint32_multi_value") {
        if (response.values.length > 7) throw new Error("uint32_multi_value supports at most 7 values");
        for (const value of response.values) {
          if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
            throw new Error(`Invalid uint32 value: ${value}`);
          }
        }
      }
    })
});
