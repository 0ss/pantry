# Security

## Reporting

Found a vulnerability? Open a private security advisory on GitHub (Security →
Advisories → Report a vulnerability). Please don't open a public issue for
anything exploitable.

## Zero runtime network calls

Pantry never phones home. No telemetry, no analytics, no accounts, no update
checks. The only network activity in pantry's lifetime is `npm install` of
the package itself (or the git clone your plugin manager does).

This is verifiable, not aspirational:

- The source contains no `fetch`, no `http`/`https` imports, no sockets.
- CI runs a grep that fails the build if any network primitive appears in
  `src/` (`.github/workflows/ci.yml`, "no phone home" job).
- Runtime dependencies are exactly three, all local-only: `oxc-parser`
  (parsing), `tinyglobby` (file globbing), `picocolors` (terminal colors).

## Where your data lives

All of it in `.pantry/` inside your repo, all of it plain text you can read:

| file | contents | committed? |
|---|---|---|
| `config.json` | scan globs, token budget, block mode | yes |
| `allow.json` | allowed duplicates + reasons | yes |
| `PANTRY.md` | the agent-facing summary | yes |
| `inventory.json` | export index + dep families | no (gitignored) |
| `cache.json` | parse cache | no |
| `ledger.jsonl` | local event log (blocks, checks) | no |
| `errors.log` | fail-open error trail | no |
| `backups/` | settings.json backups + install manifest | no |

The ledger is local-only and feeds `pantry stats`. Nothing reads it but you.

## What `pantry install claude-code` touches

Exactly two paths, both project-level, both reported file-by-file when it
runs:

1. `.claude/settings.json` — two hook entries added (PreToolUse matcher
   `Bash`, SessionStart). If the file existed, a timestamped backup goes to
   `.pantry/backups/` first. The merge is additive; existing hooks are never
   modified. The file is validated before writing (a malformed hook entry
   would make Claude Code discard the whole settings file).
2. `.claude/skills/pantry/SKILL.md` — the skill file, copied in.

An install manifest (`.pantry/backups/install-manifest.json`) records what
was done so uninstall can undo precisely that:

- If settings.json didn't exist before, uninstall deletes it.
- If it existed and you haven't changed it since, uninstall restores the
  backup byte-for-byte.
- If you edited it after installing, uninstall strips only pantry's hook
  entries (matched by exact command suffix, not by the word "pantry") and
  leaves your edits alone.

The plugin path is even smaller: hooks live inside the plugin directory and
are removed by `/plugin remove pantry`. The plugin writes only `.pantry/` in
repos it scans.

## Injected context and untrusted repos

The SessionStart hook prints `.pantry/PANTRY.md` into the agent's context.
That file is committed, which means a pull request can modify it — including
with adversarial instructions aimed at the agent. This is the same trust
class as `CLAUDE.md`, `AGENTS.md`, or any other repo file an agent reads:
review changes to it like you review changes to CI config. Pantry
regenerates the file from a fresh scan whenever the inventory is missing or
stale, which limits (but does not eliminate) the window for a tampered copy.

Paths written into `.claude/settings.json` hook commands pass a shell-safe
character allowlist first; a path that fails the check is never embedded
(the installer falls back to the bare `pantry` name instead).

## Hook safety posture

Hooks fail open. Any internal error → exit 0 and a line in
`.pantry/errors.log`. A guard that wrongly blocks your agent is worse than no
guard, so pantry never blocks on its own failure — only on a confident
duplicate-dependency verdict (exit 2, with an override documented in the
message itself: `PANTRY_ALLOW=1` or `pantry allow`).
