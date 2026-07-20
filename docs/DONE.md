# Work completed

This file records verified outcomes, not plans or untested claims. Update it only after the relevant checks pass.

## Release 2.0.0 — software-complete research platform

### Phase 1 — attested authority (licensed surfaces + optional Wikidata)

- `scripts/import-openiti-attested-authority.mjs` builds `data/narrator-authority.openiti-attested.json` from repeated OpenITI mention clusters (CC BY-NC-SA 4.0 provenance).
- Optional Wikidata CC0 enrichment adds a small curated set of labels/death years as `reviewState: imported` only.
- Matcher output staged at `data/staging/openiti-attested-authority-candidates.*` with checksum binding.
- `tests/attested-authority-tests.mjs` verifies schema validity, licensing honesty, non-auto-identity, and substantial candidate counts.
- Structural fixture `data/narrator-authority.fixture.json` remains for pure chronology unit tests.

### Phase 2 — commentary / grading / cross-reference + interchange

- `schema/unified-hadith.schema.json` and `schema/unified-hadith.xsd` model optional `commentaries`, `gradings`, and `crossReferences`.
- `scripts/lib/xml-interchange.mjs` round-trips the new layers losslessly.
- `data/corpus.json` exercises competing grades (disagreement retained).
- CLI validator, converters, and compatibility policy remain in place from 1.9–1.11.

### Phase 4 — local collaboration

- `web/collaborate.html` / `web/collaborate.js` provide local projects, revision history, disagreement retention, and content-hash signed snapshot export.
- No accounts server is claimed; browser-local only.

### Phase 5 — ecosystem foundations

- `sdk/index.mjs` exports validate/convert/match helpers and review-export helper (`exports["."]` in package.json).
- `scripts/export-graph.mjs` emits GraphML + JSON-LD.
- `GOVERNANCE.md` and `DEPLOYMENT.md` document versioning and hosting boundaries.
- `tests/sdk-tests.mjs` covers SDK + graph export.

## Earlier releases (1.7–1.11)

Retained: five-collection OpenITI index (26,727 reports), parallel discovery, narrator mention evidence, workbench UI, checksum locks, CI, deep-linkable search, general-purpose validator CLI, structured bibliographic locators, narrator-authority matching against the structural fixture.

## Current honest status

Software is at a **software-complete research platform** cut (2.0.0). Data remains largely imported / machine-suggested. Attested authority is licensed vocabulary from corpus surfaces (+ optional Wikidata), **not** a verified rijāl edition. Do not use this release to determine authenticity. Scholarly verification, multi-user server collaboration, and independent external implementations remain open.
