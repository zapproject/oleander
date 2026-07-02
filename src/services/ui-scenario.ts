import {
  activeRegime,
  applyStructuredOutput,
  defaultHarnessEnv,
  harnessRegimes,
  isRawJsonLine,
  pushLog,
  pushVerboseLog,
  resetSteps,
  statusGlyph,
  x402HarnessSteps,
  type HarnessState,
  type HarnessStepStatus,
  type StepState
} from "./ui-scenario-core.js";
import { runHarnessProcess } from "./ui-scenario-process.js";
import { uiScenarioRunArtifact, writeRunArtifact } from "./run-artifact.js";

export {
  defaultHarnessEnv,
  extractJsonValues,
  harnessRegimes,
  statusGlyph,
  summarizeHarnessOutput,
  x402HarnessSteps,
  type ClaimSummary,
  type HarnessRegime,
  type HarnessRegimeId,
  type HarnessStep,
  type HarnessStepStatus,
  type OracleReportSummary
} from "./ui-scenario-core.js";

const color = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m"
};

const paint = (value: string, code: string): string =>
  process.stdout.isTTY ? `${code}${value}${color.reset}` : value;

const statusText = (status: HarnessStepStatus): string => {
  const glyph = statusGlyph(status);
  if (status === "passed") return paint(glyph, color.green);
  if (status === "running") return paint(glyph, color.yellow);
  if (status === "failed") return paint(glyph, color.red);
  return paint(glyph, color.dim);
};

const write = (value: string) => {
  process.stdout.write(value);
};

const render = (state: HarnessState) => {
  write("\x1b[2J\x1b[H");
  write(`${paint("ZAP x402 Oracle Harness", `${color.bold}${color.cyan}`)}\n`);
  write(`${paint("Sponsor -> paid feed -> oracle workers -> signed work -> OUSD/ZAP receipts", color.dim)}\n\n`);
  write(`Run: ${state.runCount}  State: ${state.running ? "running" : "idle"}\n`);
  write(`Regime: ${activeRegime(state).label}\n`);
  write(`Output: ${state.showVerbose ? "verbose raw tail" : "summary"}\n`);
  write(`Sponsor: ${defaultHarnessEnv.X402_SPONSOR_ID}\n`);
  write(`Claim feed: ${defaultHarnessEnv.ZAP_SPONSORED_CLAIM_FEED}\n`);
  write(`Incentive: ${defaultHarnessEnv.X402_BOUNTY_ATOMIC} OUSD atomic + ${defaultHarnessEnv.ZAP_REWARD_ATOMIC} ZAP atomic per observation\n\n`);

  write("Steps\n");
  for (const step of state.steps) {
    const exit = step.exitCode === undefined ? "" : ` exit=${step.exitCode}`;
    write(` ${statusText(step.status)} ${step.label}${exit}\n`);
  }

  write("\nRegimes\n");
  for (const [index, regime] of harnessRegimes.entries()) {
    const marker = index === state.selectedRegime ? ">" : " ";
    write(` ${marker} ${index + 1}. ${regime.label}\n`);
  }

  write("\nClaims\n");
  if (state.claims.length === 0) {
    write(` ${paint("No sponsored claims parsed yet.", color.dim)}\n`);
  } else {
    const byDomain = new Map<string, number>();
    const byKind = new Map<string, number>();
    for (const claim of state.claims) {
      byDomain.set(claim.domain, (byDomain.get(claim.domain) ?? 0) + 1);
      byKind.set(claim.kind, (byKind.get(claim.kind) ?? 0) + 1);
    }
    write(` Total: ${state.claims.length}  Domains: ${[...byDomain].map(([key, value]) => `${key}:${value}`).join(" ")}  Kinds: ${[...byKind].map(([key, value]) => `${key}:${value}`).join(" ")}\n`);
    for (const claim of state.claims.slice(0, 14)) {
      write(` - ${claim.id} [${claim.domain}/${claim.kind}]\n`);
    }
    if (state.claims.length > 14) write(` ${paint(`... ${state.claims.length - 14} more claims`, color.dim)}\n`);
  }

  write("\nOracle Incentives\n");
  if (state.reports.length === 0) {
    write(` ${paint("No oracle receipt reports parsed yet.", color.dim)}\n`);
  } else {
    const totalObservations = state.reports.reduce((sum, report) => sum + report.observationCount, 0);
    const totalStablecoin = state.reports.reduce((sum, report) => sum + BigInt(report.stablecoinAtomic), 0n);
    const totalZap = state.reports.reduce((sum, report) => sum + BigInt(report.zapAtomic), 0n);
    write(` Total: ${totalObservations} observations, ${totalStablecoin.toString()} OUSD atomic, ${totalZap.toString()} ZAP atomic\n`);
    for (const report of state.reports) {
      write(` - ${report.nodeId}: ${report.observationCount} obs | ${report.stablecoinAtomic} OUSD atomic | ${report.zapAtomic} ZAP atomic\n`);
      const visibleClaims = report.claimIds.slice(0, 6).join(", ");
      const remaining = report.claimIds.length > 6 ? ` ... +${report.claimIds.length - 6}` : "";
      write(`   claims: ${visibleClaims}${remaining}\n`);
    }
  }

  write(`\n${state.showVerbose ? "Verbose Output" : "Live Log"}\n`);
  const activeLogs = state.showVerbose ? state.verboseLogs : state.logs;
  for (const line of activeLogs.slice(state.showVerbose ? -18 : -8)) {
    write(` ${line}\n`);
  }
  write(`\n${paint("Keys: 1-6 select regime | r run/rerun | v verbose | c cleanup | q quit | Ctrl-C exit", color.dim)}\n`);
};

