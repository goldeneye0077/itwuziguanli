import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("root quality gates", () => {
  test("required scripts are defined", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(pkg.scripts).toBeDefined();

    for (const scriptName of ["lint", "typecheck", "test", "build", "smoke"]) {
      expect(typeof pkg.scripts?.[scriptName]).toBe("string");
      expect(pkg.scripts?.[scriptName].length).toBeGreaterThan(0);
    }
  });
});
