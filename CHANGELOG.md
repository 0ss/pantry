# changelog

## 0.1.0

first release.

- scanner: fast export index (components / hooks / utils / schemas) with
  usage counts from the import graph, barrel resolution, tsconfig paths,
  incremental cache
- capability table: ~30 families mapping packages to what they're for, with
  native-platform notes and block/warn semantics
- `pantry check`: the 🥫 block. deterministic, usage-ranked, and it tells
  you when the pantry is empty instead of inventing relevance
- `pantry audit`: duplicate families, same-name exports, deps the platform
  covers. `--strict` for CI
- `pantry allow` / `stats` / `doctor` / `sync` / `init`
- claude code plugin: session + subagent context injection, install bouncer
  (blocks duplicate deps, exit 2), write-time duplicate detector, skill,
  `/pantry` commands. auto-stocks on first session, zero config
- cli installer (`pantry install claude-code`) with backups and
  byte-identical uninstall restore
- zero runtime network calls, enforced by CI
