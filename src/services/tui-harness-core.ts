import { resolve } from "node:path";

export type HarnessStepStatus = "pending" | "running" | "passed" | "failed";

export interface HarnessStep {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}

export interface StepState extends HarnessStep {
  status: HarnessStepStatus;
  exitCode: number | undefined;
}

export interface HarnessState {
  running: boolean;
  runCount: number;
  selectedRegime: number;
  showVerbose: boolean;
  logs: string[];
  verboseLogs: string[];
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
  ZAP_SPONSORED_CLAIM_FEED: "claims/x402-fifty-claims.json",
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
    label: "Sponsor publishes paid 50-claim feed",
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

export const compactLine = (line: string): string | undefined => {
  const stripped = line.replace(ansiPattern, "").trim();
  if (!stripped) return undefined;
  return stripped.length > 220 ? `${stripped.slice(0, 217)}...` : stripped;
};

export const isRawJsonLine = (line: string): boolean => {
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

const stepCatalog = (): Map<string, HarnessStep> =>
  new Map(x402HarnessSteps().map((step) => [step.id, step]));

export const stepsForRegime = (regime: HarnessRegime): StepState[] => {
  const catalog = stepCatalog();
  return regime.stepIds.map((id) => {
    const step = catalog.get(id);
    if (!step) throw new Error(`Unknown harness step: ${id}`);
    return { ...step, status: "pending", exitCode: undefined };
  });
};

export const activeRegime = (state: Pick<HarnessState, "selectedRegime">): HarnessRegime =>
  harnessRegimes[state.selectedRegime] ?? harnessRegimes[0]!;

export const resetSteps = (state: Pick<HarnessState, "selectedRegime">): StepState[] =>
  stepsForRegime(activeRegime(state));

export const pushLog = (state: Pick<HarnessState, "logs">, line: string) => {
  const compact = compactLine(line);
  if (!compact) return;
  state.logs.push(compact);
  if (state.logs.length > 90) state.logs.splice(0, state.logs.length - 90);
};

export const pushVerboseLog = (state: Pick<HarnessState, "verboseLogs">, line: string) => {
  const compact = compactLine(line);
  if (!compact) return;
  state.verboseLogs.push(compact);
  if (state.verboseLogs.length > 240) state.verboseLogs.splice(0, state.verboseLogs.length - 240);
};

export const applyStructuredOutput = (state: HarnessState, step: StepState, output: string) => {
  const summary = summarizeHarnessOutput(step.id, output);
  if (summary.claims) {
    state.claims = summary.claims;
    pushLog(state, `parsed ${summary.claims.length} sponsored claims`);
    pushVerboseLog(state, `parsed ${summary.claims.length} sponsored claims`);
  }
  if (summary.report) {
    state.reports = state.reports.filter((report) => report.nodeId !== summary.report!.nodeId);
    state.reports.push(summary.report);
    pushLog(
      state,
      `parsed ${summary.report.nodeId}: ${summary.report.observationCount} observations, ${summary.report.stablecoinAtomic} USDC atomic, ${summary.report.zapAtomic} ZAP atomic`
    );
    pushVerboseLog(
      state,
      `parsed ${summary.report.nodeId}: ${summary.report.observationCount} observations, ${summary.report.stablecoinAtomic} USDC atomic, ${summary.report.zapAtomic} ZAP atomic`
    );
  }
};
