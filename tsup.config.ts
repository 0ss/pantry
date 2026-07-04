import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    "hooks/pretooluse": "src/hooks/pretooluse.ts",
    "hooks/sessionstart": "src/hooks/sessionstart.ts",
    "hooks/posttooluse": "src/hooks/posttooluse.ts",
    "hooks/subagentstart": "src/hooks/subagentstart.ts",
  },
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  // splitting keeps dynamic imports lazy — the bouncer must not pay for the
  // scanner (tinyglobby etc.) unless it actually needs the fallback path
  splitting: true,
  sourcemap: false,
  // hooks must run from a bare git clone (plugin install = no node_modules),
  // so pure-JS deps get bundled in. oxc-parser is native and stays external —
  // code loads it lazily and degrades to deps-only scanning without it.
  noExternal: ["tinyglobby", "picocolors"],
  external: ["oxc-parser"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
