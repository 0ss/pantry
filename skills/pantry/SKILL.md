---
name: pantry
description: Check what the repo already has before creating a component, hook, utility, or schema, before adding a dependency, or when the user says "pantry", "check the pantry", or "do we already have". Prevents duplicate code and duplicate dependencies.
---

# Pantry

This repo keeps a local inventory of what already exists. Before you build
or install, check it.

## When to check

- About to create a component, hook, utility, schema, or helper → check first.
- About to add a dependency → check first.
- User asks "do we have X" / "check the pantry" → check.

## How

Your session context includes the exact pantry command for this machine
(look for "Pantry command for this session"). Use it:

```
<pantry-cmd> check "<what you need>"
```

If `pantry` is on PATH, plain `pantry check "..."` works too.

Keep the need SHORT — 2 to 4 words naming the capability, like a search
query, not a sentence. Good: `check "date formatting"`, `check "ui kit"`,
`check "confirmation modal"`. Bad: `check "does the repo already have a
library for formatting dates?"` (sentence words pollute the match).

## Obey the output

- **Recommendation says reuse** → import the module it names. Prefer the
  highest-usage hit; it's the one the codebase already trusts.
- **"Already installed" lists a package** → use that package. Do not install
  an alternative from the same family.
- **"Pantry is empty for this. Building new is justified."** → build it,
  no ceremony. That answer is deliberate, not a failure.
- Cite the reused file in your summary so the reuse is visible.

If the inventory seems stale after big changes, run `pantry sync`.
