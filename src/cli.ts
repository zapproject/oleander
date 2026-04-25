#!/usr/bin/env node
import { Effect } from "effect";
import { ClaimFeed } from "./services/claim-feed.js";
import { Council } from "./services/council.js";
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
  zap council --once
  zap run --once

Environment:
  DEEPSEEK_API_KEY       DeepSeek API key
  DEEPSEEK_KEY_FILE      Local key file, defaults to ../deepseek.md
  ZAP_NODE_ID            Witness identity label
  ZAP_CLAIM_FEED         Claim feed path, defaults to claims/demo.json
  ZAP_WITNESS_DOMAIN     Optional domain filter, e.g. stablecoins
`);
});

const program: Effect.Effect<void, Error, ClaimFeed | Council> = (() => {
  if (command === "claims" && subcommand === "list") {
    return Effect.gen(function* () {
      const feed = yield* ClaimFeed;
      printJson(yield* feed.list);
    });
  }

  if (command === "council" && args.includes("--once")) {
    return Effect.gen(function* () {
      const council = yield* Council;
      printJson(yield* council.runAll);
    });
  }

  if (command === "run" && args.includes("--once")) {
    return Effect.gen(function* () {
      const council = yield* Council;
      printJson(yield* council.runWitness);
    });
  }

  return help;
})();

Effect.runPromise(Effect.provide(program, AppLayer)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`zap: ${message}\n`);
  process.exitCode = 1;
});
