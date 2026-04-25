import { Context, Effect, Layer } from "effect";
import { ConfigService } from "./config.js";

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface DeepSeekService {
  readonly complete: (messages: ReadonlyArray<ChatMessage>) => Effect.Effect<string, Error>;
}

export class DeepSeek extends Context.Tag("DeepSeek")<
  DeepSeek,
  DeepSeekService
>() {}

interface DeepSeekResponse {
  readonly choices?: ReadonlyArray<{
    readonly message?: {
      readonly content?: string;
    };
  }>;
  readonly error?: {
    readonly message?: string;
  };
}

export const DeepSeekLive = Layer.effect(
  DeepSeek,
  Effect.gen(function* () {
    const config = yield* ConfigService;

    return {
      complete: (messages) =>
        Effect.tryPromise({
          try: async () => {
            if (!config.deepseekApiKey) {
              throw new Error("Missing DeepSeek API key. Set DEEPSEEK_API_KEY or DEEPSEEK_KEY_FILE.");
            }

            const response = await fetch(`${config.deepseekBaseUrl}/chat/completions`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${config.deepseekApiKey}`
              },
              body: JSON.stringify({
                model: config.deepseekModel,
                temperature: 0.2,
                messages
              })
            });

            const json = (await response.json()) as DeepSeekResponse;
            if (!response.ok) {
              throw new Error(json.error?.message ?? `DeepSeek request failed: ${response.status}`);
            }

            const content = json.choices?.[0]?.message?.content;
            if (!content) {
              throw new Error("DeepSeek response did not include message content");
            }
            return content;
          },
          catch: (error) => error instanceof Error ? error : new Error(String(error))
        })
    };
  })
);
