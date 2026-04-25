import { Context, Effect, Layer } from "effect";
import { ConfigService } from "./config.js";

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface DeepSeekService {
  readonly complete: (messages: ReadonlyArray<ChatMessage>) => Effect.Effect<string, Error>;
  readonly smoke: Effect.Effect<string, Error>;
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

const redactProviderError = (message: string): string =>
  message.replace(/sk-[A-Za-z0-9_\-\.]+/g, "sk-REDACTED");

const mockCompletion = (messages: ReadonlyArray<ChatMessage>): string => {
  let userContent = "";
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user") {
      userContent = message.content;
      break;
    }
  }
  return [
    "insufficient evidence",
    "",
    "Mock DeepSeek response. The witness service is reachable, but live model calls are disabled.",
    userContent ? `Input bytes: ${userContent.length}.` : "No user input was provided."
  ].join("\n");
};

export const DeepSeekLive = Layer.effect(
  DeepSeek,
  Effect.gen(function* () {
    const config = yield* ConfigService;

    return {
      complete: (messages) =>
        Effect.tryPromise({
          try: async () => {
            if (config.deepseekMock) {
              return mockCompletion(messages);
            }

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
              throw new Error(
                redactProviderError(json.error?.message ?? `DeepSeek request failed: ${response.status}`)
              );
            }

            const content = json.choices?.[0]?.message?.content;
            if (!content) {
              throw new Error("DeepSeek response did not include message content");
            }
            return content;
          },
          catch: (error) => error instanceof Error ? error : new Error(String(error))
        }),

      smoke: Effect.gen(function* () {
        return yield* Effect.tryPromise({
          try: async () => {
            if (config.deepseekMock) {
              return "DeepSeek mock mode is enabled.";
            }

            if (!config.deepseekApiKey) {
              throw new Error("Missing DeepSeek API key. Set DEEPSEEK_API_KEY or DEEPSEEK_KEY_FILE.");
            }

            return "DeepSeek API key is configured.";
          },
          catch: (error) => error instanceof Error ? error : new Error(String(error))
        });
      })
    };
  })
);
