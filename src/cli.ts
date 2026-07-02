#!/usr/bin/env bun
import { Effect } from "effect";
import { readFileSync } from "node:fs";
import { WitnessRoles } from "./domain.js";
import { parseCliArgs } from "./cli-parser.js";
import { ClaimFeed } from "./services/claim-feed.js";
import { Council } from "./services/council.js";
import { DeepSeek } from "./services/deepseek.js";
import { Scheduler } from "./services/scheduler.js";
import { ToolCallWitness } from "./services/tool-call-witness.js";
import { x402MockScenario } from "./services/x402-scenario.js";
import { serveX402FacilitatorMock, serveX402ResourceMock } from "./services/x402-mock-server.js";
import { x402WorkReportFromObservations } from "./services/x402-work.js";
import { serveHarnessServer } from "./services/harness-server.js";
import { collectHarnessRunEvents } from "./services/harness-run-engine.js";
import {
  harnessEventsRunArtifact,
  parseHarnessEventsFromRunArtifact,
  verifyRunArtifact,
  writeRunArtifact,
  x402WorkRunArtifact
} from "./services/run-artifact.js";
import { reduceUiCockpitState } from "./services/ui-cockpit-state.js";
import { renderUiCockpit } from "./services/ui-cockpit-renderer.js";
import { AppLayer } from "./runtime.js";

const args = process.argv.slice(2);

const printJson = (value: unknown) => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const printArtifactPath = (filePath: string) => {
  process.stderr.write(`Artifact: ${filePath}\n`);
};

const help = Effect.sync(() => {
  process.stdout.write(`Oleander CLI

Commands:
  oleander
  oleander --once
  oleander claims list
  oleander deepseek smoke
  oleander harness serve
  oleander runs replay <file>
  oleander headless run --once
  oleander headless runs verify <file>
  oleander roles list
  oleander x402 scenario
  oleander x402 work --once
  oleander x402 serve facilitator
  oleander x402 serve resource
  oleander council hello
  oleander council --once
  oleander council --role <role-id> --once
  oleander run --once
  oleander run --daemon [--ticks n]

Environment:
  DEEPSEEK_API_KEY       DeepSeek API key
  DEEPSEEK_KEY_FILE      Local key file, defaults to ../deepseek.md
  ZAP_NODE_ID            Witness identity label
  ZAP_CLAIM_FEED         Claim feed path, defaults to claims/demo.json
  ZAP_WITNESS_DOMAIN     Optional domain filter, e.g. stablecoins
  OUSD_SPONSOR_ID        Sponsor account label, defaults to sponsor:local
  OUSD_RUN_BUDGET_ATOMIC Optional OUSD run budget in atomic units
`);
});

const collectLocalHarnessEvents = Effect.gen(function* () {
  const feed = yield* ClaimFeed;
  const toolCallWitness = yield* ToolCallWitness;
  const claims = yield* feed.list;
  const role = WitnessRoles.find((item) => item.id === "research") ?? WitnessRoles[0]!;
  const nodeId = process.env.ZAP_NODE_ID ?? "local-council";
  return yield* Effect.tryPromise({
    try: () =>
      collectHarnessRunEvents({
        runId: `run:harness:${Date.now()}`,
        claims,
        witness: {
          nodeId,
          witnessRole: role.id,
          observe: ({ claim }) => Effect.runPromise(toolCallWitness.observe(role, claim))
        },
        payoutPerObservationAtomic: process.env.X402_BOUNTY_ATOMIC,
        sponsorAccountId: process.env.OUSD_SPONSOR_ID,
        sponsorBudgetAtomic: process.env.OUSD_RUN_BUDGET_ATOMIC
      }),
    catch: (error) => error instanceof Error ? error : new Error(String(error))
  });
});

