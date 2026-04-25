import { describe, expect, test } from "bun:test";
import type { ClaimSpec } from "../domain.js";
import { chooseAdapter, evidenceHash, normalizeEvidence } from "./evidence.js";

const claim = (kind: ClaimSpec["kind"]): ClaimSpec => ({
  id: `claim:test:${kind}`,
  kind,
  domain: "stablecoins",
  statement: "A typed claim with enough statement length.",
  sources: ["https://example.com"],
  livenessSeconds: 60
});

describe("evidenceHash", () => {
  test("hashes content deterministically", () => {
    expect(evidenceHash("hello")).toBe(evidenceHash("hello"));
    expect(evidenceHash("hello")).not.toBe(evidenceHash("world"));
  });
});

describe("chooseAdapter", () => {
  test("uses hash-document for hash claims", () => {
    expect(chooseAdapter(claim("hash_attestation"), "https://example.com/report.pdf")).toBe("hash-document");
  });

  test("uses price-feed for price sources", () => {
    expect(chooseAdapter(claim("yes_no"), "https://www.coingecko.com/en/coins/usd-coin")).toBe("price-feed");
  });

  test("falls back to http", () => {
    expect(chooseAdapter(claim("categorical"), "https://example.com/event")).toBe("http");
  });
});

describe("normalizeEvidence", () => {
  test("returns hash-addressable normalized evidence", () => {
    const evidence = normalizeEvidence({
      uri: "https://example.com",
      adapter: "http",
      content: "hello world",
      contentType: "text/plain",
      status: 200,
      observedAt: "2026-01-01T00:00:00.000Z"
    });

    expect(evidence.ok).toBe(true);
    expect(evidence.hash).toBe(evidenceHash("hello world"));
    expect(evidence.bytes).toBe(11);
    expect(evidence.snippet).toBe("hello world");
  });
});
