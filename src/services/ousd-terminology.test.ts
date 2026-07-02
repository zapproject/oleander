import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "bun:test";

const ignoredDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "runs"
]);

const ignoredFiles = new Set([
  "bun.lock"
]);

const scannedExtensions = new Set([
  ".css",
  ".html",
  ".json",
  ".md",
  ".sh",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml"
]);

const hasScannedExtension = (filePath: string): boolean =>
  [...scannedExtensions].some((extension) => filePath.endsWith(extension)) || filePath.endsWith(".env.example");

const scanFiles = (dir: string): ReadonlyArray<string> => {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry) || ignoredFiles.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...scanFiles(path));
    } else if (stat.isFile() && hasScannedExtension(path)) {
      files.push(path);
    }
  }
  return files;
};

describe("OUSD terminology", () => {
  test("does not use the legacy settlement asset token in repo text", () => {
    const forbidden = [
      "us" + "dc",
      "usd" + "-coin",
      "usd" + " coin",
      "usd" + "_coin",
      "coinbase.com/price/" + "usd",
      "coingecko.com/en/coins/" + "usd" + "-coin",
      "circle.com/" + "transparency",
      "circle" + " reserve"
    ];
    const offenders: string[] = [];
    for (const file of scanFiles(process.cwd())) {
      const content = readFileSync(file, "utf8").toLowerCase();
      if (forbidden.some((token) => content.includes(token))) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  test("does not use the deprecated terminal UI acronym in repo text", () => {
    const forbidden = new RegExp(`\\b(?:${"T" + "UI"}|${"t" + "ui"})\\b`);
    const offenders: string[] = [];
    for (const file of scanFiles(process.cwd())) {
      const content = readFileSync(file, "utf8");
      if (forbidden.test(content)) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  test("does not use the deprecated witness module name in repo text", () => {
    const forbidden = ["open" + "claw", "open" + " claw"];
    const offenders: string[] = [];
    for (const file of scanFiles(process.cwd())) {
      const content = readFileSync(file, "utf8").toLowerCase();
      if (forbidden.some((token) => content.includes(token))) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
