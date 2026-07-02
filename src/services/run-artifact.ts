import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { HarnessState } from "./ui-scenario-core.js";
import { activeRegime } from "./ui-scenario-core.js";
import type { X402WorkReport } from "./x402-work.js";
import { parseHarnessEvent, validateHarnessEventOrder, type HarnessEvent } from "./harness-events.js";

export interface RunArtifact {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly command: string;
  readonly createdAt: string;
  readonly claimFeedPath?: string;
  readonly regime?: string;
  readonly summary: Record<string, unknown>;
  readonly payload: unknown;
  readonly errors?: ReadonlyArray<string>;
}

export interface WriteRunArtifactOptions {
  readonly outputDir?: string;
  readonly now?: Date;
}

const safeSegment = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "run";

export const createRunId = (prefix: string, now = new Date()): string =>
  safeSegment(`${prefix}-${now.toISOString().replace(/[:.]/g, "-")}`);

export const defaultRunArtifactDir = (): string =>
  process.env.ZAP_RUN_ARTIFACT_DIR ?? "runs";

export const writeRunArtifact = (
  artifact: RunArtifact,
  options: WriteRunArtifactOptions = {}
): string => {
  const outputDir = resolve(process.cwd(), options.outputDir ?? defaultRunArtifactDir());
  mkdirSync(outputDir, { recursive: true });
  const filePath = resolve(outputDir, `${safeSegment(artifact.runId)}.json`);
  writeFileSync(filePath, `${JSON.stringify(artifact, (_key, value) => {
    if (typeof value === "bigint") return value.toString();
    return value;
  }, 2)}\n`);
  return filePath;
};

