import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { ClaimSpec, Observation } from "../domain.js";
import { WitnessRoles } from "../domain.js";
import type { HarnessEvent as EngineHarnessEvent } from "./harness-events.js";
import { streamHarnessRunEvents } from "./harness-run-engine.js";
import { messageHash } from "./gossip.js";

export type HarnessRegimeId = "full" | "sponsor" | "availability" | "attestation" | "peg" | "stablecoins";

export interface HarnessRunOptions {
  readonly regime?: HarnessRegimeId;
  readonly claimFeedPath?: string;
  readonly appDistPath?: string;
  readonly port?: number;
  readonly eventDelayMs?: number;
  readonly autoRunIntervalMs?: number;
}

export type HarnessEvent =
  | {
      readonly type: "run_started";
      readonly runId: string;
      readonly regime: HarnessRegimeId;
      readonly totalClaims: number;
      readonly emittedAt: string;
    }
  | {
      readonly type: "sponsor_claims_loaded";
      readonly runId: string;
      readonly claims: ReadonlyArray<ClaimSpec>;
      readonly emittedAt: string;
    }
  | {
      readonly type: "oracle_started";
      readonly runId: string;
      readonly nodeId: string;
      readonly claimCount: number;
      readonly emittedAt: string;
    }
  | {
      readonly type: "observation_signed";
      readonly runId: string;
      readonly claimId: string;
      readonly nodeId: string;
      readonly response: { readonly type: "no_answer_possible"; readonly reason: string };
      readonly signature: string;
      readonly emittedAt: string;
    }
  | {
      readonly type: "work_receipt_created";
      readonly runId: string;
      readonly claimId: string;
      readonly nodeId: string;
      readonly workReceiptId: string;
      readonly emittedAt: string;
    }
  | {
      readonly type: "bounty_created";
      readonly runId: string;
      readonly claimId: string;
      readonly nodeId: string;
      readonly stablecoin: "OUSD";
      readonly amountAtomic: string;
      readonly payoutAddress: string;
      readonly emittedAt: string;
    }
  | {
      readonly type: "zap_reward_created";
      readonly runId: string;
      readonly claimId: string;
      readonly nodeId: string;
      readonly workReceiptId: string;
      readonly zapAmountAtomic: string;
      readonly reason: "observation";
      readonly emittedAt: string;
    }
  | {
      readonly type: "oracle_finished";
      readonly runId: string;
      readonly nodeId: string;
      readonly observations: number;
      readonly stablecoinAtomic: string;
      readonly zapAtomic: string;
      readonly emittedAt: string;
    }
  | {
      readonly type: "run_finished";
      readonly runId: string;
      readonly totalObservations: number;
      readonly stablecoinAtomic: string;
      readonly zapAtomic: string;
      readonly emittedAt: string;
    };

const bountyPerObservationAtomic = "1000000";
const zapPerObservationAtomic = "1000000000000000000";
const oracleNodeIds = ["witness-availability", "witness-attestation", "witness-peg"] as const;
const browserHarnessSponsorId = "sponsor:browser-harness";

const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

export const isHarnessRegimeId = (value: string): value is HarnessRegimeId =>
  ["full", "sponsor", "availability", "attestation", "peg", "stablecoins"].includes(value);

export const oracleForHarnessClaim = (claim: ClaimSpec): (typeof oracleNodeIds)[number] => {
  if (claim.domain === "availability") return "witness-availability";
  if (claim.kind === "hash_attestation") return "witness-attestation";
  return "witness-peg";
};

export const claimsForHarnessRegime = (
  claims: ReadonlyArray<ClaimSpec>,
  regime: HarnessRegimeId
): ReadonlyArray<ClaimSpec> => {
  if (regime === "sponsor") return [];
  if (regime === "availability") return claims.filter((claim) => claim.domain === "availability");
  if (regime === "attestation") {
    return claims.filter((claim) => claim.domain === "stablecoins" && claim.kind === "hash_attestation");
  }
  if (regime === "peg") return claims.filter((claim) => claim.domain === "stablecoins" && claim.kind === "yes_no");
  if (regime === "stablecoins") return claims.filter((claim) => claim.domain === "stablecoins");
  return claims;
};

