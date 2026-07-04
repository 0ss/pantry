import { beforeAll, describe, expect, it } from "vitest";
import { loadParser, scanSource } from "../src/scanner/source.js";
import { countUsage, packageNameOf, resolveSpecifier } from "../src/scanner/usage.js";

beforeAll(async () => {
  expect(await loadParser()).toBe(true);
});

describe("packageNameOf", () => {
  it.each([
    ["dayjs", "dayjs"],
    ["dayjs/plugin/relativeTime", "dayjs"],
    ["@tanstack/react-query", "@tanstack/react-query"],
    ["@mui/material/Button", "@mui/material"],
    ["node:fs", null],
  ])("%s → %s", (spec, expected) => {
    expect(packageNameOf(spec)).toBe(expected);
  });
});

describe("resolveSpecifier", () => {
  const files = new Set(["src/lib/date.ts", "src/components/ui/index.ts", "src/app.tsx"]);
  const aliases = [{ prefix: "@/", target: "src/" }];

  it("resolves relative with extension probing", () => {
    expect(resolveSpecifier("../lib/date", "src/features/Card.tsx", files, aliases)).toBe(
      "src/lib/date.ts",
    );
  });
  it("resolves directory imports to index files", () => {
    expect(resolveSpecifier("./components/ui", "src/app.tsx", files, aliases)).toBe(
      "src/components/ui/index.ts",
    );
  });
  it("resolves tsconfig path aliases", () => {
    expect(resolveSpecifier("@/lib/date", "src/app.tsx", files, aliases)).toBe("src/lib/date.ts");
  });
  it("resolves NodeNext .js specifiers to .ts files", () => {
    expect(resolveSpecifier("./lib/date.js", "src/app.tsx", files, aliases)).toBe(
      "src/lib/date.ts",
    );
  });
  it("returns null for unknown aliases", () => {
    expect(resolveSpecifier("#internal/date", "src/app.tsx", files, aliases)).toBeNull();
  });
});

describe("countUsage", () => {
  it("counts distinct importers per export, tagging test files", () => {
    const scans = [
      scanSource("src/lib/date.ts", `export function formatDate(d: string) { return d; }`),
      scanSource("src/a.ts", `import { formatDate } from "./lib/date";`),
      scanSource("src/b.ts", `import { formatDate } from "./lib/date";`),
      scanSource("src/lib/date.test.ts", `import { formatDate } from "./date";`),
    ];
    const usage = countUsage(scans, []);
    const entry = usage.counts.get("src/lib/date.ts")?.get("formatDate");
    expect(entry?.files.size).toBe(2);
    expect(entry?.testFiles.size).toBe(1);
  });

  it("routes barrel imports through to the defining file", () => {
    const scans = [
      scanSource("src/math.ts", `export function sum(v: number[]) { return 0; }`),
      scanSource("src/index.ts", `export * from "./math";`),
      scanSource("src/app.ts", `import { sum } from "./index";`),
    ];
    const usage = countUsage(scans, []);
    expect(usage.counts.get("src/math.ts")?.get("sum")?.files.size).toBe(1);
  });

  it("counts package imports (including subpaths) once per file", () => {
    const scans = [
      scanSource(
        "src/a.ts",
        `import dayjs from "dayjs";\nimport rel from "dayjs/plugin/relativeTime";`,
      ),
      scanSource("src/b.ts", `import dayjs from "dayjs";`),
    ];
    const usage = countUsage(scans, []);
    expect(usage.depCounts.get("dayjs")?.size).toBe(2);
  });

  it("counts unresolved imports for doctor", () => {
    const scans = [scanSource("src/a.ts", `import { x } from "./does-not-exist";`)];
    const usage = countUsage(scans, []);
    expect(usage.unresolvedImportCount).toBe(1);
  });

  it("counts dynamic imports as usage", () => {
    const scans = [
      scanSource("src/lazy.ts", `export function heavy() { return 1; }`),
      scanSource("src/app.ts", `const load = () => import("./lazy");`),
    ];
    const usage = countUsage(scans, []);
    expect(usage.counts.get("src/lazy.ts")?.get("heavy")?.files.size).toBe(1);
  });
});
