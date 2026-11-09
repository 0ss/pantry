# 🥫 pantry

**your agent checks the pantry before going shopping.**

told to install moment, no questions asked. this repo has luxon. watch:

![claude refusing to install a duplicate date library](demo/claude-block.gif)

and if an agent ever does run the install anyway, there's a wall behind the advice:

![the install bouncer blocking npm install moment](demo/block.gif)

## the problem

every agent session starts knowing nothing about your repo. so it installs a date library. you have a date library. it writes a fourth `formatDate`. it builds a modal right next to your modal. none of this looks wrong in the diff. six months later your codebase is a junk drawer.

## install (30 seconds)

```
/plugin marketplace add 0ss/pantry
/plugin install pantry@pantry
```

done. next session in a JS/TS repo it stocks itself and the bouncer is on the door. nothing to configure.

want the cli too? `npm i -g pantry-check` then `pantry init && pantry install claude-code`. most people don't need it.

## what it does

pantry keeps a local inventory of what your repo already has. deps grouped by what they're *for*, plus every exported component / hook / util / schema with usage counts. then it shows up exactly where duplication happens:

**your agent tries to install a dupe.** blocked. exit code 2. that message at the top of the readme. not a suggestion, a wall.

**your agent writes a dupe.** it just wrote `formatDate` and you already have one? it gets told immediately, in context, with the file and how many places use it. subagents get the pantry too, so delegated work isn't shopping blind.

**your agent is about to build something.** the skill makes it ask first (also `/pantry-check`):

![pantry check finding an existing modal, then honestly saying the pantry is empty](demo/check.gif)

```
🥫 PANTRY CHECK
Need: date formatting

Already installed:
  ✓ dayjs (package.json, used in 23 files)

Existing code:
  ✓ formatDate(date, format)  src/lib/date.ts:7
  ✓ formatRelativeTime(date)  src/lib/date.ts:12

Used in:
  - src/features/feed/PostCard.tsx
  - src/features/billing/InvoiceRow.tsx

Recommendation:
  Reuse src/lib/date.ts. Do not install another date library.
```

and when you genuinely don't have the thing:

```
🥫 PANTRY CHECK
Need: websocket client with reconnect

Pantry is empty for this. Building new is justified.
```

a tool that always finds "something" is noise. knowing when to shut up is the feature.

## pantry audit

repo health in one shot. real output from a deliberately cursed fixture (moment AND dayjs, three formatDate implementations, uuid on node 20):

![pantry audit on a messy repo](demo/audit.gif)

```
🥫 PANTRY AUDIT

Duplicate capability families:
  ✗ 2 date libraries: dayjs (1 file), moment (1 file)

Same export defined in multiple places:
  ~ formatDate × 3
      src/helpers/dates.ts:4 (1 use)
      src/utils/date.ts:4 (1 use)
      src/features/orders/format.ts:2 (0 uses)

Deps the platform already covers:
  ~ dayjs → Intl.DateTimeFormat / Temporal
  ~ moment → Intl.DateTimeFormat / Temporal
  ~ uuid → crypto.randomUUID

5 findings. Deliberate duplicates? `pantry allow <pkg> --reason "..."`
```

`pantry audit --strict` exits 1 when an exclusive family is duplicated. put it in CI and a second date library becomes a failing build.

## benchmarks

coming. we don't print numbers that don't exist.

## agent support

claude code, fully enforced: session + subagent context, install bouncer, write-time dupe detector, skill, `/pantry` commands. other agents later.

## how it works

- scans your repo with oxc (native speed), pulls exports with kind, signature, jsdoc, usage counts from the import graph. incremental after the first pass
- maps deps onto ~30 curated capability families (dates, http, validation, toasts...) with native-platform notes
- everything reads one file: `.pantry/inventory.json`. hooks never scan at query time, the bouncer answers in ~30ms
- scoring is rule based. name match beats synonym beats path, weighted by usage
- deterministic, offline, no LLM, no api keys

## no phone home

zero network calls at runtime. no telemetry, no accounts, nothing. CI greps the source for network imports and fails if one ever shows up. everything lives in `.pantry/` in your repo. full story: [SECURITY.md](SECURITY.md).

## config

`.pantry/config.json`, created by init, committed:

```json
{
  "include": ["**/*.{ts,tsx,js,jsx}"],
  "exclude": [],
  "tokenBudget": 600,
  "blockMode": "block",
  "extraCapabilities": []
}
```

- `blockMode: "warn"` turns the wall into a nag
- `tokenBudget` caps the injected summary (default 600, your context window is not a storage unit)
- `extraCapabilities` for your company-internal families, same shape as the built-in table

`pantry stats` is the scoreboard (installs blocked, checks run, most reused files). `pantry doctor` tells you if anything's unwired or stale.

## faq

**isn't this just grep?**
grep finds strings. pantry answers "do we already have a way to do X". it knows a `Dialog` component beats a variable named dialog, it knows "modal" should find your Dialog, it knows the helper used in 23 files beats the orphan, and it knows when to say "we got nothing, build it". grep can't say that last one.

**what if i WANT two date libraries?**
`pantry allow moment --reason "migrating off it, tracked in #142"`. reason required, lands in a committed file. every deliberate dupe has a paper trail. honestly the most truthful changelog your repo will ever have.

**monorepos?**
flattened. workspace package.jsons get merged (npm, yarn, pnpm), all source gets scanned, but no per-workspace views yet. two packages exporting `formatDate` both show up with paths. fine for most repos, proper support is on the roadmap.

**other languages?**
JS/TS only, on purpose. this is the ecosystem with five maintained date libraries and eleven ways to join class names. the pain lives here.

## non-goals

no embeddings, no LLM calls, no semantic search. no auto-refactoring, pantry points and you decide. no python/go/rust. no backend, no database, no telemetry, no accounts. no vscode extension. no per-workspace monorepo views yet. no css/design-token indexing.

## contributing

the capability table is the fun part. adding a family your ecosystem needs is a 5 line json PR. see [CONTRIBUTING.md](CONTRIBUTING.md).

## uninstall

```
/plugin remove pantry              # plugin install
pantry uninstall claude-code       # cli install, restores settings.json byte for byte
```

`.pantry/` stays because it's yours. delete it and pantry never existed.

## pairs well with

minimalism skills shape *how much* your agent builds. pantry supplies *what already exists*. one kills over-engineering, the other kills reinvention. different sins, run both.

## license

MIT
