import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

describe("package metadata", () => {
  test("exposes Oleander as the installable CLI binary", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      bin?: Record<string, string>;
      scripts?: Record<string, string>;
    };

    expect(pkg.bin?.oleander).toBe("./dist/cli.js");
    expect(pkg.bin?.zap).toBe("./dist/cli.js");
    expect(pkg.scripts?.start).toBe("bun dist/cli.js");
    expect(pkg.scripts?.ui).toBe("bun run src/cli.ts");
    expect(pkg.scripts?.["t" + "ui"]).toBeUndefined();
    expect(pkg.scripts?.["headless:run"]).toBe("bun run src/cli.ts headless run --once");
  });
});
