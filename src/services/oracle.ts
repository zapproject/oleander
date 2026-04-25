import type { ClaimResponse, ClaimSpec, Observation } from "../domain.js";
import { stableJson } from "./signer.js";

export type OracleState = "requested" | "proposed" | "disputed" | "settled";

export interface OracleRequest {
  readonly claim: ClaimSpec;
  readonly requestedAt: string;
}

export interface OracleProposal {
  readonly claimId: string;
  readonly response: ClaimResponse;
  readonly support: ReadonlyArray<string>;
  readonly proposedAt: string;
  readonly expiresAt: string;
}

export interface OracleDispute {
  readonly claimId: string;
  readonly reason: string;
  readonly conflictingResponses: ReadonlyArray<ClaimResponse>;
  readonly disputedAt: string;
}

export interface OracleSettlement {
  readonly claimId: string;
  readonly response: ClaimResponse;
  readonly settledAt: string;
}

export interface OracleReduction {
  readonly state: OracleState;
  readonly request: OracleRequest;
  readonly proposal: OracleProposal | undefined;
  readonly dispute: OracleDispute | undefined;
  readonly settlement: OracleSettlement | undefined;
}

const isoPlusSeconds = (iso: string, seconds: number): string =>
  new Date(new Date(iso).getTime() + seconds * 1000).toISOString();

const uniqueResponses = (observations: ReadonlyArray<Observation>): ReadonlyArray<ClaimResponse> => {
  const responses = new Map<string, ClaimResponse>();
  for (const observation of observations) {
    responses.set(stableJson(observation.response), observation.response);
  }
  return [...responses.values()];
};

export const reduceOracle = (
  claim: ClaimSpec,
  observations: ReadonlyArray<Observation>,
  now = new Date()
): OracleReduction => {
  const requestedAt = observations[0]?.observedAt ?? now.toISOString();
  const request = { claim, requestedAt };
  const relevant = observations.filter((observation) => observation.claimId === claim.id);

  if (relevant.length === 0) {
    return { state: "requested", request, proposal: undefined, dispute: undefined, settlement: undefined };
  }

  const responses = uniqueResponses(relevant);
  if (responses.length > 1) {
    return {
      state: "disputed",
      request,
      proposal: undefined,
      dispute: {
        claimId: claim.id,
        reason: "conflicting_observations",
        conflictingResponses: responses,
        disputedAt: now.toISOString()
      },
      settlement: undefined
    };
  }

  const response = responses[0]!;
  const proposedAt = relevant[0]!.observedAt;
  const expiresAt = isoPlusSeconds(proposedAt, claim.livenessSeconds);
  const proposal = {
    claimId: claim.id,
    response,
    support: relevant.map((observation) => observation.signature),
    proposedAt,
    expiresAt
  };

  if (now.getTime() >= new Date(expiresAt).getTime()) {
    return {
      state: "settled",
      request,
      proposal,
      dispute: undefined,
      settlement: {
        claimId: claim.id,
        response,
        settledAt: now.toISOString()
      }
    };
  }

  return { state: "proposed", request, proposal, dispute: undefined, settlement: undefined };
};
