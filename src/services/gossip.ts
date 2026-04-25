import { Context, Effect, Layer } from "effect";
import { createHash } from "node:crypto";
import type { Observation } from "../domain.js";
import { stableJson } from "./signer.js";

export type GossipMessageKind = "observation" | "proposal" | "dispute" | "settlement";

export interface GossipEnvelope {
  readonly kind: GossipMessageKind;
  readonly hash: string;
  readonly nodeId: string;
  readonly payload: unknown;
  readonly receivedAt: string;
}

export interface GossipSnapshot {
  readonly messages: ReadonlyArray<GossipEnvelope>;
}

export interface GossipService {
  readonly publishObservation: (observation: Observation) => Effect.Effect<GossipEnvelope, Error>;
  readonly merge: (snapshot: GossipSnapshot) => Effect.Effect<number, Error>;
  readonly snapshot: Effect.Effect<GossipSnapshot, Error>;
}

export class Gossip extends Context.Tag("Gossip")<
  Gossip,
  GossipService
>() {}

export const messageHash = (kind: GossipMessageKind, payload: unknown): string =>
  createHash("sha256").update(`${kind}:${stableJson(payload)}`).digest("hex");

export const createGossipStore = (): GossipService => {
  const messages = new Map<string, GossipEnvelope>();

  return {
    publishObservation: (observation) =>
      Effect.sync(() => {
        const hash = messageHash("observation", observation);
        const envelope = {
          kind: "observation" as const,
          hash,
          nodeId: observation.nodeId,
          payload: observation,
          receivedAt: new Date().toISOString()
        };
        messages.set(hash, envelope);
        return envelope;
      }),

    merge: (snapshot) =>
      Effect.sync(() => {
        let inserted = 0;
        for (const envelope of snapshot.messages) {
          if (!messages.has(envelope.hash)) {
            messages.set(envelope.hash, envelope);
            inserted += 1;
          }
        }
        return inserted;
      }),

    snapshot: Effect.sync(() => ({
      messages: [...messages.values()].sort((left, right) => left.hash.localeCompare(right.hash))
    }))
  };
};

export const GossipLive = Layer.succeed(Gossip, createGossipStore());
