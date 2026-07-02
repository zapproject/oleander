import { spawn } from "node:child_process";
import type { StepState } from "./ui-scenario-core.js";

export interface HarnessProcessHandlers {
  readonly onStart?: () => void;
  readonly onStdout?: (text: string) => void;
  readonly onStderr?: (text: string) => void;
  readonly onError?: (error: Error) => void;
}

export interface HarnessProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
}

export const runHarnessProcess = (
  step: StepState,
  env: NodeJS.ProcessEnv,
  handlers: HarnessProcessHandlers = {}
): Promise<HarnessProcessResult> =>
  new Promise((resolveStep) => {
    handlers.onStart?.();

    const child = spawn(step.command, [...step.args], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      handlers.onStdout?.(text);
    });

    child.stderr.on("data", (data: Buffer) => {
      handlers.onStderr?.(data.toString());
    });

    child.on("error", (error) => {
      handlers.onError?.(error);
      resolveStep({ exitCode: 1, stdout });
    });

    child.on("close", (code) => {
      resolveStep({ exitCode: code ?? 1, stdout });
    });
  });
