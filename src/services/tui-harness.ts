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
  logs: string[];
  steps: StepState[];
}

const composeFile = resolve(process.cwd(), "docker-compose.x402-mock.yml");

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

const resetSteps = (): StepState[] =>
  x402HarnessSteps().map((step) => ({ ...step, status: "pending", exitCode: undefined }));

const pushLog = (state: HarnessState, line: string) => {
  const compact = compactLine(line);
  if (!compact) return;
  state.logs.push(compact);
  if (state.logs.length > 90) state.logs.splice(0, state.logs.length - 90);
};

const write = (value: string) => {
  process.stdout.write(value);
};

const render = (state: HarnessState) => {
  write("\x1b[2J\x1b[H");
  write(`${paint("ZAP x402 Oracle Harness", `${color.bold}${color.cyan}`)}\n`);
  write(`${paint("Sponsor -> paid feed -> oracle workers -> signed work -> USDC/ZAP receipts", color.dim)}\n\n`);
  write(`Run: ${state.runCount}  State: ${state.running ? "running" : "idle"}\n`);
  write(`Sponsor: ${defaultHarnessEnv.X402_SPONSOR_ID}\n`);
  write(`Claim feed: ${defaultHarnessEnv.ZAP_SPONSORED_CLAIM_FEED}\n`);
  write(`Incentive: ${defaultHarnessEnv.X402_BOUNTY_ATOMIC} USDC atomic + ${defaultHarnessEnv.ZAP_REWARD_ATOMIC} ZAP atomic per observation\n\n`);

  write("Steps\n");
  for (const step of state.steps) {
    const exit = step.exitCode === undefined ? "" : ` exit=${step.exitCode}`;
    write(` ${statusText(step.status)} ${step.label}${exit}\n`);
  }

  write("\nLive Log\n");
  for (const line of state.logs.slice(-18)) {
    write(` ${line}\n`);
  }
  write(`\n${paint("Keys: r run/rerun | c cleanup | q quit | Ctrl-C exit", color.dim)}\n`);
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

    child.stdout.on("data", (data: Buffer) => {
      for (const line of data.toString().split(/\r?\n/)) pushLog(state, line);
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
  state.steps = resetSteps();
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
    logs: ["ready"],
    steps: resetSteps()
  };

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
  });
};
