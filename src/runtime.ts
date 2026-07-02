import { Layer } from "effect";
import { ClaimFeedLive } from "./services/claim-feed.js";
import { ConfigLive } from "./services/config.js";
import { CouncilLive } from "./services/council.js";
import { DeepSeekLive } from "./services/deepseek.js";
import { EvidenceLive } from "./services/evidence.js";
import { GossipLive } from "./services/gossip.js";
import { DeepSeekToolCallWitnessLive } from "./services/tool-call-witness.js";
import { SchedulerLive } from "./services/scheduler.js";
import { SignerLive } from "./services/signer.js";
import { ValidatorLive } from "./services/validator.js";

const ClaimFeedProvided = ClaimFeedLive.pipe(Layer.provide(ConfigLive));
const DeepSeekProvided = DeepSeekLive.pipe(Layer.provide(ConfigLive));
const SignerProvided = SignerLive.pipe(Layer.provide(ConfigLive));

const ToolCallWitnessProvided = DeepSeekToolCallWitnessLive.pipe(
  Layer.provide(
    Layer.mergeAll(
      ConfigLive,
      ValidatorLive,
      DeepSeekProvided,
      EvidenceLive,
      SignerProvided
    )
  )
);

const CouncilProvided = CouncilLive.pipe(
  Layer.provide(
    Layer.mergeAll(
      ConfigLive,
      ClaimFeedProvided,
      DeepSeekProvided,
      ToolCallWitnessProvided
    )
  )
);

const SchedulerProvided = SchedulerLive.pipe(Layer.provide(ConfigLive));

export const AppLayer = Layer.mergeAll(
  ClaimFeedProvided,
  DeepSeekProvided,
  ToolCallWitnessProvided,
  CouncilProvided,
  SchedulerProvided,
  GossipLive
);