export interface RunArtifactVerification {
  readonly ok: boolean;
  readonly errors: ReadonlyArray<string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseHarnessEventsFromRunArtifact = (artifact: unknown): ReadonlyArray<HarnessEvent> => {
  if (!isRecord(artifact)) throw new Error("artifact must be an object");
  const payload = isRecord(artifact.payload) ? artifact.payload : undefined;
  const rawEvents = payload?.events;
  if (!Array.isArray(rawEvents)) throw new Error("artifact payload.events must be an array");
  return rawEvents.map((rawEvent, index) => {
    try {
      return parseHarnessEvent(rawEvent);
    } catch (error) {
      throw new Error(`payload.events[${index}] invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
};

export const x402WorkRunArtifact = (
  report: X402WorkReport,
  options: { readonly claimFeedPath?: string; readonly now?: Date } = {}
): RunArtifact => {
  const createdAt = (options.now ?? new Date()).toISOString();
  return {
    schemaVersion: 1,
    runId: createRunId(`x402-work-${report.oracle.nodeId}`, options.now),
    command: "x402 work --once",
    createdAt,
    claimFeedPath: options.claimFeedPath,
    summary: {
      oracleNodeId: report.oracle.nodeId,
      observations: report.totals.observations,
      paymentAsset: report.sponsor.paymentAsset,
      stablecoinAtomic: report.totals.stablecoinAtomic,
      zapAtomic: report.totals.zapAtomic
    },
    payload: report
  };
};

export const harnessEventsRunArtifact = (
  events: ReadonlyArray<HarnessEvent>,
  options: { readonly claimFeedPath?: string; readonly now?: Date } = {}
): RunArtifact => {
  const createdAt = (options.now ?? new Date()).toISOString();
  const runId = safeSegment(events[0]?.runId ?? createRunId("harness", options.now));
  const finished = events.find((event) => event.type === "run_finished");
  const failed = events.find((event) => event.type === "run_failed");
  const receipts = events.filter((event) => event.type === "work_receipt_created");

  return {
    schemaVersion: 1,
    runId,
    command: "headless run --once",
    createdAt,
    claimFeedPath: options.claimFeedPath,
    summary: {
      eventCount: events.length,
      claimCount: finished?.claimCount ?? events.filter((event) => event.type === "claim_loaded").length,
      observationCount: finished?.observationCount ?? events.filter((event) => event.type === "observation_signed").length,
      paymentAsset: "OUSD",
      payoutAtomic: finished?.payoutAtomic ?? receipts
        .reduce((sum, receipt) => sum + BigInt(receipt.amountAtomic), 0n)
        .toString(),
      failed: Boolean(failed),
      error: failed?.error
    },
    payload: { events }
  };
};

export const verifyRunArtifact = (artifact: unknown): RunArtifactVerification => {
  const errors: string[] = [];
  if (!isRecord(artifact)) return { ok: false, errors: ["artifact must be an object"] };
  if (artifact.schemaVersion !== 1) errors.push("schemaVersion must be 1");

  const summary = isRecord(artifact.summary) ? artifact.summary : undefined;
  const payload = isRecord(artifact.payload) ? artifact.payload : undefined;
  const rawEvents = payload?.events;
  if (Array.isArray(rawEvents)) {
    const events: HarnessEvent[] = [];
    for (const [index, rawEvent] of rawEvents.entries()) {
      try {
        events.push(parseHarnessEvent(rawEvent));
      } catch (error) {
        errors.push(`payload.events[${index}] invalid: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (events.length === rawEvents.length) {
      errors.push(...validateHarnessEventOrder(events));
      const loadedClaims = events.filter((event) => event.type === "claim_loaded").length;
      const observations = events.filter((event) => event.type === "observation_signed").length;
      const finished = events.find((event) => event.type === "run_finished");
      const summaryClaimCount = typeof summary?.claimCount === "number" ? summary.claimCount : undefined;
      const summaryObservationCount = typeof summary?.observationCount === "number"
        ? summary.observationCount
        : undefined;

      if (finished && finished.claimCount !== loadedClaims) {
        errors.push(`run_finished claimCount ${finished.claimCount} does not match ${loadedClaims} claim_loaded events`);
      }
      if (finished && finished.observationCount !== observations) {
        errors.push(
          `run_finished observationCount ${finished.observationCount} does not match ${observations} observation_signed events`
        );
      }
      if (summaryClaimCount !== undefined && summaryClaimCount !== (finished?.claimCount ?? loadedClaims)) {
        errors.push(
          `summary claimCount ${summaryClaimCount} does not match ${finished?.claimCount ?? loadedClaims}`
        );
      }
      if (summaryObservationCount !== undefined && summaryObservationCount !== (finished?.observationCount ?? observations)) {
        errors.push(
          `summary observationCount ${summaryObservationCount} does not match ${finished?.observationCount ?? observations}`
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
};

export const uiScenarioRunArtifact = (
  state: HarnessState,
  options: { readonly claimFeedPath?: string; readonly now?: Date; readonly errors?: ReadonlyArray<string> } = {}
): RunArtifact => {
  const createdAt = (options.now ?? new Date()).toISOString();
  const totalObservations = state.reports.reduce((sum, report) => sum + report.observationCount, 0);
  const stablecoinAtomic = state.reports.reduce((sum, report) => sum + BigInt(report.stablecoinAtomic), 0n).toString();
  const zapAtomic = state.reports.reduce((sum, report) => sum + BigInt(report.zapAtomic), 0n).toString();

  return {
    schemaVersion: 1,
    runId: createRunId(`ui-scenario-${activeRegime(state).id}-${state.runCount}`, options.now),
    command: "ui scenario",
    createdAt,
    claimFeedPath: options.claimFeedPath,
    regime: activeRegime(state).id,
    summary: {
      runCount: state.runCount,
      claims: state.claims.length,
      oracleReports: state.reports.length,
      observations: totalObservations,
      stablecoinAtomic,
      zapAtomic,
      failedSteps: state.steps.filter((step) => step.status === "failed").map((step) => step.id)
    },
    payload: {
      steps: state.steps,
      claims: state.claims,
      reports: state.reports,
      logs: state.logs,
      verboseLogs: state.verboseLogs
    },
    errors: options.errors
  };
};
