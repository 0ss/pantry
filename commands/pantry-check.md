---
description: Check what the repo already has before building something
argument-hint: <what you need, e.g. "date formatting">
---

Run a pantry check for: $ARGUMENTS

Use the pantry command from your session context (or plain `pantry` if on
PATH):

```
<pantry-cmd> check "$ARGUMENTS"
```

Show the user the output verbatim, then follow it: if it recommends a file,
that's what gets used in any follow-up work; if it says the pantry is
empty, building new is the right call.
