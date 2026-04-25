import { describe, expect, test } from "bun:test";
import { parseCronMinuteInterval } from "./scheduler.js";

describe("parseCronMinuteInterval", () => {
  test("parses simple minute interval cron", () => {
    expect(parseCronMinuteInterval("*/2 * * * *")).toBe(120000);
  });

  test("returns undefined for unsupported cron shapes", () => {
    expect(parseCronMinuteInterval("0 * * * *")).toBeUndefined();
  });
});