export const buildHarnessEvents = (
  claims: ReadonlyArray<ClaimSpec>,
  regime: HarnessRegimeId = "full",
  runId = `run:${messageHash("proposal", { regime, claims: claims.map((claim) => claim.id) }).slice(0, 16)}`
): ReadonlyArray<HarnessEvent> => {
  const selectedClaims = claimsForHarnessRegime(claims, regime);
  const events: HarnessEvent[] = [
    { type: "run_started", runId, regime, totalClaims: selectedClaims.length, emittedAt: now() },
    { type: "sponsor_claims_loaded", runId, claims: selectedClaims, emittedAt: now() }
  ];

  const claimsByOracle = new Map<(typeof oracleNodeIds)[number], ClaimSpec[]>();
  for (const nodeId of oracleNodeIds) claimsByOracle.set(nodeId, []);
  for (const claim of selectedClaims) claimsByOracle.get(oracleForHarnessClaim(claim))!.push(claim);

  for (const nodeId of oracleNodeIds) {
    const oracleClaims = claimsByOracle.get(nodeId)!;
    if (oracleClaims.length === 0) continue;
    events.push({ type: "oracle_started", runId, nodeId, claimCount: oracleClaims.length, emittedAt: now() });
    for (const claim of oracleClaims) {
      const signature = messageHash("observation", { claimId: claim.id, nodeId, runId });
      const workReceiptId = messageHash("observation", { claimId: claim.id, nodeId, signature });
      events.push({
        type: "observation_signed",
        runId,
        claimId: claim.id,
        nodeId,
        response: { type: "no_answer_possible", reason: "mock harness observation requires external settlement" },
        signature,
        emittedAt: now()
      });
      events.push({ type: "work_receipt_created", runId, claimId: claim.id, nodeId, workReceiptId, emittedAt: now() });
      events.push({
        type: "bounty_created",
        runId,
        claimId: claim.id,
        nodeId,
        stablecoin: "OUSD",
        amountAtomic: bountyPerObservationAtomic,
        payoutAddress: `mock-wallet:${nodeId}`,
        emittedAt: now()
      });
      events.push({
        type: "zap_reward_created",
        runId,
        claimId: claim.id,
        nodeId,
        workReceiptId,
        zapAmountAtomic: zapPerObservationAtomic,
        reason: "observation",
        emittedAt: now()
      });
    }
    events.push({
      type: "oracle_finished",
      runId,
      nodeId,
      observations: oracleClaims.length,
      stablecoinAtomic: (BigInt(bountyPerObservationAtomic) * BigInt(oracleClaims.length)).toString(),
      zapAtomic: (BigInt(zapPerObservationAtomic) * BigInt(oracleClaims.length)).toString(),
      emittedAt: now()
    });
  }

  events.push({
    type: "run_finished",
    runId,
    totalObservations: selectedClaims.length,
    stablecoinAtomic: (BigInt(bountyPerObservationAtomic) * BigInt(selectedClaims.length)).toString(),
    zapAtomic: (BigInt(zapPerObservationAtomic) * BigInt(selectedClaims.length)).toString(),
    emittedAt: now()
  });
  return events;
};

export interface EngineHarnessEventsForRegimeOptions {
  readonly runId?: string;
  readonly now?: () => string;
}

export async function* streamEngineHarnessEventsForRegime(
  claims: ReadonlyArray<ClaimSpec>,
  regime: HarnessRegimeId = "full",
  options: EngineHarnessEventsForRegimeOptions = {}
): AsyncGenerator<EngineHarnessEvent> {
  const selectedClaims = claimsForHarnessRegime(claims, regime);
  const runId = options.runId ?? `run:engine:${messageHash("proposal", {
    regime,
    claims: selectedClaims.map((claim) => claim.id)
  }).slice(0, 16)}`;
  for await (const event of streamHarnessRunEvents({
    runId,
    claims: selectedClaims,
    now: options.now,
    payoutPerObservationAtomic: bountyPerObservationAtomic,
    sponsorAccountId: browserHarnessSponsorId,
    witness: {
      nodeId: "browser-harness",
      nodeIdForClaim: oracleForHarnessClaim,
      witnessRole: "research",
      observe: async ({ claim, nodeId }): Promise<Observation> => {
        return {
          claimId: claim.id,
          witnessRole: WitnessRoles.find((role) => role.id === "research")?.id ?? "research",
          nodeId,
          response: { type: "no_answer_possible", reason: "browser harness observation requires live evidence adapter" },
          confidence: 0.2,
          evidence: claim.sources.map((uri) => ({ uri, note: "browser harness source queued" })),
          rationale: `Browser harness routed ${claim.id} to ${nodeId}.`,
          observedAt: options.now?.() ?? now(),
          signature: messageHash("observation", { claimId: claim.id, nodeId, runId })
        };
      }
    }
  })) {
    yield event;
  }
}

