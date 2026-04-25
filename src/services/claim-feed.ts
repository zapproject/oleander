import { Context, Effect, Layer } from "effect";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ClaimSpec } from "../domain.js";
import { ConfigService } from "./config.js";

export interface ClaimFeedService {
  readonly list: Effect.Effect<ReadonlyArray<ClaimSpec>, Error>;
}

export class ClaimFeed extends Context.Tag("ClaimFeed")<
  ClaimFeed,
  ClaimFeedService
>() {}

const parseClaimFeed = (raw: string): ReadonlyArray<ClaimSpec> => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Claim feed must be a JSON array");
  }
  return parsed.map((item) => {
    const claim = item as Partial<ClaimSpec>;
    if (!claim.id || !claim.kind || !claim.domain || !claim.statement) {
      throw new Error("Claim is missing required fields");
    }
    return {
      id: claim.id,
      kind: claim.kind,
      domain: claim.domain,
      statement: claim.statement,
      sources: Array.isArray(claim.sources) ? claim.sources : [],
      livenessSeconds: Number(claim.livenessSeconds ?? 300)
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
