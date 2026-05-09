import { describe, expect, test } from "bun:test";
import { parseCliArgs } from "./cli-parser.js";

describe("parseCliArgs", () => {
  test("parses help aliases", () => {
    expect(parseCliArgs([])).toEqual({ type: "help" });
    expect(parseCliArgs(["help"])).toEqual({ type: "help" });
    expect(parseCliArgs(["--help"])).toEqual({ type: "help" });
  });

  test("parses council role runs", () => {
    expect(parseCliArgs(["council", "--role", "law", "--once"])).toEqual({
      type: "councilOnce",
      roleId: "law"
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
