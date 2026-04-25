import { Context, Effect, Layer } from "effect";
import { ConfigService } from "./config.js";

export interface WitnessSchedule {
  readonly claimScanCron: string;
  readonly livenessWatchCron: string;
  readonly claimScanIntervalMs: number;
}

export interface SchedulerService {
  readonly schedule: Effect.Effect<WitnessSchedule>;
  readonly sleep: (ms: number) => Effect.Effect<void>;
}

export class Scheduler extends Context.Tag("Scheduler")<
  Scheduler,
  SchedulerService
>() {}

export const parseCronMinuteInterval = (cron: string): number | undefined => {
  const match = cron.trim().match(/^\*\/([1-9][0-9]*) \* \* \* \*$/);
  if (!match) return undefined;
  return Number(match[1]) * 60_000;
};

export const SchedulerLive = Layer.effect(
  Scheduler,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    return {
      schedule: Effect.succeed({
        claimScanCron: config.claimScanCron,
        livenessWatchCron: config.livenessWatchCron,
        claimScanIntervalMs: parseCronMinuteInterval(config.claimScanCron) ?? config.claimScanIntervalMs
      }),
      sleep: (ms) => Effect.promise(() => new Promise<void>((resolve) => setTimeout(resolve, ms)))
    };
  })
);
