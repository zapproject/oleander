import { WitnessRoles, type WitnessRoleId } from "./domain.js";

export type CliCommand =
  | { readonly type: "help" }
  | { readonly type: "ui"; readonly once: boolean }
  | { readonly type: "harnessServe" }
  | { readonly type: "headlessRunOnce" }
  | { readonly type: "headlessStreamOnce" }
  | { readonly type: "claimsList" }
  | { readonly type: "rolesList" }
  | { readonly type: "x402Scenario" }
  | { readonly type: "x402WorkOnce" }
  | { readonly type: "x402ServeFacilitator" }
  | { readonly type: "x402ServeResource" }
  | { readonly type: "deepseekSmoke" }
  | { readonly type: "councilHello" }
  | { readonly type: "councilOnce"; readonly roleId: WitnessRoleId | undefined }
  | { readonly type: "runOnce" }
  | { readonly type: "runDaemon"; readonly ticks: number | undefined }
  | { readonly type: "runsReplay"; readonly filePath: string }
  | { readonly type: "runsVerify"; readonly filePath: string };

const hasFlag = (args: ReadonlyArray<string>, name: string): boolean => args.includes(name);

const readFlag = (args: ReadonlyArray<string>, name: string): string | undefined => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
};

const readPositiveIntFlag = (args: ReadonlyArray<string>, name: string): number | undefined => {
  const value = readFlag(args, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const readPositional = (args: ReadonlyArray<string>, index: number, label: string): string => {
  const value = args[index];
  if (!value || value.startsWith("--")) throw new Error(`Missing ${label}`);
  return value;
};

const isWitnessRoleId = (value: string): value is WitnessRoleId =>
  WitnessRoles.some((role) => role.id === value);

const unknown = (args: ReadonlyArray<string>): never => {
  throw new Error(`Unknown command: ${args.join(" ") || "help"}`);
};

export const parseCliArgs = (args: ReadonlyArray<string>): CliCommand => {
  const command = args[0];
  const subcommand = args[1];

  if (!command || command === "--once") {
    return { type: "ui", once: hasFlag(args, "--once") };
  }

  if (command === "help" || command === "--help" || command === "-h") {
    return { type: "help" };
  }

  if (command === "harness" && subcommand === "serve") return { type: "harnessServe" };
  if (command === "headless" && subcommand === "run" && hasFlag(args, "--once")) return { type: "headlessRunOnce" };
  if (command === "headless" && subcommand === "stream" && hasFlag(args, "--once")) {
    return { type: "headlessStreamOnce" };
  }
  if (command === "claims" && subcommand === "list") return { type: "claimsList" };
  if (command === "roles" && subcommand === "list") return { type: "rolesList" };
  if (command === "x402" && subcommand === "scenario") return { type: "x402Scenario" };
  if (command === "x402" && subcommand === "work" && hasFlag(args, "--once")) return { type: "x402WorkOnce" };
  if (command === "x402" && subcommand === "serve" && args[2] === "facilitator") {
    return { type: "x402ServeFacilitator" };
  }
  if (command === "x402" && subcommand === "serve" && args[2] === "resource") return { type: "x402ServeResource" };
  if (command === "deepseek" && subcommand === "smoke") return { type: "deepseekSmoke" };
  if (command === "council" && subcommand === "hello") return { type: "councilHello" };

  if (command === "council" && hasFlag(args, "--once")) {
    const roleId = readFlag(args, "--role");
    let parsedRoleId: WitnessRoleId | undefined;
    if (roleId !== undefined) {
      if (!isWitnessRoleId(roleId)) {
        throw new Error(`Unknown witness role: ${roleId}`);
      }
      parsedRoleId = roleId;
    }
    return { type: "councilOnce", roleId: parsedRoleId };
  }

  if (command === "run" && hasFlag(args, "--once")) return { type: "runOnce" };

  if (command === "run" && hasFlag(args, "--daemon")) {
    return { type: "runDaemon", ticks: readPositiveIntFlag(args, "--ticks") };
  }

  if (command === "runs" && subcommand === "replay") {
    return { type: "runsReplay", filePath: readPositional(args, 2, "run artifact file") };
  }

  if (command === "headless" && subcommand === "runs" && args[2] === "verify") {
    return { type: "runsVerify", filePath: readPositional(args, 3, "run artifact file") };
  }

  return unknown(args);
};
