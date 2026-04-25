import { Context, Effect, Layer } from "effect";
import { createHmac } from "node:crypto";
import { ConfigService } from "./config.js";

export interface SignerService {
  readonly sign: (payload: unknown) => Effect.Effect<string>;
}

export class Signer extends Context.Tag("Signer")<
  Signer,
  SignerService
>() {}

export const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
};

export const SignerLive = Layer.effect(
  Signer,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const devSecret = `zap-dev-${config.nodeId}`;

    return {
      sign: (payload) =>
        Effect.sync(() => createHmac("sha256", devSecret).update(stableJson(payload)).digest("hex"))
    };
  })
);
