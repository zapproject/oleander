import { Context, Effect, Layer } from "effect";
import { WitnessRoles, type CouncilHelloTurn, type Observation, type WitnessRoleId } from "../domain.js";
import { ClaimFeed } from "./claim-feed.js";
import { ConfigService } from "./config.js";
import { DeepSeek } from "./deepseek.js";
import { OpenClaw } from "./openclaw.js";

export interface CouncilService {
  readonly hello: Effect.Effect<ReadonlyArray<CouncilHelloTurn>, Error>;
  readonly runAll: Effect.Effect<ReadonlyArray<Observation>, Error>;
  readonly runRole: (roleId: WitnessRoleId) => Effect.Effect<ReadonlyArray<Observation>, Error>;
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
    const deepseek = yield* DeepSeek;
    const openclaw = yield* OpenClaw;

    const claimsForPolicy = feed.list.pipe(
      Effect.map((claims) =>
        config.witnessDomain
          ? claims.filter((claim) => claim.domain === config.witnessDomain)
          : claims
      )
    );

    return {
      hello: Effect.gen(function* () {
        const helloRoles = WitnessRoles.filter((role) =>
          role.id === "high" || role.id === "law" || role.id === "research"
        );
        const turns: CouncilHelloTurn[] = [];
        for (const role of helloRoles) {
          const prompt = [
            "Run a ZAP Witness Council hello-world turn.",
            "This is not settlement and not a truth claim.",
            `You are ${role.title}.`,
            `Responsibility: ${role.responsibility}.`,
            "In 3 short bullets, state what your role would contribute to a stablecoin claim workflow and hand off to the next council role."
          ].join("\n");
          turns.push({
            witnessRole: role.id,
            title: role.title,
            model: config.deepseekModel,
            prompt,
            output: yield* deepseek.complete([
              {
                role: "system",
                content: "You are one role inside the ZAP Witness Council multi-agent CLI harness. Be concrete and concise."
              },
              { role: "user", content: prompt }
            ]),
            observedAt: new Date().toISOString()
          });
        }
        return turns;
      }),

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

      runRole: (roleId) =>
        Effect.gen(function* () {
          const role = WitnessRoles.find((item) => item.id === roleId);
          if (!role) throw new Error(`Unknown witness role: ${roleId}`);

          const claims = yield* claimsForPolicy;
          const observations: Observation[] = [];
          for (const claim of claims) {
            observations.push(yield* openclaw.observe(role, claim));
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
