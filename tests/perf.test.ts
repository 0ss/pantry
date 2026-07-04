import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildInventory } from "../src/inventory/build.js";

// Budgets from the brief, with the allowed 50% regression headroom baked in
// (CI machines are slower than dev laptops): init <3s → fail at 4.5s,
// sync <300ms → fail at 450ms.
const INIT_BUDGET_MS = 4500;
const SYNC_BUDGET_MS = 450;
const FILE_COUNT = 1000;

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "pantry-perf-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "perf-fixture", dependencies: { dayjs: "^1.0.0", zod: "^3.0.0" } }),
  );
  for (let i = 0; i < FILE_COUNT; i++) {
    const dir = join(root, "src", `mod${Math.floor(i / 20)}`);
    mkdirSync(dir, { recursive: true });
    const useJsx = i % 4 === 0;
    const imports =
      i > 0
        ? `import { helper${i - 1} } from "../mod${Math.floor((i - 1) / 20)}/file${i - 1}";\n`
        : "";
    const body = useJsx
      ? `export function Widget${i}({ label }: { label: string }) { return <div>{label}</div>; }\n`
      : `/** Helper number ${i}. */\nexport function helper${i}(input: string): string { return input + ${i}; }\nexport const CONST_${i} = ${i};\n`;
    writeFileSync(join(dir, `file${i}.${useJsx ? "tsx" : "ts"}`), imports + body);
  }
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe(`performance budgets (${FILE_COUNT} files)`, () => {
  it(`cold init under ${INIT_BUDGET_MS}ms`, async () => {
    const started = performance.now();
    const { inventory } = await buildInventory(root);
    const elapsed = performance.now() - started;
    expect(inventory.meta.fileCount).toBe(FILE_COUNT);
    console.log(`cold init: ${Math.round(elapsed)}ms for ${FILE_COUNT} files`);
    expect(elapsed).toBeLessThan(INIT_BUDGET_MS);
  });

  it(`incremental sync after one change under ${SYNC_BUDGET_MS}ms`, async () => {
    // touch one file so exactly one reparse happens
    const target = join(root, "src", "mod0", "file1.ts");
    writeFileSync(target, `export function helper1(input: string): string { return input; }\n`);
    utimesSync(target, new Date(), new Date());

    const started = performance.now();
    const { parsedCount } = await buildInventory(root);
    const elapsed = performance.now() - started;
    console.log(`incremental sync: ${Math.round(elapsed)}ms (${parsedCount} file(s) re-parsed)`);
    expect(parsedCount).toBe(1);
    expect(elapsed).toBeLessThan(SYNC_BUDGET_MS);
  });
});
