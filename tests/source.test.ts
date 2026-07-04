import { beforeAll, describe, expect, it } from "vitest";
import { loadParser, scanSource } from "../src/scanner/source.js";

beforeAll(async () => {
  expect(await loadParser()).toBe(true);
});

describe("export kind classification", () => {
  const cases: Array<{
    name: string;
    file: string;
    source: string;
    expected: Array<[string, string]>;
  }> = [
    {
      name: "PascalCase function with JSX → component",
      file: "Card.tsx",
      source: `export function Card({ title }: { title: string }) { return <div>{title}</div>; }`,
      expected: [["Card", "component"]],
    },
    {
      name: "arrow component → component",
      file: "Badge.tsx",
      source: `export const Badge = ({ label }: { label: string }) => <span>{label}</span>;`,
      expected: [["Badge", "component"]],
    },
    {
      name: "use-prefixed function → hook",
      file: "useThing.ts",
      source: `export function useThing() { return 1; }`,
      expected: [["useThing", "hook"]],
    },
    {
      name: "use-prefixed arrow → hook",
      file: "hooks.ts",
      source: `export const useCounter = (start: number) => start + 1;`,
      expected: [["useCounter", "hook"]],
    },
    {
      name: "camelCase function → util",
      file: "date.ts",
      source: `export function formatDate(date: Date, fmt = "YYYY"): string { return String(date) + fmt; }`,
      expected: [["formatDate", "util"]],
    },
    {
      name: "z.object call → schema",
      file: "schemas.ts",
      source: `import { z } from "zod";\nexport const userSchema = z.object({ id: z.string() });`,
      expected: [["userSchema", "schema"]],
    },
    {
      name: "chained z call → schema",
      file: "schemas.ts",
      source: `import { z } from "zod";\nexport const input = z.object({}).strict();`,
      expected: [["input", "schema"]],
    },
    {
      name: "Schema-suffixed name → schema",
      file: "schemas.ts",
      source: `export const loginSchema = buildValidator({});`,
      expected: [["loginSchema", "schema"]],
    },
    {
      name: "type and interface → type",
      file: "types.ts",
      source: `export type Foo = string;\nexport interface Bar { a: number }`,
      expected: [
        ["Foo", "type"],
        ["Bar", "type"],
      ],
    },
    {
      name: "plain const → constant",
      file: "config.ts",
      source: `export const MAX_RETRIES = 3;`,
      expected: [["MAX_RETRIES", "constant"]],
    },
    {
      name: "default export function component takes filename",
      file: "components/ProfileCard.tsx",
      source: `export default function ({ name }: { name: string }) { return <div>{name}</div>; }`,
      expected: [["ProfileCard", "component"]],
    },
    {
      name: "default export memo(Component) unwraps the HOC",
      file: "Heavy.tsx",
      source: `import { memo } from "react";\nconst Heavy = () => <div />;\nexport default memo(Heavy);`,
      expected: [["Heavy", "component"]],
    },
    {
      name: "default export forwardRef(fn) unwraps",
      file: "Input.tsx",
      source: `import { forwardRef } from "react";\nexport default forwardRef((props, ref) => <input ref={ref} {...props} />);`,
      expected: [["Input", "component"]],
    },
    {
      name: "index.tsx default takes directory name",
      file: "components/Modal/index.tsx",
      source: `export default function () { return <div />; }`,
      expected: [["Modal", "component"]],
    },
    {
      name: "exported class without JSX → util",
      file: "client.ts",
      source: `export class ApiClient { get(url: string) { return url; } }`,
      expected: [["ApiClient", "util"]],
    },
  ];

  it.each(cases)("$name", ({ file, source, expected }) => {
    const scan = scanSource(file, source);
    expect(scan.parseError).toBe(false);
    expect(scan.exports.map((e) => [e.name, e.kind])).toEqual(expected);
  });
});

describe("signatures and docs", () => {
  it("captures a compact params-only signature", () => {
    const scan = scanSource(
      "date.ts",
      `export function formatDate(date: Date | string, format = "MMM D, YYYY"): string { return ""; }`,
    );
    expect(scan.exports[0]?.signature).toBe("(date, format)");
  });

  it("captures the first JSDoc line", () => {
    const scan = scanSource(
      "date.ts",
      `/**\n * Format a date for display.\n * @param date the input\n */\nexport function formatDate(date: string) { return date; }`,
    );
    expect(scan.exports[0]?.doc).toBe("Format a date for display.");
  });

  it("records 1-based line numbers", () => {
    const scan = scanSource("a.ts", `const x = 1;\n\nexport function two() {}\n`);
    expect(scan.exports[0]?.line).toBe(3);
  });
});

describe("imports and re-exports", () => {
  it("collects named, default, namespace, and dynamic imports", () => {
    const scan = scanSource(
      "a.ts",
      `import dayjs from "dayjs";\nimport { x, y } from "./util";\nimport * as ns from "./ns";\nconst lazy = () => import("./lazy");`,
    );
    expect(scan.imports).toEqual([
      { specifier: "dayjs", names: ["default"], namespace: false, dynamic: false },
      { specifier: "./util", names: ["x", "y"], namespace: false, dynamic: false },
      { specifier: "./ns", names: [], namespace: true, dynamic: false },
      { specifier: "./lazy", names: [], namespace: true, dynamic: true },
    ]);
  });

  it("skips type-only imports", () => {
    const scan = scanSource(
      "a.ts",
      `import type { Foo } from "./types";\nimport { type Bar, baz } from "./other";`,
    );
    expect(scan.imports.find((i) => i.specifier === "./types")?.names ?? []).toEqual([]);
    expect(scan.imports.find((i) => i.specifier === "./other")?.names).toEqual(["baz"]);
  });

  it("records star and named re-exports", () => {
    const scan = scanSource(
      "index.ts",
      `export * from "./math";\nexport { a, b as c } from "./letters";`,
    );
    expect(scan.reexports).toEqual([
      { specifier: "./math", names: "all" },
      { specifier: "./letters", names: ["a", "b"] },
    ]);
  });

  it("handles CRLF sources", () => {
    const scan = scanSource("a.ts", `export function one() {}\r\nexport function two() {}\r\n`);
    expect(scan.exports.map((e) => e.name)).toEqual(["one", "two"]);
    expect(scan.exports[1]?.line).toBe(2);
  });

  it("flags unparseable files instead of throwing", () => {
    const scan = scanSource("broken.ts", `export function {{{`);
    expect(scan.parseError).toBe(true);
    expect(scan.exports).toEqual([]);
  });
});