const runCommand = async (
  step: StepState,
  state: HarnessState,
  env: NodeJS.ProcessEnv
): Promise<number> => {
  step.status = "running";
  step.exitCode = undefined;
  const commandLine = `$ ${step.command} ${step.args.join(" ")}`;
  pushLog(state, commandLine);
  pushVerboseLog(state, commandLine);
  render(state);

  const result = await runHarnessProcess(step, env, {
    onStdout: (text) => {
      for (const line of text.split(/\r?\n/)) {
        pushVerboseLog(state, line);
        if (!isRawJsonLine(line)) pushLog(state, line);
      }
      render(state);
    },
    onStderr: (text) => {
      for (const line of text.split(/\r?\n/)) {
        pushVerboseLog(state, line);
        pushLog(state, line);
      }
      render(state);
    },
    onError: (error) => {
      pushLog(state, `process error: ${error.message}`);
      pushVerboseLog(state, `process error: ${error.message}`);
      render(state);
    }
  });

  step.status = result.exitCode === 0 ? "passed" : "failed";
  step.exitCode = result.exitCode;
  if (result.exitCode === 0) applyStructuredOutput(state, step, result.stdout);
  render(state);
  return result.exitCode;
};

const cleanup = async (state: HarnessState, env: NodeJS.ProcessEnv) => {
  const cleanupStep = x402HarnessSteps().find((step) => step.id === "cleanup");
  if (!cleanupStep) return;
  const step: StepState = { ...cleanupStep, status: "pending", exitCode: undefined };
  await runCommand(step, state, env);
};

const runScenario = async (state: HarnessState, env: NodeJS.ProcessEnv) => {
  if (state.running) return;
  state.running = true;
  state.runCount += 1;
  state.logs = ["starting sponsor/oracle run"];
  state.verboseLogs = ["starting sponsor/oracle run"];
  state.claims = [];
  state.reports = [];
  state.steps = resetSteps(state);
  render(state);

  let failed = false;
  for (const step of state.steps) {
    const exitCode = await runCommand(step, state, env);
    if (exitCode !== 0) {
      failed = true;
      break;
    }
  }

  if (failed) {
    pushLog(state, "failure detected; cleaning up stack");
    await cleanup(state, env);
  }
  state.running = false;
  writeRunArtifact(uiScenarioRunArtifact(state, {
    claimFeedPath: env.ZAP_SPONSORED_CLAIM_FEED,
    errors: failed ? ["failure detected; cleanup attempted"] : undefined
  }));
  render(state);
};

export const runUiScenario = async (options?: { readonly autoRun?: boolean; readonly verbose?: boolean }) => {
  const env = {
    ...process.env,
    ...Object.fromEntries(
      Object.entries(defaultHarnessEnv).map(([key, value]) => [key, process.env[key] ?? value])
    )
  };

  const state: HarnessState = {
    running: false,
    runCount: 0,
    selectedRegime: 0,
    showVerbose: options?.verbose ?? false,
    logs: ["ready"],
    verboseLogs: ["ready"],
    steps: [],
    claims: [],
    reports: []
  };
  state.steps = resetSteps(state);

  render(state);

  if (!process.stdin.isTTY || options?.autoRun) {
    await runScenario(state, env);
    return;
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (key) => {
    if (key === "\u0003" || key === "q") {
      void cleanup(state, env).finally(() => {
        write("\x1b[2J\x1b[H");
        process.exit(0);
      });
      return;
    }
    if (key === "r") void runScenario(state, env);
    if (key === "c") void cleanup(state, env);
    if (key === "v") {
      state.showVerbose = !state.showVerbose;
      render(state);
    }
    const regimeIndex = Number(key) - 1;
    if (!state.running && Number.isInteger(regimeIndex) && harnessRegimes[regimeIndex]) {
      state.selectedRegime = regimeIndex;
      state.steps = resetSteps(state);
      render(state);
    }
  });
};