const program: Effect.Effect<void, Error, ClaimFeed | Council | DeepSeek | Scheduler | ToolCallWitness> = Effect.try({
  try: () => parseCliArgs(args),
  catch: (error) => (error instanceof Error ? error : new Error(String(error)))
}).pipe(
  Effect.flatMap((command): Effect.Effect<void, Error, ClaimFeed | Council | DeepSeek | Scheduler | ToolCallWitness> => {
    if (command.type === "ui") {
      return Effect.gen(function* () {
        const events = yield* collectLocalHarnessEvents;
        printArtifactPath(writeRunArtifact(harnessEventsRunArtifact(events, { claimFeedPath: process.env.ZAP_CLAIM_FEED })));
        process.stdout.write(renderUiCockpit(reduceUiCockpitState(events)));
      });
    }

    if (command.type === "harnessServe") {
      return Effect.sync(() =>
        serveHarnessServer({
          port: Number(process.env.ZAP_HARNESS_PORT ?? 5174),
          claimFeedPath: process.env.ZAP_SPONSORED_CLAIM_FEED ?? "claims/x402-fifty-claims.json",
          eventDelayMs: Number(process.env.ZAP_HARNESS_EVENT_DELAY_MS ?? 75),
          autoRunIntervalMs: Number(process.env.ZAP_HARNESS_AUTO_RUN_MS ?? 180_000)
        })
      ).pipe(Effect.zipRight(Effect.never));
    }

    if (command.type === "headlessRunOnce") {
      return Effect.gen(function* () {
        const events = yield* collectLocalHarnessEvents;
        printArtifactPath(writeRunArtifact(harnessEventsRunArtifact(events, { claimFeedPath: process.env.ZAP_CLAIM_FEED })));
        printJson(events);
      });
    }

    if (command.type === "claimsList") {
      return Effect.gen(function* () {
        const feed = yield* ClaimFeed;
        printJson(yield* feed.list);
      });
    }

    if (command.type === "rolesList") {
      return Effect.sync(() => printJson(WitnessRoles));
    }

    if (command.type === "x402Scenario") {
      return Effect.sync(() => printJson(x402MockScenario));
    }

    if (command.type === "x402WorkOnce") {
      return Effect.gen(function* () {
        const council = yield* Council;
        const observations = yield* council.runWitness;
        const report = x402WorkReportFromObservations(observations, {
          sponsorId: process.env.X402_SPONSOR_ID,
          bountyPerObservationAtomic: process.env.X402_BOUNTY_ATOMIC,
          zapRewardPerObservationAtomic: process.env.ZAP_REWARD_ATOMIC
        });
        printArtifactPath(writeRunArtifact(x402WorkRunArtifact(report, { claimFeedPath: process.env.ZAP_CLAIM_FEED })));
        printJson(report);
      });
    }

    if (command.type === "x402ServeFacilitator") {
      return Effect.sync(() => serveX402FacilitatorMock(Number(process.env.X402_FACILITATOR_PORT ?? 8403))).pipe(
        Effect.zipRight(Effect.never)
      );
    }

    if (command.type === "x402ServeResource") {
      return Effect.sync(() =>
        serveX402ResourceMock({
          port: Number(process.env.X402_RESOURCE_PORT ?? 8404),
          claimFeedPath: process.env.ZAP_CLAIM_FEED ?? "claims/x402-mock.json",
          paymentHeader: process.env.X402_PAYMENT_HEADER ?? "mock-paid"
        })
      ).pipe(Effect.zipRight(Effect.never));
    }

    if (command.type === "deepseekSmoke") {
      return Effect.gen(function* () {
        const deepseek = yield* DeepSeek;
        printJson({ ok: true, message: yield* deepseek.smoke });
      });
    }

    if (command.type === "councilHello") {
      return Effect.gen(function* () {
        const council = yield* Council;
        printJson(yield* council.hello);
      });
    }

    if (command.type === "councilOnce") {
      return Effect.gen(function* () {
        const council = yield* Council;
        if (command.roleId) {
          printJson(yield* council.runRole(command.roleId));
        } else {
          printJson(yield* council.runAll);
        }
      });
    }

    if (command.type === "runOnce") {
      return Effect.gen(function* () {
        const council = yield* Council;
        printJson(yield* council.runWitness);
      });
    }

    if (command.type === "runDaemon") {
      return Effect.gen(function* () {
        const council = yield* Council;
        const scheduler = yield* Scheduler;
        const schedule = yield* scheduler.schedule;
        const ticks = command.ticks;
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

    if (command.type === "runsReplay") {
      return Effect.sync(() => {
        const artifact = JSON.parse(readFileSync(command.filePath, "utf8")) as unknown;
        const events = parseHarnessEventsFromRunArtifact(artifact);
        const errors = verifyRunArtifact(artifact).errors;
        if (errors.length > 0) {
          throw new Error(`Invalid run artifact: ${errors.join("; ")}`);
        }
        process.stdout.write(renderUiCockpit(reduceUiCockpitState(events)));
      });
    }

    if (command.type === "runsVerify") {
      return Effect.sync(() => {
        const artifact = JSON.parse(readFileSync(command.filePath, "utf8")) as unknown;
        const result = verifyRunArtifact(artifact);
        printJson(result);
        if (!result.ok) process.exitCode = 1;
      });
    }

    return help;
  })
);

Effect.runPromise(Effect.provide(program, AppLayer)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`zap: ${message}\n`);
  process.exitCode = 1;
});
