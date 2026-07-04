---
description: Repo health — duplicate deps, duplicate code, deps the platform already covers
---

Run the pantry audit using the pantry command from your session context (or
plain `pantry` if on PATH):

```
<pantry-cmd> audit
```

Show the user the full output. Then, if there are findings, propose the
single highest-value cleanup (most-duplicated exclusive family, or the
duplicate export with the most combined usage) — one short paragraph, no
code changes unless asked.
