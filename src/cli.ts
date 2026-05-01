#!/usr/bin/env bun
import { Effect } from "effect";
import { WitnessRoles, type WitnessRoleId } from "./domain.js";
import { ClaimFeed } from "./services/claim-feed.js";
import { Council } from "./services/council.js";
import { DeepSeek } from "./services/deepseek.js";
import { Scheduler } from "./services/scheduler.js";
import { x402MockScenario } from "./services/x402-scenario.js";
import { serveX402FacilitatorMock, serveX402ResourceMock } from "./services/x402-mock-server.js";
import { x402WorkReportFromObservations } from "./services/x402-work.js";
import { runTuiHarness } from "./services/tui-harness.js";
import { serveHarnessServer } from "./services/harness-server.js";
import { AppLayer } from "./runtime.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";
const subcommand = args[1];

const printJson = (value: unknown) => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const help = Effect.sync(() => {
  process.stdout.write(`ZAP Witness Council CLI

Commands:
  zap claims list
  zap deepseek smoke
  zap harness serve
  zap roles list
  zap tui [--run]
  zap x402 scenario
  zap x402 work --once
  zap x402 serve facilitator
  zap x402 serve resource
  zap council hello
  zap council --once
  zap council --role <role-id> --once
  zap run --once
  zap run --daemon [--ticks n]

Environment:
  DEEPSEEK_API_KEY       DeepSeek API key
  DEEPSEEK_KEY_FILE      Local key file, defaults to ../deepseek.md
  ZAP_NODE_ID            Witness identity label
  ZAP_CLAIM_FEED         Claim feed path, defaults to claims/demo.json
  ZAP_WITNESS_DOMAIN     Optional domain filter, e.g. stablecoins
`);
});

const readFlag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
};

const isWitnessRoleId = (value: string): value is WitnessRoleId =>
  WitnessRoles.some((role) => role.id === value);

const readPositiveIntFlag = (name: string): number | undefined => {
  const value = readFlag(name);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const program: Effect.Effect<void, Error, ClaimFeed | Council | DeepSeek | Scheduler> = (() => {
  if (command === "tui") {
    return Effect.promise(() => runTuiHarness({ autoRun: args.includes("--run"), verbose: args.includes("--verbose") }));
  }

  if (command === "harness" && subcommand === "serve") {
    return Effect.sync(() =>
      serveHarnessServer({
        port: Number(process.env.ZAP_HARNESS_PORT ?? 5174),
        claimFeedPath: process.env.ZAP_SPONSORED_CLAIM_FEED ?? "claims/x402-fifty-claims.json",
        eventDelayMs: Number(process.env.ZAP_HARNESS_EVENT_DELAY_MS ?? 75),
        autoRunIntervalMs: Number(process.env.ZAP_HARNESS_AUTO_RUN_MS ?? 180_000)
      })
    ).pipe(Effect.zipRight(Effect.never));
  }

  if (command === "claims" && subcommand === "list") {
    return Effect.gen(function* () {
      const feed = yield* ClaimFeed;
      printJson(yield* feed.list);
    });
  }

  if (command === "roles" && subcommand === "list") {
    return Effect.sync(() => printJson(WitnessRoles));
  }

  if (command === "x402" && subcommand === "scenario") {
    return Effect.sync(() => printJson(x402MockScenario));
  }

  if (command === "x402" && subcommand === "work" && args.includes("--once")) {
    return Effect.gen(function* () {
      const council = yield* Council;
      const observations = yield* council.runWitness;
      printJson(x402WorkReportFromObservations(observations, {
        sponsorId: process.env.X402_SPONSOR_ID,
        bountyPerObservationAtomic: process.env.X402_BOUNTY_ATOMIC,
        zapRewardPerObservationAtomic: process.env.ZAP_REWARD_ATOMIC
      }));
    });
  }

  if (command === "x402" && subcommand === "serve" && args[2] === "facilitator") {
    return Effect.sync(() => serveX402FacilitatorMock(Number(process.env.X402_FACILITATOR_PORT ?? 8403))).pipe(
      Effect.zipRight(Effect.never)
    );
  }

  if (command === "x402" && subcommand === "serve" && args[2] === "resource") {
    return Effect.sync(() =>
      serveX402ResourceMock({
        port: Number(process.env.X402_RESOURCE_PORT ?? 8404),
        claimFeedPath: process.env.ZAP_CLAIM_FEED ?? "claims/x402-mock.json",
        paymentHeader: process.env.X402_PAYMENT_HEADER ?? "mock-paid"
      })
    ).pipe(Effect.zipRight(Effect.never));
  }

  if (command === "deepseek" && subcommand === "smoke") {
    return Effect.gen(function* () {
      const deepseek = yield* DeepSeek;
      printJson({ ok: true, message: yield* deepseek.smoke });
    });
  }

  if (command === "council" && subcommand === "hello") {
    return Effect.gen(function* () {
      const council = yield* Council;
      printJson(yield* council.hello);
    });
  }

  if (command === "council" && args.includes("--once")) {
    return Effect.gen(function* () {
      const council = yield* Council;
      const roleId = readFlag("--role");
      if (roleId) {
        if (!isWitnessRoleId(roleId)) {
          throw new Error(`Unknown witness role: ${roleId}`);
        }
        printJson(yield* council.runRole(roleId));
      } else {
        printJson(yield* council.runAll);
      }
    });
  }

  if (command === "run" && args.includes("--once")) {
    return Effect.gen(function* () {
      const council = yield* Council;
      printJson(yield* council.runWitness);
    });
  }

  if (command === "run" && args.includes("--daemon")) {
    return Effect.gen(function* () {
      const council = yield* Council;
      const scheduler = yield* Scheduler;
      const schedule = yield* scheduler.schedule;
      const ticks = readPositiveIntFlag("--ticks");
      let count = 0;
      while (ticks === undefined || count < ticks) {
        printJson({
          type: "witness_tick",
          tick: count + 1,
          schedule,
          observations: yield* council.runWitness
        });
        count += 1;
        if (ticks === undefined || count < ticks) {
          yield* scheduler.sleep(schedule.claimScanIntervalMs);
        }
      }
    });
  }

  return help;
})();

Effect.runPromise(Effect.provide(program, AppLayer)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`zap: ${message}\n`);
  process.exitCode = 1;
});
