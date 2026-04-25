import { Layer } from "effect";
import { ClaimFeedLive } from "./services/claim-feed.js";
import { ConfigLive } from "./services/config.js";
import { CouncilLive } from "./services/council.js";
import { DeepSeekLive } from "./services/deepseek.js";
import { OpenClawLive } from "./services/openclaw.js";
import { SignerLive } from "./services/signer.js";
import { ValidatorLive } from "./services/validator.js";

const ClaimFeedProvided = ClaimFeedLive.pipe(Layer.provide(ConfigLive));
const DeepSeekProvided = DeepSeekLive.pipe(Layer.provide(ConfigLive));
const SignerProvided = SignerLive.pipe(Layer.provide(ConfigLive));

const OpenClawProvided = OpenClawLive.pipe(
  Layer.provide(
    Layer.mergeAll(
      ConfigLive,
      ValidatorLive,
      DeepSeekProvided,
      SignerProvided
    )
  )
);

const CouncilProvided = CouncilLive.pipe(
  Layer.provide(
    Layer.mergeAll(
      ConfigLive,
      ClaimFeedProvided,
      OpenClawProvided
    )
  )
);

export const AppLayer = Layer.mergeAll(ClaimFeedProvided, CouncilProvided);
