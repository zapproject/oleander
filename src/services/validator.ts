import { Context, Effect, Layer } from "effect";
import type { ClaimResponse, ClaimSpec } from "../domain.js";
import { isClaimKind } from "../domain.js";

export interface ValidatorService {
  readonly validateClaim: (claim: ClaimSpec) => Effect.Effect<void, Error>;
  readonly validateResponse: (claim: ClaimSpec, response: ClaimResponse) => Effect.Effect<void, Error>;
}

export class Validator extends Context.Tag("Validator")<
  Validator,
  ValidatorService
>() {}

const sha256Pattern = /^0x[a-fA-F0-9]{64}$|^[a-fA-F0-9]{64}$/;

export const ValidatorLive = Layer.succeed(Validator, {
  validateClaim: (claim) =>
    Effect.sync(() => {
      if (!claim.id.startsWith("claim:")) throw new Error(`Invalid claim id: ${claim.id}`);
      if (!isClaimKind(claim.kind)) throw new Error(`Unsupported claim kind: ${claim.kind}`);
      if (claim.domain.trim().length === 0) throw new Error(`Claim ${claim.id} domain is required`);
      if (claim.statement.trim().length < 12) throw new Error(`Claim ${claim.id} statement is too short`);
      if (claim.sources.length === 0) throw new Error(`Claim ${claim.id} must include at least one source`);
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
      if (response.type === "scalar_int") {
        if (!Number.isSafeInteger(response.value)) throw new Error("scalar_int value must be a safe integer");
        if (!Number.isInteger(response.decimals) || response.decimals < 0 || response.decimals > 18) {
          throw new Error("scalar_int decimals must be an integer from 0 to 18");
        }
      }
      if (response.type === "categorical") {
        if (response.value.trim().length === 0) throw new Error("categorical value must be non-empty");
      }
      if (response.type === "hash_attestation") {
        if (!sha256Pattern.test(response.hash)) throw new Error("hash_attestation hash must be a sha256 hex string");
      }
    })
});
