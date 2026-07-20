# @unified-hadith/sdk

Evidence-first hadith interchange helpers, extracted from the
[Unified Hadith Workbench](https://github.com/dfordev1/hadithusx) into a
standalone, installable package. No network access and no scholarly
data are bundled beyond one small `status: "demonstration"` fixture corpus
(`fixtures/demo-corpus.json`) used for local testing — it is not a claim
about any real hadith collection.

## Quickstart (5 minutes)

```js
import { readFile } from "node:fs/promises";
import { validateCorpus, corpusToXml, xmlToCorpus } from "@unified-hadith/sdk";

const corpus = JSON.parse(
  await readFile(new URL("./node_modules/@unified-hadith/sdk/fixtures/demo-corpus.json", import.meta.url))
);

const errors = validateCorpus(corpus);
if (errors.length) throw new Error(errors.join("\n"));

const xml = corpusToXml(corpus);          // lossless JSON -> XML
const roundTripped = xmlToCorpus(xml);    // lossless XML -> JSON
console.log(roundTripped.witnesses.length === corpus.witnesses.length); // true
```

## What's in the package

- `validateCorpus(corpus)` — semantic checks (ids, review states, confidence
  values, dangling references) beyond JSON Schema shape checks.
- `corpusToXml(corpus)` / `xmlToCorpus(xml)` — lossless round-trip conversion
  matching `schema/unified-hadith.schema.json` / `.xsd` in the main repo.
- `matchNarratorAuthorityCandidates(...)` / `detectChronologyWarnings(...)` /
  `normalizeArabicSurface(...)` — pure candidate-matching and warning
  functions. Matches are always `reviewState: "machine-suggested"` with
  `acceptedIdentity: null`; nothing here auto-confirms an identity.
- `createReviewExport({ projectId, reviewer, decisions, notes })` — packages
  reviewer decisions (including disagreements) into a shareable export.
- `SDK_VERSION`, `STANDARD_VERSION` — package and interchange-standard
  version strings.

## What is NOT in this package

No canonical hadith text, no licensed rijāl biographical data, and no
narrator-authority verdicts. This SDK ships evidence-handling *code* only.
For the full corpus, schemas, CLI tools, and web workbench, see the main
repository and `spec/SPECIFICATION.md`.
