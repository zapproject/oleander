import { describe, expect, test } from "bun:test";
import { parseCliArgs } from "./cli-parser.js";

describe("parseCliArgs", () => {
  test("opens the UI by default", () => {
    expect(parseCliArgs([])).toEqual({ type: "ui", once: false });
    expect(parseCliArgs(["--once"])).toEqual({ type: "ui", once: true });
  });

  test("parses help aliases", () => {
    expect(parseCliArgs(["help"])).toEqual({ type: "help" });
    expect(parseCliArgs(["--help"])).toEqual({ type: "help" });
  });

  test("parses council role runs", () => {
    expect(parseCliArgs(["council", "--role", "law", "--once"])).toEqual({
      type: "councilOnce",
      roleId: "law"
    });
  });

  test("parses headless one-shot runs", () => {
    expect(parseCliArgs(["headless", "run", "--once"])).toEqual({ type: "headlessRunOnce" });
  });

  test("parses headless streaming runs", () => {
    expect(parseCliArgs(["headless", "stream", "--once"])).toEqual({ type: "headlessStreamOnce" });
  });

  test("rejects deprecated terminal UI command names", () => {
    expect(() => parseCliArgs(["t" + "ui"])).toThrow("Unknown command");
  });

  test("parses run artifact verification", () => {
    expect(parseCliArgs(["headless", "runs", "verify", "runs/run-a.json"])).toEqual({
      type: "runsVerify",
      filePath: "runs/run-a.json"
    });
  });

  test("parses run artifact replay as a UI command", () => {
    expect(parseCliArgs(["runs", "replay", "runs/run-a.json"])).toEqual({
      type: "runsReplay",
      filePath: "runs/run-a.json"
    });
  });

  test("rejects invalid witness roles", () => {
    expect(() => parseCliArgs(["council", "--role", "bad", "--once"])).toThrow("Unknown witness role: bad");
  });

  test("rejects invalid daemon tick values", () => {
    expect(() => parseCliArgs(["run", "--daemon", "--ticks", "nope"])).toThrow(
      "--ticks must be a positive integer"
    );
  });

  test("rejects missing flag values", () => {
    expect(() => parseCliArgs(["run", "--daemon", "--ticks"])).toThrow("Missing value for --ticks");
  });

  test("rejects unknown commands instead of falling through to help", () => {
    expect(() => parseCliArgs(["unknown"])).toThrow("Unknown command: unknown");
  });
});
