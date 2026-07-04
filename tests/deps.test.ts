import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { familiesForNeed, familyForPackage, loadFamilies } from "../src/capabilities/match.js";
import { MalformedPackageJsonError, scanDeps } from "../src/scanner/deps.js";

const families = loadFamilies();
let tmp: string | null = null;

function repo(pkg: unknown, extra: Record<string, unknown> = {}): string {
  tmp = mkdtempSync(join(tmpdir(), "pantry-deps-"));
  writeFileSync(join(tmp, "package.json"), JSON.stringify(pkg));
  for (const [rel, content] of Object.entries(extra)) {
    const abs = join(tmp, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, typeof content === "string" ? content : JSON.stringify(content));
  }
  return tmp;
}

afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = null;
});

describe("familyForPackage", () => {
  const cases: Array<[string, string | null]> = [
    ["moment", "dates"],
    ["dayjs", "dates"],
    ["axios", "http-client"],
    ["lodash-es", "utility-belt"],
    ["uuid", "uuid"],
    ["@paralleldrive/cuid2", "uuid"],
    ["clsx", "classnames"],
    ["zod", "validation"],
    ["react-hook-form", "forms"],
    ["@reduxjs/toolkit", "state"],
    ["@tanstack/react-query", "data-fetching"],
    ["@emotion/styled", "styling"], // scoped wildcard
    ["@mui/material", "ui-kit"], // scoped wildcard
    ["@radix-ui/react-dialog", "ui-kit"],
    ["lucide-react", "icons"],
    ["@tabler/icons-react", "icons"], // suffix wildcard
    ["ag-grid-community", "tables"], // unscoped wildcard
    ["react-hot-toast", "toasts"],
    ["@dnd-kit/core", "dnd"],
    ["qs", "querystring"],
    ["fast-deep-equal", "deep-ops"],
    ["mitt", "events"],
    ["js-yaml", "yaml"],
    ["some-unknown-package", null],
    ["react", null], // frameworks are not a capability family
  ];
  it.each(cases)("%s → %s", (pkg, familyId) => {
    expect(familyForPackage(pkg, families)?.id ?? null).toBe(familyId);
  });
});

describe("familiesForNeed", () => {
  it("maps 'modal' to ui-kit via synonyms", () => {
    expect(familiesForNeed("a delete confirmation modal", families).map((f) => f.id)).toContain(
      "ui-kit",
    );
  });
  it("maps 'relative time' to dates", () => {
    expect(familiesForNeed("relative time on comments", families).map((f) => f.id)).toContain(
      "dates",
    );
  });
  it("finds nothing for gibberish", () => {
    expect(familiesForNeed("quantum flux capacitor", families)).toHaveLength(0);
  });
});

describe("scanDeps", () => {
  it("reads deps with dev flags and families", () => {
    const root = repo({
      dependencies: { dayjs: "^1.0.0", "@mui/material": "^5.0.0" },
      devDependencies: { vitest: "^2.0.0" },
    });
    const deps = scanDeps(root, families);
    expect(deps).toEqual([
      { name: "@mui/material", version: "^5.0.0", family: "ui-kit", usageCount: 0, dev: false },
      { name: "dayjs", version: "^1.0.0", family: "dates", usageCount: 0, dev: false },
      { name: "vitest", version: "^2.0.0", family: "unit-testing", usageCount: 0, dev: true },
    ]);
  });

  it("merges workspace package.jsons", () => {
    const root = repo(
      { workspaces: ["packages/*"], dependencies: { zod: "^3.0.0" } },
      {
        "packages/web/package.json": { dependencies: { dayjs: "^1.0.0" } },
        "packages/api/package.json": { devDependencies: { dayjs: "^1.0.0", pino: "^9.0.0" } },
      },
    );
    const deps = scanDeps(root, families);
    const dayjs = deps.find((d) => d.name === "dayjs");
    expect(dayjs?.dev).toBe(false); // prod in one workspace → prod
    expect(deps.map((d) => d.name)).toEqual(["dayjs", "pino", "zod"]);
  });

  it("merges pnpm-workspace.yaml workspaces (no workspaces field in package.json)", () => {
    const root = repo(
      { name: "pnpm-mono", dependencies: { zod: "^3.0.0" } },
      {
        "pnpm-workspace.yaml": `packages:\n  - "apps/*"\n  - 'packages/*'\n  - "!**/test/**"\n\ncatalog:\n  react: ^18.0.0\n`,
        "apps/web/package.json": { dependencies: { "date-fns": "^4.0.0", luxon: "^3.5.0" } },
        "packages/ui/package.json": { dependencies: { "date-fns": "^4.0.0" } },
      },
    );
    const deps = scanDeps(root, families);
    expect(deps.map((d) => d.name)).toEqual(["date-fns", "luxon", "zod"]);
    expect(deps.filter((d) => d.family === "dates")).toHaveLength(2);
  });

  it("returns [] when there is no package.json", () => {
    tmp = mkdtempSync(join(tmpdir(), "pantry-deps-"));
    expect(scanDeps(tmp, families)).toEqual([]);
  });

  it("throws a clear error on malformed package.json", () => {
    tmp = mkdtempSync(join(tmpdir(), "pantry-deps-"));
    writeFileSync(join(tmp, "package.json"), "{not json");
    expect(() => scanDeps(tmp as string, families)).toThrow(MalformedPackageJsonError);
  });
});
