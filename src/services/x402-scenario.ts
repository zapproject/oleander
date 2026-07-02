export interface X402RolePlan {
  readonly role: string;
  readonly actor: string;
  readonly fundsOrStakes: string;
  readonly receives: string;
}

export interface X402MockScenario {
  readonly protocol: "x402";
  readonly paymentAsset: "OUSD";
  readonly utilityAsset: "ZAP";
  readonly network: string;
  readonly claimFeed: string;
  readonly budget: {
    readonly stablecoinSupplyAtomic: string;
    readonly zapRewardSupplyAtomic: string;
    readonly burnShareBps: number;
    readonly treasuryShareBps: number;
  };
  readonly roles: ReadonlyArray<X402RolePlan>;
  readonly flow: ReadonlyArray<string>;
}

export const x402MockScenario: X402MockScenario = {
  protocol: "x402",
  paymentAsset: "OUSD",
  utilityAsset: "ZAP",
  network: "mock-base",
  claimFeed: "claims/x402-mock.json",
  budget: {
    stablecoinSupplyAtomic: "1000000000",
    zapRewardSupplyAtomic: "5000000000000000000000",
    burnShareBps: 2500,
    treasuryShareBps: 7500
  },
  roles: [
    {
      role: "Claim Sponsor",
      actor: "Stablecoin protocol, data buyer, or ZAP treasury",
      fundsOrStakes: "Funds OUSD bounty budget through x402 payment requirements",
      receives: "Settled claim output and evidence receipts"
    },
    {
      role: "Witness Worker",
      actor: "Agentic ZAP client operator",
      fundsOrStakes: "Stakes ZAP or reputation bond to qualify for paid work",
      receives: "OUSD for accepted work, ZAP for quality and availability"
    },
    {
      role: "Disputer",
      actor: "Witness worker or specialist reviewer",
      fundsOrStakes: "Posts ZAP dispute bond",
      receives: "OUSD/ZAP reward when dispute is valid"
    },
    {
      role: "Council",
      actor: "Protocol governance / policy layer",
      fundsOrStakes: "Controls incentive weights, burn share, treasury share",
      receives: "No truth authority; only incentive policy authority"
    },
    {
      role: "x402 Facilitator",
      actor: "Payment verification and settlement service",
      fundsOrStakes: "Verifies signed payment payloads and settles stablecoin transfers",
      receives: "Facilitator fee if configured"
    }
  ],
  flow: [
    "Claim sponsor publishes typed claims with x402 payment requirements and an OUSD budget.",
    "Witness workers stake ZAP or reputation to qualify for claim work.",
    "Workers run scheduled DeepSeek tool-call witness jobs against the claim feed.",
    "Each worker collects evidence, validates typed response, signs observation, and gossips it.",
    "Oracle reducer proposes, disputes, or settles based on signed observations and liveness.",
    "Accepted work creates a work receipt.",
    "x402 pays OUSD from the claim budget to eligible workers.",
    "Council policy mints/allocates ZAP rewards for quality, availability, amplification, and valid disputes.",
    "Protocol fees can route to burn and treasury according to policy."
  ]
};
