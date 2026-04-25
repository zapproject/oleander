import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import type { ClaimKind, ClaimResponse, ClaimSpec } from "../domain.js";
import { Validator, ValidatorLive } from "./validator.js";

const claim = (kind: ClaimKind): ClaimSpec => ({
  id: `claim:test:${kind}`,
  kind,
  domain: "stablecoins",
  statement: "A typed claim with enough statement length.",
  sources: ["https://example.com"],
  livenessSeconds: 60
});

const validateClaim = (spec: ClaimSpec) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const validator = yield* Validator;
        return yield* validator.validateClaim(spec);
      }),
      ValidatorLive
    )
  );

const validateResponse = (spec: ClaimSpec, response: ClaimResponse) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const validator = yield* Validator;
        return yield* validator.validateResponse(spec, response);
      }),
      ValidatorLive
    )
  );

describe("Validator.validateClaim", () => {
  test("accepts supported typed claims", async () => {
    await expect(validateClaim(claim("yes_no"))).resolves.toBeUndefined();
  });

  test("rejects invalid claim id", async () => {
    await expect(validateClaim({ ...claim("yes_no"), id: "bad" })).rejects.toThrow("Invalid claim id");
  });

  test("rejects missing sources", async () => {
    await expect(validateClaim({ ...claim("yes_no"), sources: [] })).rejects.toThrow("must include at least one source");
  });
});

describe("Validator.validateResponse", () => {
  test("allows special responses for any claim kind", async () => {
    await expect(
      validateResponse(claim("hash_attestation"), { type: "too_early", reason: "waiting for close" })
    ).resolves.toBeUndefined();
    await expect(
      validateResponse(claim("scalar_int"), { type: "no_answer_possible", reason: "missing source" })
    ).resolves.toBeUndefined();
  });

  test("requires response type to match claim kind", async () => {
    await expect(validateResponse(claim("yes_no"), { type: "scalar_int", value: 1, decimals: 0 })).rejects.toThrow(
      "Response type scalar_int does not match claim kind yes_no"
    );
  });

  test("enforces uint32_multi_value limits", async () => {
    await expect(
      validateResponse(claim("uint32_multi_value"), { type: "uint32_multi_value", values: [1, 2, 3] })
    ).resolves.toBeUndefined();
    await expect(
      validateResponse(claim("uint32_multi_value"), { type: "uint32_multi_value", values: [0, 1, 2, 3, 4, 5, 6, 7] })
    ).rejects.toThrow("supports at most 7 values");
    await expect(
      validateResponse(claim("uint32_multi_value"), { type: "uint32_multi_value", values: [-1] })
    ).rejects.toThrow("Invalid uint32 value");
  });

  test("validates scalar_int payload", async () => {
    await expect(validateResponse(claim("scalar_int"), { type: "scalar_int", value: 100, decimals: 6 })).resolves.toBeUndefined();
    await expect(validateResponse(claim("scalar_int"), { type: "scalar_int", value: 100.5, decimals: 6 })).rejects.toThrow(
      "safe integer"
    );
    await expect(validateResponse(claim("scalar_int"), { type: "scalar_int", value: 100, decimals: 19 })).rejects.toThrow(
      "0 to 18"
    );
  });

  test("validates categorical payload", async () => {
    await expect(validateResponse(claim("categorical"), { type: "categorical", value: "depeg" })).resolves.toBeUndefined();
    await expect(validateResponse(claim("categorical"), { type: "categorical", value: "" })).rejects.toThrow("non-empty");
  });

  test("validates hash_attestation payload", async () => {
    await expect(
      validateResponse(claim("hash_attestation"), { type: "hash_attestation", hash: "a".repeat(64) })
    ).resolves.toBeUndefined();
    await expect(validateResponse(claim("hash_attestation"), { type: "hash_attestation", hash: "bad" })).rejects.toThrow(
      "sha256"
    );
  });
});