export const collectEngineHarnessEventsForRegime = async (
  claims: ReadonlyArray<ClaimSpec>,
  regime: HarnessRegimeId = "full",
  options: EngineHarnessEventsForRegimeOptions = {}
): Promise<ReadonlyArray<EngineHarnessEvent>> => {
  const events: EngineHarnessEvent[] = [];
  for await (const event of streamEngineHarnessEventsForRegime(claims, regime, options)) {
    events.push(event);
  }
  return events;
};

export const readHarnessClaims = async (claimFeedPath = "claims/x402-fifty-claims.json"): Promise<ReadonlyArray<ClaimSpec>> => {
  const raw = await readFile(resolve(process.cwd(), claimFeedPath), "utf8");
  return JSON.parse(raw) as ReadonlyArray<ClaimSpec>;
};

const contentTypeFor = (path: string): string => {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
};

const staticResponse = async (distRoot: string, pathname: string): Promise<Response> => {
  if (!existsSync(distRoot)) {
    return new Response("Browser harness is not built. Run `bun run browser:build` first.\n", { status: 503 });
  }

  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const resolvedPath = resolve(distRoot, `.${decodeURIComponent(normalizedPath)}`);
  if (resolvedPath !== distRoot && !resolvedPath.startsWith(`${distRoot}${sep}`)) {
    return new Response("Not found\n", { status: 404 });
  }

  const filePath = existsSync(resolvedPath) && extname(resolvedPath) ? resolvedPath : join(distRoot, "index.html");
  const file = Bun.file(filePath);
  if (!(await file.exists())) return new Response("Not found\n", { status: 404 });
  return new Response(file, { headers: { "content-type": contentTypeFor(filePath) } });
};

const eventStreamResponse = async (
  request: Request,
  options: Required<Pick<HarnessRunOptions, "claimFeedPath" | "eventDelayMs">>
): Promise<Response> => {
  const url = new URL(request.url);
  const requestedRegime = url.searchParams.get("regime") ?? "full";
  const regime = isHarnessRegimeId(requestedRegime) ? requestedRegime : "full";
  const claims = await readHarnessClaims(options.claimFeedPath);
  const events = buildHarnessEvents(claims, regime);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const event of events) {
        if (request.signal.aborted) break;
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        await sleep(options.eventDelayMs);
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no"
    }
  });
};

const engineEventStreamResponse = async (
  request: Request,
  options: Required<Pick<HarnessRunOptions, "claimFeedPath" | "eventDelayMs">>
): Promise<Response> => {
  const url = new URL(request.url);
  const requestedRegime = url.searchParams.get("regime") ?? "full";
  const regime = isHarnessRegimeId(requestedRegime) ? requestedRegime : "full";
  const claims = await readHarnessClaims(options.claimFeedPath);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const event of streamEngineHarnessEventsForRegime(claims, regime)) {
        if (request.signal.aborted) break;
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
        await sleep(options.eventDelayMs);
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no"
    }
  });
};

export const serveHarnessServer = (options: HarnessRunOptions = {}) => {
  const port = options.port ?? 5174;
  const claimFeedPath = options.claimFeedPath ?? "claims/x402-fifty-claims.json";
  const eventDelayMs = options.eventDelayMs ?? 75;
  const autoRunIntervalMs = options.autoRunIntervalMs ?? 180_000;
  const distRoot = resolve(process.cwd(), options.appDistPath ?? "apps/browser-harness/dist");

  const server = Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/health") {
        return Response.json({ ok: true, service: "zap-harness", claimFeedPath, eventDelayMs, autoRunIntervalMs });
      }
      if (url.pathname === "/config") {
        return Response.json({ autoRunIntervalMs, eventDelayMs, claimFeedPath });
      }
      if (url.pathname === "/events") {
        return eventStreamResponse(request, { claimFeedPath, eventDelayMs });
      }
      if (url.pathname === "/engine-events") {
        return engineEventStreamResponse(request, { claimFeedPath, eventDelayMs });
      }
      return staticResponse(distRoot, url.pathname);
    }
  });

  process.stdout.write(`ZAP browser harness: http://${server.hostname}:${server.port}\n`);
  process.stdout.write(`SSE stream: http://${server.hostname}:${server.port}/events?regime=full\n`);
  process.stdout.write(`Engine SSE stream: http://${server.hostname}:${server.port}/engine-events?regime=full\n`);
  return server;
};
