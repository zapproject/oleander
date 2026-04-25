import { spawn } from "node:child_process";
import { resolve } from "node:path";

export type HarnessStepStatus = "pending" | "running" | "passed" | "failed";

export interface HarnessStep {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}

interface StepState extends HarnessStep {
  status: HarnessStepStatus;
  exitCode: number | undefined;
}

interface HarnessState {
  running: boolean;
  runCount: number;
  selectedRegime: number;
  logs: string[];
  steps: StepState[];
  claims: ClaimSummary[];
  reports: OracleReportSummary[];
}

const composeFile = resolve(process.cwd(), "docker-compose.x402-mock.yml");

export type HarnessRegimeId = "full" | "sponsor" | "availability" | "attestation" | "peg" | "stablecoins";

export interface HarnessRegime {
  readonly id: HarnessRegimeId;
  readonly label: string;
  readonly stepIds: ReadonlyArray<string>;
}

export const harnessRegimes: ReadonlyArray<HarnessRegime> = [
  {
    id: "full",
    label: "Full: sponsor + all oracle workers",
    stepIds: ["build", "resource", "sponsor", "availability", "attestation", "peg", "cleanup"]
  },
  {
    id: "sponsor",
    label: "Sponsor only: paid feed gate",
    stepIds: ["build", "resource", "sponsor", "cleanup"]
  },
  {
    id: "availability",
    label: "Availability oracle only",
    stepIds: ["build", "resource", "sponsor", "availability", "cleanup"]
  },
  {
    id: "attestation",
    label: "Attestation oracle only",
    stepIds: ["build", "resource", "sponsor", "attestation", "cleanup"]
  },
  {
    id: "peg",
    label: "Peg oracle only",
    stepIds: ["build", "resource", "sponsor", "peg", "cleanup"]
  },
  {
    id: "stablecoins",
    label: "Stablecoin oracles: attestation + peg",
    stepIds: ["build", "resource", "sponsor", "attestation", "peg", "cleanup"]
  }
];

export interface ClaimSummary {
  readonly id: string;
  readonly kind: string;
  readonly domain: string;
  readonly statement: string;
}

export interface OracleReportSummary {
  readonly nodeId: string;
  readonly observationCount: number;
  readonly stablecoinAtomic: string;
  readonly zapAtomic: string;
  readonly claimIds: ReadonlyArray<string>;
}

export const defaultHarnessEnv = {
  ZAP_SPONSORED_CLAIM_FEED: "claims/x402-ten-claims.json",
  X402_SPONSOR_ID: "sponsor:x402:mock",
  X402_BOUNTY_ATOMIC: "1000000",
  ZAP_REWARD_ATOMIC: "1000000000000000000"
} as const;

export const x402HarnessSteps = (file = composeFile): ReadonlyArray<HarnessStep> => [
  {
    id: "build",
    label: "Build facilitator, resource, sponsor, and oracle images",
    command: "docker",
    args: ["compose", "-f", file, "build"]
  },
  {
    id: "resource",
    label: "Start x402 facilitator and paid claim resource",
    command: "docker",
    args: ["compose", "-f", file, "up", "-d", "x402-resource"]
  },
  {
    id: "sponsor",
    label: "Sponsor publishes paid 10-claim feed",
    command: "docker",
    args: ["compose", "-f", file, "run", "--rm", "sponsor-feed"]
  },
  {
    id: "availability",
    label: "Availability oracle earns USDC/ZAP receipts",
    command: "docker",
    args: ["compose", "-f", file, "run", "--rm", "witness-availability"]
  },
  {
    id: "attestation",
    label: "Attestation oracle earns USDC/ZAP receipts",
    command: "docker",
    args: ["compose", "-f", file, "run", "--rm", "witness-attestation"]
  },
  {
    id: "peg",
    label: "Peg oracle earns USDC/ZAP receipts",
    command: "docker",
    args: ["compose", "-f", file, "run", "--rm", "witness-peg"]
  },
  {
    id: "cleanup",
    label: "Stop and remove x402 mock stack",
    command: "docker",
    args: ["compose", "-f", file, "down"]
  }
];

export const statusGlyph = (status: HarnessStepStatus): string => {
  switch (status) {
    case "pending":
      return "-";
    case "running":
      return ">";
    case "passed":
      return "+";
    case "failed":
      return "!";
  }
};

const ansiPattern = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

