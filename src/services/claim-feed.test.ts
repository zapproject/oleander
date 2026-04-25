import { describe, expect, test } from "bun:test";
import type { ClaimSpec } from "../domain.js";
import { parseClaimFeed } from "./claim-feed.js";

const validClaim: ClaimSpec = {
  id: "claim:test:001",
  kind: "yes_no",
  domain: "stablecoins",
  statement: "USDC stayed inside the configured peg tolerance.",
  sources: ["https://example.com/price"],
  livenessSeconds: 60
};

describe("parseClaimFeed", () => {
  test("parses a valid claim feed", () => {
    expect(parseClaimFeed(JSON.stringify([validClaim]))).toEqual([validClaim]);
  });

  test("requires the feed to be an array", () => {
    expect(() => parseClaimFeed(JSON.stringify(validClaim))).toThrow("Claim feed must be a JSON array");
  });

  test("rejects unsupported claim kinds", () => {
    expect(() =>
      parseClaimFeed(JSON.stringify([{ ...validClaim, kind: "free_text" }]))
    ).toThrow("field 'kind' is unsupported");
  });

  test("requires non-empty sources", () => {
    expect(() =>
      parseClaimFeed(JSON.stringify([{ ...validClaim, sources: [] }]))
    ).toThrow("field 'sources' must be a non-empty string array");
  });

  test("requires positive integer liveness", () => {
    expect(() =>
      parseClaimFeed(JSON.stringify([{ ...validClaim, livenessSeconds: 0 }]))
    ).toThrow("field 'livenessSeconds' must be a positive integer");
  });
});
