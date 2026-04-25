import { Context, Effect, Layer } from "effect";
import { createHash } from "node:crypto";
import type { ClaimSpec, EvidenceAdapterKind, EvidenceRecord } from "../domain.js";

export interface EvidenceService {
  readonly collect: (claim: ClaimSpec) => Effect.Effect<ReadonlyArray<EvidenceRecord>, Error>;
}

export class Evidence extends Context.Tag("Evidence")<
  Evidence,
  EvidenceService
>() {}

export const evidenceHash = (content: string): string =>
  createHash("sha256").update(content).digest("hex");

export const chooseAdapter = (claim: ClaimSpec, uri: string): EvidenceAdapterKind => {
  const normalized = uri.toLowerCase();
  if (claim.kind === "hash_attestation") return "hash-document";
  if (normalized.includes("price") || normalized.includes("coingecko") || normalized.includes("coinbase")) {
    return "price-feed";
  }
  return "http";
};

const snippet = (content: string): string =>
  content.replace(/\s+/g, " ").trim().slice(0, 1000);

export const normalizeEvidence = (input: {
  readonly uri: string;
  readonly adapter: EvidenceAdapterKind;
  readonly content: string;
  readonly contentType?: string | undefined;
  readonly status?: number | undefined;
  readonly observedAt?: string | undefined;
}): EvidenceRecord => ({
  uri: input.uri,
  adapter: input.adapter,
  ok: true,
  hash: evidenceHash(input.content),
  contentType: input.contentType,
  status: input.status,
  bytes: new TextEncoder().encode(input.content).byteLength,
  snippet: snippet(input.content),
  error: undefined,
  observedAt: input.observedAt ?? new Date().toISOString()
});

const failedEvidence = (
  uri: string,
  adapter: EvidenceAdapterKind,
  error: string
): EvidenceRecord => ({
  uri,
  adapter,
  ok: false,
  hash: evidenceHash(error),
  contentType: undefined,
  status: undefined,
  bytes: 0,
  snippet: "",
  error,
  observedAt: new Date().toISOString()
});

const fetchSource = async (claim: ClaimSpec, uri: string): Promise<EvidenceRecord> => {
  const adapter = chooseAdapter(claim, uri);
  if (uri.startsWith("local-evidence://")) {
    return normalizeEvidence({
      uri,
      adapter,
      content: `${claim.id}\n${claim.statement}`,
      contentType: "text/plain"
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(uri, {
      signal: controller.signal,
      headers: {
        "user-agent": "zap-oleander-witness/0.1"
      }
    });
    const content = await response.text();
    return normalizeEvidence({
      uri,
      adapter,
      content,
      contentType: response.headers.get("content-type") ?? undefined,
      status: response.status
    });
  } catch (error) {
    return failedEvidence(uri, adapter, error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timeout);
  }
};

export const EvidenceLive = Layer.succeed(Evidence, {
  collect: (claim) =>
    Effect.tryPromise({
      try: async () => Promise.all(claim.sources.map((uri) => fetchSource(claim, uri))),
      catch: (error) => error instanceof Error ? error : new Error(String(error))
    })
});
