import { Context, Effect, Layer } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isClaimKind, type ClaimSpec } from "../domain.js";
import { ConfigService } from "./config.js";

export interface ClaimFeedService {
  readonly list: Effect.Effect<ReadonlyArray<ClaimSpec>, Error>;
}

export class ClaimFeed extends Context.Tag("ClaimFeed")<
  ClaimFeed,
  ClaimFeedService
>() {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireString = (claim: Record<string, unknown>, index: number, field: string): string => {
  const value = claim[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Claim feed item ${index} field '${field}' must be a non-empty string`);
  }
  return value;
};

const requireSources = (claim: Record<string, unknown>, index: number): ReadonlyArray<string> => {
  const value = claim.sources;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Claim feed item ${index} field 'sources' must be a non-empty string array`);
  }
  for (const [sourceIndex, source] of value.entries()) {
    if (typeof source !== "string" || source.trim().length === 0) {
      throw new Error(`Claim feed item ${index} source ${sourceIndex} must be a non-empty string`);
    }
  }
  return value;
};

const requireLiveness = (claim: Record<string, unknown>, index: number): number => {
  const value = claim.livenessSeconds;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Claim feed item ${index} field 'livenessSeconds' must be a positive integer`);
  }
  return value;
};

export const parseClaimFeed = (raw: string): ReadonlyArray<ClaimSpec> => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Claim feed must be a JSON array");
  }
  return parsed.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Claim feed item ${index} must be an object`);
    }

    const kind = item.kind;
    if (!isClaimKind(kind)) {
      throw new Error(`Claim feed item ${index} field 'kind' is unsupported`);
    }

    return {
      id: requireString(item, index, "id"),
      kind,
      domain: requireString(item, index, "domain"),
      statement: requireString(item, index, "statement"),
      sources: requireSources(item, index),
      livenessSeconds: requireLiveness(item, index)
    };
  });
};

export const ClaimFeedLive = Layer.effect(
  ClaimFeed,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    return {
      list: Effect.try({
        try: () => parseClaimFeed(readFileSync(resolve(process.cwd(), config.claimFeedPath), "utf8")),
        catch: (error) => error instanceof Error ? error : new Error(String(error))
      })
    };
  })
);
