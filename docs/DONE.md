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

- `web/collaborate.html` / `web/collaborate.js` provide local projects, revision history, disagreement retention, and signed snapshot export.
- No accounts server is claimed; browser-local only.

### Phase 4 addendum — signed-import merge protocol (scoped first increment)

- `web/collaborate-crypto.mjs` (pure, DOM-free logic, importable from both the browser and Node): Ed25519 keypair generation, deterministic canonical-JSON payload signing, detached-signature verification, and `findAttributedDisagreements()` for comparing an imported snapshot's history against the local project's own most-recent judgment per `subjectId`.
- `web/collaborate-crypto-browser.mjs`: thin wrapper adding the `localStorage`-backed per-browser keypair cache (private key never leaves the device; only `publicKeyJwk` is embedded in exports).
- `web/collaborate.js`: export now generates/reuses a real WebCrypto Ed25519 keypair and signs the snapshot payload with a detached signature (`format` bumped to `unified-hadith-collaboration-snapshot-0.2`), replacing the old bare `contentSha256` field that was explicitly documented as "not a cryptographic identity proof." A new "Import signed snapshot" file input verifies the signature on load (rejecting with a visible error on tamper/malformed/wrong-key input, never throwing uncaught) and renders every subject where the imported reviewer's `decision`/`reviewState`/`confidence` differs from the local project's latest judgment as a labeled, attributed disagreement list. Imported decisions are **never** written into local history automatically — this is strictly a read-only comparison view, by design, per the evidence-before-interpretation principle.
- `web/collaborate.html`: adds the import file input, status line, and disagreements panel, with copy explicitly caveating that the signature proves same-key continuity across a browser's exports, not a verified real-world reviewer identity (no accounts server exists in this release).
- `tests/collaborate-crypto-tests.mjs` (new, 19 checks): canonical-JSON stability, keypair generation, sign/verify round-trip, rejection on wrong key / tampered payload / malformed signature, and conflict detection on a synthetic two-reviewer fixture (agreement, decision-only conflict, confidence-only conflict, imported-but-no-local-judgment, and "most recent local decision wins when a subject was revised locally").
- `tests/web-tests.mjs` updated: the old `contentSha256` assertion is replaced with checks that the export path uses real Ed25519 signing, that import/verify wiring exists, and that the UI copy states imports are never silently merged.
- Not done in this increment (left open, see docs/NEXT.md): merging more than two snapshots at once, any UI action to selectively pull an imported decision into local history, and any verified real-world identity binding for the signing key.

### Phase 5 — ecosystem foundations

- `sdk/index.mjs` exports validate/convert/match helpers and review-export helper (`exports["."]` in package.json).
- `scripts/export-graph.mjs` emits GraphML + JSON-LD.
- `GOVERNANCE.md` and `DEPLOYMENT.md` document versioning and hosting boundaries.
- `tests/sdk-tests.mjs` covers SDK + graph export.

### Phase 3 — structural-parsing conformance (first increment)

- `scripts/lib/propose-structure.mjs` extracts `proposeStructure()` (isnad/matn segmentation + narrator-mention extraction) out of `scripts/import-openiti-corpus.mjs` into an importable module; the importer script now delegates to it with identical behavior (verified by `npm run check` staying green through the refactor).
- `sources/conformance/openitiBukhari.fixture.json` records 15 hand-verified Sahih al-Bukhari reports pulled from the real, checksum-pinned OpenITI `0275AH` source in `sources/source-lock.json` (reports 2, 3, 5, 6, 7, 8, 9, 15, 32, 59, 214, 230, 240, 291, 335), spanning multiple book/chapter boundaries and including 8 multi-branch (`ح`) isnads. Each record's expected `boundaryMethod`, `chainSpan.text`, `matnSpan.text`, and `narratorMentions` (branch/transmissionTerm/surface) were confirmed by reading the Arabic source text, not generated blind from the function's own output.
- `tests/structural-conformance-tests.mjs` runs `proposeStructure()` on each fixture report and diffs against the hand-verified expectation, printing a per-field accuracy report and failing below configurable thresholds (boundaryMethod 100%, chainSpan 90%, matnSpan 80%, narratorMentions 80%); wired into `npm test` via `package.json`.
- **Scope limits, stated honestly (see docs/NEXT.md):** only Bukhari has a fixture (15 of ~7,300 reports in that source; the other four locked collections have none yet); the harness is not wired into `import:corpus` as a trust gate, only into `npm test`; two known heuristic gaps (unquoted-matn boundary detection, narrator-surface bleed on complex multi-branch reports with embedded citations) are recorded in the fixture rather than fixed in this increment.

