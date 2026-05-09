import { Context, Effect, Layer } from "effect";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type RuntimeMode = "local" | "production";
export type SignerMode = "dev" | "production";
export type X402Mode = "mock" | "production";

export interface AppConfig {
  readonly runtimeMode: RuntimeMode;
  readonly nodeId: string;
  readonly claimFeedPath: string;
  readonly witnessDomain: string | undefined;
  readonly witnessKinds: ReadonlyArray<string> | undefined;
  readonly claimScanCron: string;
  readonly livenessWatchCron: string;
  readonly claimScanIntervalMs: number;
  readonly x402PaymentHeader: string | undefined;
  readonly deepseekApiKey: string | undefined;
  readonly deepseekBaseUrl: string;
  readonly deepseekModel: string;
  readonly deepseekMock: boolean;
  readonly signerMode: SignerMode;
  readonly x402Mode: X402Mode;
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

const runtimeMode = (value: string | undefined): RuntimeMode =>
  value === "production" ? "production" : "local";

const signerMode = (value: string | undefined): SignerMode =>
  value === "production" ? "production" : "dev";

const x402Mode = (value: string | undefined): X402Mode =>
  value === "production" ? "production" : "mock";

const splitList = (value: string | undefined): ReadonlyArray<string> | undefined => {
  if (!value) return undefined;
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
};

const positiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const validateProductionBoundaries = (config: AppConfig): void => {
  if (config.runtimeMode !== "production") return;

  const violations: string[] = [];
  if (config.deepseekMock) violations.push("DEEPSEEK_MOCK must be disabled");
  if (config.signerMode !== "production") violations.push("ZAP_SIGNER_MODE must be production");
  if (config.x402Mode !== "production") violations.push("X402_MODE must be production");
  if (config.x402PaymentHeader === "mock-paid") violations.push("X402_PAYMENT_HEADER must not be the mock header");

  if (violations.length > 0) {
    throw new Error(`Production runtime cannot use mock/dev boundaries: ${violations.join("; ")}`);
  }
};

export const ConfigLive = Layer.effect(
  ConfigService,
  Effect.sync((): AppConfig => {
    const keyFile = process.env.DEEPSEEK_KEY_FILE ?? "../deepseek.md";

    const config: AppConfig = {
      runtimeMode: runtimeMode(process.env.ZAP_RUNTIME_MODE),
      nodeId: process.env.ZAP_NODE_ID ?? "local-council",
      claimFeedPath: process.env.ZAP_CLAIM_FEED ?? "claims/demo.json",
      witnessDomain: process.env.ZAP_WITNESS_DOMAIN,
      witnessKinds: splitList(process.env.ZAP_WITNESS_KINDS),
      claimScanCron: process.env.ZAP_CLAIM_SCAN_CRON ?? "*/2 * * * *",
      livenessWatchCron: process.env.ZAP_LIVENESS_WATCH_CRON ?? "*/1 * * * *",
      claimScanIntervalMs: positiveInt(process.env.ZAP_CLAIM_SCAN_INTERVAL_MS, 120_000),
      x402PaymentHeader: process.env.X402_PAYMENT_HEADER,
      deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? readKeyFile(keyFile),
      deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro",
      deepseekMock: isEnabled(process.env.DEEPSEEK_MOCK),
      signerMode: signerMode(process.env.ZAP_SIGNER_MODE),
      x402Mode: x402Mode(process.env.X402_MODE)
    };
    validateProductionBoundaries(config);
    return config;
  })
);
