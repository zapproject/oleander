import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import type { Observation } from "../domain.js";
import { createGossipStore, messageHash } from "./gossip.js";

const observation = (nodeId: string, value: boolean): Observation => ({
  claimId: "claim:test:gossip",
  witnessRole: "research",
  nodeId,
  response: { type: "yes_no", value },
  confidence: 0.5,
  evidence: [{ uri: "https://example.com", note: "http ok sha256:a" }],
  rationale: "test",
  observedAt: "2026-01-01T00:00:00.000Z",
  signature: `${nodeId}-sig`
});

describe("messageHash", () => {
  test("dedupes semantically equivalent payloads", () => {
    expect(messageHash("observation", { b: 2, a: 1 })).toBe(messageHash("observation", { a: 1, b: 2 }));
  });
});

describe("Gossip store", () => {
  test("dedupes duplicate signed observations", async () => {
    const store = createGossipStore();
    await Effect.runPromise(store.publishObservation(observation("node-a", true)));
    await Effect.runPromise(store.publishObservation(observation("node-a", true)));

    const snapshot = await Effect.runPromise(store.snapshot);
    expect(snapshot.messages).toHaveLength(1);
  });

  test("late store catches up by merging snapshot", async () => {
    const first = createGossipStore();
    const late = createGossipStore();

    await Effect.runPromise(first.publishObservation(observation("node-a", true)));
    await Effect.runPromise(first.publishObservation(observation("node-b", false)));

    const inserted = await Effect.runPromise(late.merge(await Effect.runPromise(first.snapshot)));
    const snapshot = await Effect.runPromise(late.snapshot);

    expect(inserted).toBe(2);
    expect(snapshot.messages).toHaveLength(2);
  });

  test("merge does not resolve conflicting truth", async () => {
    const store = createGossipStore();
    await Effect.runPromise(store.publishObservation(observation("node-a", true)));
    await Effect.runPromise(store.publishObservation(observation("node-b", false)));

    const snapshot = await Effect.runPromise(store.snapshot);
    expect(snapshot.messages.map((message) => (message.payload as Observation).response).sort((left, right) =>
      String((left as { value: boolean }).value).localeCompare(String((right as { value: boolean }).value))
    )).toEqual([
      { type: "yes_no", value: false },
      { type: "yes_no", value: true }
    ]);
  });
});
