import { Context, Effect, Layer } from "effect";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface AppConfig {
  readonly nodeId: string;
  readonly claimFeedPath: string;
  readonly witnessDomain: string | undefined;
  readonly deepseekApiKey: string | undefined;
  readonly deepseekBaseUrl: string;
  readonly deepseekModel: string;
  readonly deepseekMock: boolean;
}

export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  AppConfig
>() {}

export const extractDeepSeekApiKey = (raw: string): string | undefined => {
  const envLike = raw.match(/DEEPSEEK_API_KEY\s*=\s*["']?([A-Za-z0-9_\-\.]+)["']?/);
  if (envLike?.[1]) return envLike[1];

  const skLike = raw.match(/(sk-[A-Za-z0-9_\-\.]+)/);
  if (skLike?.[1]) return skLike[1];

  const trimmed = raw.trim();
  return trimmed.length > 0 && !trimmed.includes("\n") ? trimmed : undefined;
};

const readKeyFile = (path: string | undefined): string | undefined => {
  if (!path) return undefined;
  const absolute = resolve(process.cwd(), path);
  if (!existsSync(absolute)) return undefined;
  return extractDeepSeekApiKey(readFileSync(absolute, "utf8"));
};

const isEnabled = (value: string | undefined): boolean =>
  value === "1" || value === "true" || value === "yes";

export const ConfigLive = Layer.effect(
  ConfigService,
  Effect.sync((): AppConfig => {
    const keyFile = process.env.DEEPSEEK_KEY_FILE ?? "../deepseek.md";

    return {
      nodeId: process.env.ZAP_NODE_ID ?? "local-council",
      claimFeedPath: process.env.ZAP_CLAIM_FEED ?? "claims/demo.json",
      witnessDomain: process.env.ZAP_WITNESS_DOMAIN,
      deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? readKeyFile(keyFile),
      deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      deepseekMock: isEnabled(process.env.DEEPSEEK_MOCK)
    };
  })
);
