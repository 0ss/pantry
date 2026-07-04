---
description: Pantry status — what's stocked, what's been blocked, is everything wired
---

Show the user the current pantry status. Run the pantry command from your
session context (the line under "Pantry command for this session"; plain
`pantry` if it's on PATH):

1. `<pantry-cmd> stats` — blocks, checks, most-reused modules
2. `<pantry-cmd> doctor` — freshness + wiring

Present both outputs, then one line of your own: the single most duplicated
thing in this repo right now (from the stats), or "pantry's clean" if
there's nothing.