const compactLine = (line: string): string | undefined => {
  const stripped = line.replace(ansiPattern, "").trim();
  if (!stripped) return undefined;
  return stripped.length > 220 ? `${stripped.slice(0, 217)}...` : stripped;
};

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

const stepCatalog = (): Map<string, HarnessStep> =>
  new Map(x402HarnessSteps().map((step) => [step.id, step]));

const stepsForRegime = (regime: HarnessRegime): StepState[] => {
  const catalog = stepCatalog();
  return regime.stepIds.map((id) => {
    const step = catalog.get(id);
    if (!step) throw new Error(`Unknown harness step: ${id}`);
    return { ...step, status: "pending", exitCode: undefined };
  });
};

const activeRegime = (state: HarnessState): HarnessRegime =>
  harnessRegimes[state.selectedRegime] ?? harnessRegimes[0]!;

const resetSteps = (state: HarnessState): StepState[] =>
  stepsForRegime(activeRegime(state));

const pushLog = (state: HarnessState, line: string) => {
  const compact = compactLine(line);
  if (!compact) return;
  state.logs.push(compact);
  if (state.logs.length > 90) state.logs.splice(0, state.logs.length - 90);
};

const isRawJsonLine = (line: string): boolean => {
  const trimmed = line.trim();
  return (
    trimmed === "{" ||
    trimmed === "}" ||
    trimmed === "[" ||
    trimmed === "]" ||
    trimmed === "}," ||
    trimmed === "]," ||
    trimmed.startsWith("\"") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("}") ||
    trimmed.startsWith("[") ||
    trimmed.startsWith("]") ||
    trimmed.endsWith(",")
  );
};

export const extractJsonValues = (text: string): unknown[] => {
  const values: unknown[] = [];
  for (let start = 0; start < text.length; start += 1) {
    const opener = text[start];
    if (opener !== "{" && opener !== "[") continue;
    const closer = opener === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }
      if (char === "\"") {
        inString = true;
      } else if (char === opener) {
        depth += 1;
      } else if (char === closer) {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(start, index + 1);
          try {
            values.push(JSON.parse(candidate));
            start = index;
          } catch {
            // Keep scanning; Docker may emit non-JSON bracketed log lines.
          }
          break;
        }
      }
    }
  }
  return values;
};

const isClaimArray = (value: unknown): value is ClaimSummary[] =>
  Array.isArray(value) &&
  value.every((item) =>
    typeof item === "object" &&
    item !== null &&
    typeof (item as { id?: unknown }).id === "string" &&
    typeof (item as { kind?: unknown }).kind === "string" &&
    typeof (item as { domain?: unknown }).domain === "string" &&
    typeof (item as { statement?: unknown }).statement === "string"
  );

const summarizeOracleReport = (value: unknown): OracleReportSummary | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const report = value as {
    type?: unknown;
    oracle?: { nodeId?: unknown; observationCount?: unknown };
    observations?: Array<{ claimId?: unknown }>;
    totals?: { stablecoinAtomic?: unknown; zapAtomic?: unknown };
  };
  if (report.type !== "x402_oracle_work") return undefined;
  if (typeof report.oracle?.nodeId !== "string") return undefined;
  if (typeof report.oracle.observationCount !== "number") return undefined;
  if (typeof report.totals?.stablecoinAtomic !== "string") return undefined;
  if (typeof report.totals.zapAtomic !== "string") return undefined;
  return {
    nodeId: report.oracle.nodeId,
    observationCount: report.oracle.observationCount,
    stablecoinAtomic: report.totals.stablecoinAtomic,
    zapAtomic: report.totals.zapAtomic,
    claimIds: Array.isArray(report.observations)
      ? report.observations
        .map((observation) => observation.claimId)
        .filter((claimId): claimId is string => typeof claimId === "string")
      : []
  };
};

export const summarizeHarnessOutput = (
  stepId: string,
  output: string
): { readonly claims?: ClaimSummary[]; readonly report?: OracleReportSummary } => {
  for (const value of extractJsonValues(output)) {
    if (stepId === "sponsor" && isClaimArray(value)) return { claims: value };
    const report = summarizeOracleReport(value);
    if (report) return { report };
  }
  return {};
};

