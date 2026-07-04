# contributing

## the 5 line PR everyone can make

`src/capabilities/table.json` is the heart of pantry. it maps packages to what they're for, and it will never be complete. adding a family:

```json
{
  "id": "color-manipulation",
  "label": "color library",
  "synonyms": ["color", "colour", "hex", "rgb", "hsl"],
  "packages": ["color", "chroma-js", "tinycolor2", "colord"],
  "native": null,
  "exclusive": true
}
```

field notes:

- `id`: kebab-case, stable, never reused
- `label`: shows up in the block message ("We have a `<label>` at home"), make it read well there
- `synonyms`: what people *ask for*, not what the package is called. these drive `pantry check`
- `packages`: npm names, trailing `*` is a prefix wildcard (`@emotion/*`, `ag-grid-*`)
- `native`: `{ "name", "note" }` if the platform already covers it, else `null`. feeds `audit`
- `exclusive`: `true` means two of these together is near-certainly waste, so the hook BLOCKS. `false` just warns. when in doubt, `false`. blocks have to be right

add one line to the table-driven test in `tests/deps.test.ts` and you're done.

## dev setup

```
npm install
npm run build     # hooks + cli into dist/
npm test          # needs dist/ for the hook simulation tests
npm run lint
npm run typecheck
```

node 20+. the whole suite runs offline.

## ground rules

- **zero runtime network.** CI greps for network primitives in `src/` and fails the build. there is no acceptable reason for pantry to make a request
- **three runtime deps, no more.** a tool built to stop dependency sprawl doesn't get to sprawl. if your change needs a new package it needs a rewrite
- **fail open.** hook code exits 0 on any internal error. blocking someone's agent because we crashed is the one unforgivable bug
- **the output format is frozen.** agents parse the `🥫 PANTRY CHECK` block mid-task. changing it is a breaking change
- persona lives in the readme and block messages. errors and security docs stay plain

## tests

every command has integration coverage, the scanner has table-driven cases. touch scanning or scoring? run the snapshot suite and actually read the diffs. a snapshot changing is a decision, not a formality.