## Earlier releases (1.7–1.11)

Retained: five-collection OpenITI index (26,727 reports), parallel discovery, narrator mention evidence, workbench UI, checksum locks, CI, deep-linkable search, general-purpose validator CLI, structured bibliographic locators, narrator-authority matching against the structural fixture.

## Release 2.0.1 — post-2.0 review fixes

Prompted by an independent multi-agent code/content review after the 2.0.0 release:

- **Fixed: narrator-authority feature was completely non-functional in production.** `scripts/build.mjs` was copying the structural test fixture (`data/narrator-authority.fixture.json`, 2 dummy persons, used only for chronology unit tests) into `dist/narrator-authority.json` instead of the real attested-authority dataset (`data/narrator-authority.openiti-attested.json`, 405 real persons). The live site's `/api/narrator-authority-candidates` therefore returned `candidates: []` for all 6,992 real clusters. Now serves the real attested data and its matched candidates (8,863 candidates after also fixing the normalization gap below).
- **Fixed: narrator-authority candidate ids were positional, not content-derived.** `scripts/lib/narrator-authority.mjs` assigned `candidate.id` from post-sort array position, so a data regeneration could silently reattach a stored human review decision (`web/narrators.js` localStorage, keyed by `candidate.id`) to an unrelated candidate. Ids are now `person:nameForm:cluster`-derived (stable across regenerations of the same underlying data), and `web/narrators.js` additionally compares the stored decision's recorded dataset checksums against the currently-loaded data and labels a decision "stale" if they differ, rather than silently trusting it.
- **Fixed:** `normalizeArabicSurface` did not fold alef maksura (ى) to ya (ي) or hamza-carrying waw/ya (ؤ/ئ), causing false-negative (missed) matches between authority name forms and narrator-mention clusters spelled with the common variant.
- **Fixed:** `scripts/lib/xml-interchange.mjs`'s `getAttr()` treated a present-but-empty XML attribute the same as a missing one, silently dropping legitimately-empty optional string fields on XML→JSON round-trip. Now uses `hasAttribute()` to distinguish absent from empty.
- **Fixed:** `api/handler.mjs` (Vercel serverless adapter) echoed raw exception messages — including absolute filesystem paths — in 500 responses to any caller. Now logs server-side and returns a generic error.
- **Fixed:** `/api/corpus` and `/api/narrators` search accepted unbounded-length `q` query strings before a linear scan over the full dataset; both `scripts/serve.mjs` and `api/handler.mjs` now cap query length to 200 characters.
- **Fixed (UI regressions from the home-page simplification):** the "More advanced views" disclosure's nav lost `position: sticky`; hash/`data-go` navigation into an advanced view (isnad graph, matn variants, identity review, provenance) did not auto-open the `<details>` disclosure it lives in, leaving the active view's own nav entry hidden.
- **Fixed (forward-only, not yet applied to the currently-staged corpus — see docs/NEXT.md's Phase 3 entry):** `scripts/import-openiti-corpus.mjs`'s text cleanup now strips leftover `@MATN@` boundary markers and trailing footnote-digit artifacts from matn text on future imports, with `normalizedText` rebuilt so it stays exactly consistent with `chainSpan`/`matnSpan`/`narratorMentions` offsets (the surface-preservation guarantee).
- **Not fixed, confirmed real, documented:** isnad chains occasionally capturing a matn sentence as a narrator "name"; multi-narrator/divergent chains collapsed into one mention instead of separate branches; Bukhari's `book` field sometimes holding a raw page marker instead of a title; narrator-mention clustering fragmenting one narrator's occurrences across multiple small clusters when co-narrators vary; the narrator-mention-cluster-to-attested-person auto-generated "person" records don't yet disambiguate genuinely distinct people who share a bare single-name surface (e.g. two different scholars both commonly called "سفيان").

## Current honest status

Software is at a **software-complete research platform** cut (2.0.0), with a 2.0.1 fix pass addressing several real correctness/security/data-wiring bugs found by independent review. Data remains largely imported / machine-suggested. Attested authority is licensed vocabulary from corpus surfaces (+ optional Wikidata), **not** a verified rijāl edition. Do not use this release to determine authenticity. A checksum-reconciliation blocker (see docs/NEXT.md, Phase 3) currently prevents safely re-running the whole-corpus import to apply the text-cleanup fix above to the live-staged data. Scholarly verification, multi-user server collaboration, and independent external implementations remain open.