const applyStructuredOutput = (state: HarnessState, step: StepState, output: string) => {
  const summary = summarizeHarnessOutput(step.id, output);
  if (summary.claims) {
    state.claims = summary.claims;
    pushLog(state, `parsed ${summary.claims.length} sponsored claims`);
  }
  if (summary.report) {
    state.reports = state.reports.filter((report) => report.nodeId !== summary.report!.nodeId);
    state.reports.push(summary.report);
    pushLog(
      state,
      `parsed ${summary.report.nodeId}: ${summary.report.observationCount} observations, ${summary.report.stablecoinAtomic} USDC atomic, ${summary.report.zapAtomic} ZAP atomic`
    );
  }
};

const write = (value: string) => {
  process.stdout.write(value);
};

const render = (state: HarnessState) => {
  write("\x1b[2J\x1b[H");
  write(`${paint("ZAP x402 Oracle Harness", `${color.bold}${color.cyan}`)}\n`);
  write(`${paint("Sponsor -> paid feed -> oracle workers -> signed work -> USDC/ZAP receipts", color.dim)}\n\n`);
  write(`Run: ${state.runCount}  State: ${state.running ? "running" : "idle"}\n`);
  write(`Regime: ${activeRegime(state).label}\n`);
  write(`Sponsor: ${defaultHarnessEnv.X402_SPONSOR_ID}\n`);
  write(`Claim feed: ${defaultHarnessEnv.ZAP_SPONSORED_CLAIM_FEED}\n`);
  write(`Incentive: ${defaultHarnessEnv.X402_BOUNTY_ATOMIC} USDC atomic + ${defaultHarnessEnv.ZAP_REWARD_ATOMIC} ZAP atomic per observation\n\n`);

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
    for (const claim of state.claims.slice(0, 10)) {
      write(` - ${claim.id} [${claim.domain}/${claim.kind}]\n`);
    }
  }

  write("\nOracle Incentives\n");
  if (state.reports.length === 0) {
    write(` ${paint("No oracle receipt reports parsed yet.", color.dim)}\n`);
  } else {
    const totalObservations = state.reports.reduce((sum, report) => sum + report.observationCount, 0);
    const totalStablecoin = state.reports.reduce((sum, report) => sum + BigInt(report.stablecoinAtomic), 0n);
    const totalZap = state.reports.reduce((sum, report) => sum + BigInt(report.zapAtomic), 0n);
    write(` Total: ${totalObservations} observations, ${totalStablecoin.toString()} USDC atomic, ${totalZap.toString()} ZAP atomic\n`);
    for (const report of state.reports) {
      write(` - ${report.nodeId}: ${report.observationCount} obs | ${report.stablecoinAtomic} USDC atomic | ${report.zapAtomic} ZAP atomic\n`);
      write(`   claims: ${report.claimIds.join(", ")}\n`);
    }
  }

  write("\nLive Log\n");
  for (const line of state.logs.slice(-8)) {
    write(` ${line}\n`);
  }
  write(`\n${paint("Keys: 1-6 select regime | r run/rerun | c cleanup | q quit | Ctrl-C exit", color.dim)}\n`);
};

const runCommand = (
  step: StepState,
  state: HarnessState,
  env: NodeJS.ProcessEnv
): Promise<number> =>
  new Promise((resolveStep) => {
    step.status = "running";
    step.exitCode = undefined;
    pushLog(state, `$ ${step.command} ${step.args.join(" ")}`);
    render(state);

    const child = spawn(step.command, [...step.args], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      for (const line of text.split(/\r?\n/)) {
        if (!isRawJsonLine(line)) pushLog(state, line);
      }
      render(state);
    });

    child.stderr.on("data", (data: Buffer) => {
      for (const line of data.toString().split(/\r?\n/)) pushLog(state, line);
      render(state);
    });

    child.on("error", (error) => {
      pushLog(state, `process error: ${error.message}`);
      step.status = "failed";
      step.exitCode = 1;
      render(state);
      resolveStep(1);
    });

    child.on("close", (code) => {
      const exitCode = code ?? 1;
      step.status = exitCode === 0 ? "passed" : "failed";
      step.exitCode = exitCode;
      if (exitCode === 0) applyStructuredOutput(state, step, stdout);
      render(state);
      resolveStep(exitCode);
    });
  });

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
  render(state);
};

export const runTuiHarness = async (options?: { readonly autoRun?: boolean }) => {
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
    logs: ["ready"],
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
    const regimeIndex = Number(key) - 1;
    if (!state.running && Number.isInteger(regimeIndex) && harnessRegimes[regimeIndex]) {
      state.selectedRegime = regimeIndex;
      state.steps = resetSteps(state);
      render(state);
    }
  });
};
