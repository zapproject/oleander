import { Context, Effect, Layer } from "effect";
import { WitnessRoles, type Observation } from "../domain.js";
import { ClaimFeed } from "./claim-feed.js";
import { ConfigService } from "./config.js";
import { OpenClaw } from "./openclaw.js";

export interface CouncilService {
  readonly runAll: Effect.Effect<ReadonlyArray<Observation>, Error>;
  readonly runWitness: Effect.Effect<ReadonlyArray<Observation>, Error>;
}

export class Council extends Context.Tag("Council")<
  Council,
  CouncilService
>() {}

export const CouncilLive = Layer.effect(
  Council,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const feed = yield* ClaimFeed;
    const openclaw = yield* OpenClaw;

    const claimsForPolicy = feed.list.pipe(
      Effect.map((claims) =>
        config.witnessDomain
          ? claims.filter((claim) => claim.domain === config.witnessDomain)
          : claims
      )
    );

    return {
      runAll: Effect.gen(function* () {
        const claims = yield* claimsForPolicy;
        const observations: Observation[] = [];
        for (const claim of claims) {
          for (const role of WitnessRoles) {
            observations.push(yield* openclaw.observe(role, claim));
          }
        }
        return observations;
      }),

      runWitness: Effect.gen(function* () {
        const claims = yield* claimsForPolicy;
        const role = WitnessRoles.find((item) => item.id === "research") ?? WitnessRoles[0]!;
        const observations: Observation[] = [];
        for (const claim of claims) {
          observations.push(yield* openclaw.observe(role, claim));
        }
        return observations;
      })
    };
  })
);
