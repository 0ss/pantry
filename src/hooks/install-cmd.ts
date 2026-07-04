// parse package-manager install commands out of a shell command line.
// this is the regex the whole install-bouncer hangs off, so it gets
// its own file and a pile of tests.

export interface ParsedInstall {
  packages: string[];
}

const INSTALL_RE = /(?:^|&&|;|\|)\s*(?:npx\s+)?(npm|pnpm|yarn|bun)\s+(install|i|add)\b([^&;|]*)/g;

/**
 * Returns the packages being installed, or null if this isn't an install
 * command (or is a bare `npm install` restoring the lockfile).
 */
export function parseInstallCommand(command: string): ParsedInstall | null {
  if (!command) return null;
  const packages: string[] = [];
  let sawInstall = false;

  for (const match of command.matchAll(INSTALL_RE)) {
    const [full, manager, verb, rest] = match;
    // `npx something` is running a package, not installing it
    if (/^\s*npx\s/.test(full)) continue;
    // yarn/bun don't use "install <pkg>" for adding — `yarn install x` isn't a thing
    if ((manager === "yarn" || manager === "bun") && verb !== "add") {
      sawInstall = true;
      continue;
    }
    // pnpm install (no args) = restore; pnpm add = add
    sawInstall = true;
    for (const token of (rest ?? "").trim().split(/\s+/)) {
      if (!token || token.startsWith("-")) continue; // flags like -D, --save-dev
      if (token === "install" || token === "add") continue;
      // strip a version pin: dayjs@1.2.3, but keep @scope/pkg and @scope/pkg@1.2.3
      const pkg = stripVersion(token);
      if (pkg) packages.push(pkg);
    }
  }

  if (!sawInstall) return null;
  return { packages };
}

// what an npm package name can actually look like. anything else (shell
// syntax, urls, paths) is not something we should reason about, let alone
// echo back into a message
const PKG_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i;

function stripVersion(token: string): string | null {
  if (token.startsWith(".") || token.startsWith("/") || token.includes("://")) return null;
  let name: string;
  if (token.startsWith("@")) {
    // @scope/pkg@version → @scope/pkg
    const at = token.indexOf("@", 1);
    name = at === -1 ? token : token.slice(0, at);
  } else {
    const at = token.indexOf("@");
    name = at === -1 ? token : token.slice(0, at);
  }
  return PKG_NAME.test(name) ? name : null;
}
