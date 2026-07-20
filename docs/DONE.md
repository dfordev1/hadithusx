# Work completed

This file records verified outcomes, not plans or untested claims. Update it only after the relevant checks pass.

## Release 1.7

### Standard and data model

- JSON Schema and XML Schema foundations exist.
- Stable typed identifiers and reference validation are implemented.
- Source witnesses, editions, matn tokens, isnad routes, narrator mentions, people, claims, and alignments are modeled separately.
- Ordered isnads and branching representation are supported by the core model.
- Review state, attribution, citations, and confidence can be recorded.
- A separate narrator authority schema now models typed name forms and competing biographical assertions with mandatory source, locator, quotation, licensing, and provenance evidence.

### Real source pilot

- Twelve real occurrences of the intentions narration are staged.
- Five collections are represented: Sahih al-Bukhari, Sunan Abi Dawud, Sunan Ibn Majah, Jamiʿ al-Tirmidhi, and Sunan al-Nasaʾi.
- Source repositories are pinned to exact commits.
- Every imported source file has a locked SHA-256 checksum.
- The importer supports ASCII and Arabic-Indic report numbers and multiple OpenITI heading forms.
- Raw OpenITI evidence is retained beside normalized and machine-segmented candidates.
- Explicit chain switches are represented as separate branches rather than false continuous routes.
- Transmission expressions and machine-proposed narrator segments retain exact normalized-source character spans.
- Real Ibn Majah and Nasaʾi combined-chain cases are covered by regression checks.

### Whole-corpus working model

- All 26,727 non-empty numbered reports from the five locked source editions are represented in a deterministic compressed index.
- Repeated printed report numbers receive stable occurrence suffixes instead of being collapsed.
- Per-source counts, commits, file checksums, corpus checksums, attribution, and license terms are manifest-recorded.
- A bounded server-side API provides Arabic-aware filtering, collection filtering, and pagination without loading the corpus into the browser.
- A responsive white-theme corpus browser exposes the index with imported-data and licensing boundaries visible.
- Search offers explicit normalized and exact Arabic modes; normalized mode folds combining marks, tatweel, and hamzated alif while exact mode preserves spelling.
- Conservative corpus-wide structure processing proposes matn boundaries for 24,991 reports and finds transmission expressions in 26,633 reports.
- The remaining 1,736 reports are explicitly marked `unsegmented` instead of receiving invented boundaries.
- Chain, matn, and transmission-term candidates retain character offsets into normalized evidence text.
- Deterministic discovery produces 39,634 cross-collection parallel candidates tied to the exact corpus checksum.
- Every parallel candidate includes shared four-word evidence, token Jaccard, shorter-text containment, method version, confidence category, and machine-review state.
- Common phrases occurring in more than 60 reports and same-collection pairs are excluded from candidate generation.
- Parallel candidates can be accepted for further study, rejected, or marked as needing evidence; decisions persist locally and export without changing corpus alignments.
- Corpus processing extracts 156,330 occurrence-specific narrator mention candidates with transmission-term and source spans.
- Explicit chain-switch markers assign branch numbers without joining evidence across switches.
- Repeated narrator surfaces form 6,992 checksum-bound retrieval clusters with counts, collection distribution, variants, and source examples.
- Mention and cluster identities remain null, and the method declares that automatic person creation is disabled.
- A responsive white-theme narrator browser provides Arabic search and occurrence evidence through bounded APIs.

### Scholarly workbench

- Real-data-first dashboard and witness reader are implemented.
- Matn variants can be compared across imported witnesses.
- Occurrence-specific isnad routes can be viewed as a graph.
- Narrator identity suggestions remain unresolved until reviewed.
- Review decisions persist locally and can be exported as JSON.
- Scholars can confirm, correct, or flag each proposed isnad branch inside the witness reader.
- Segmentation corrections export as reversible review patches and never overwrite raw evidence.
- Search, hash navigation, provenance, responsive layout, keyboard focus, and error recovery are implemented.

### Operations and verification

- Deterministic generation is implemented.
- Schema, semantic, negative, UI, and release tests pass.
- The local server provides a health endpoint and defensive HTTP headers.
- CI supports maintained Node.js versions.
- Whole-corpus integrity, uniqueness, checksum, API, pagination, and licensing tests are included.
- The live local build is served at `http://localhost:8090` when the server is running.

## Release 1.8

### Narrator authority layer — Phase 1 (partial)

- `scripts/lib/narrator-authority.mjs` implements deterministic, explainable
  candidate matching between the real 6,992-cluster narrator-mention index and
  authority persons, scored by normalized Arabic surface comparison. No score
  performs an automatic merge; every candidate carries `acceptedIdentity: null`
  and `reviewState: "machine-suggested"`.
- The same module implements chronology and broken-link detection: teacher/student
  assertions are checked against recorded birth/death years and flagged as
  warnings (never rulings) when a claimed relationship is chronologically
  impossible or references an unresolved person id.
- `scripts/match-narrator-authority.mjs` stages checksum-bound candidate output
  (`data/staging/openiti-narrator-authority-candidates.json.gz`) tied to the exact
  authority source and narrator index, following the project's existing
  staged-artifact pattern.
- `tests/narrator-authority-tests.mjs` (18 checks) covers both synthetic unit
  cases (exact match, ambiguous single-token match, plausible chronology,
  impossible chronology, broken link) and integration checks against the staged
  real-corpus output.
- The narrator-mentions page exposes a "Show identity candidates" review flow:
  reviewers accept, reject, or flag "needs evidence" per candidate; decisions
  persist locally keyed by candidate id (a rejected candidate's decision is
  retained, not deleted) and export as
  `unified-hadith-narrator-authority-review.json`.
- `/api/narrator-authority-candidates` and `/api/narrator-authority/meta` expose
  this data with the same security headers and bounded-response conventions as
  the rest of the API surface.
- **Not done in this release:** no licensed biographical source has been
  imported. `data/narrator-authority.fixture.json` remains explicitly
  non-historical test data (its citation says so directly), extended only with a
  second fixture person and two fixture assertions used to exercise the
  chronology-warning logic. Real narrator identity resolution against actual
  biographical sources is still open — see `docs/NEXT.md`.

## Release 1.9

### Full hadith interchange — Phase 2 (partial)

- `schema/unified-hadith.xsd` was rewritten to cover the complete corpus model
  field-for-field with `schema/unified-hadith.schema.json` — agents, works,
  editions, persons, witnesses (isnads, mentions, identity assertions), matn
  and tokens, provenance, claims, and alignments — replacing the earlier
  witness/isnad/mention/matn-only skeleton.
- `scripts/lib/xml-interchange.mjs` implements lossless `corpusToXml()` /
  `xmlToCorpus()` covering every field in that schema, including optional
  fields (present fields round-trip, absent fields stay absent rather than
  being invented as empty strings).
- `scripts/convert-corpus.mjs` is a documented CLI (`to-xml` / `to-json`) for
  external tools to convert corpus documents without depending on the
  workbench web app.
- `tests/interchange-tests.mjs` (8 checks) round-trips the real
  `data/corpus.json` fixture through JSON -> XML -> JSON, asserts exact
  structural equality, validates the generated XML against
  `schema/unified-hadith.xsd` with `xmllint`, and confirms malformed XML
  throws instead of silently producing a partial corpus.
- `spec/COMPATIBILITY.md` is new: it defines the `MAJOR.MINOR` versioning
  policy for `standardVersion`, states precisely what the lossless-conversion
  guarantee does and doesn't cover, documents the conformance fixtures, and
  lists the two CLI tools external implementations can invoke directly.
- **Not done in this release:** collection/book/chapter/report-number
  structure is still a flat `locator` string in the core model rather than
  first-class fields (the whole-corpus importer already parses this
  structure for its own index, but it hasn't been folded back into
  `standardVersion: 0.1`); `scripts/validate.mjs` still hardcodes its input
  paths instead of accepting a file argument; there is no published SDK or
  npm package for external consumers (Phase 5). See `docs/NEXT.md`.

Full suite verified clean from a fresh install: `npm run check` passes with
zero failures across schema validation and all test files, including the new
interchange tests.

## Release 1.10

### Structured bibliographic locators — Phase 2 (partial)

- `witness.structuredLocator` (optional `collectionLabel`/`book`, required;
  `chapter`/`reportNumber`, optional) is added to both
  `schema/unified-hadith.schema.json` and `schema/unified-hadith.xsd`,
  additive alongside the existing free-text `locator` so no existing
  conformant document becomes invalid.
- Field names (`collectionLabel`, `book`, `chapter`, `reportNumber`)
  intentionally match what `scripts/import-openiti-corpus.mjs` already
  parses out of OpenITI source headers for its own whole-corpus index, so
  that data can be folded into the core model later without a rename.
- `scripts/lib/xml-interchange.mjs` converts the field losslessly in both
  directions, correctly omitting it when absent rather than inventing an
  empty element.
- `data/corpus.json` now exercises the field on one fixture witness
  (`uh:witness:demo-intentions-1`), leaving the other two fixture witnesses
  without it, so both the "present" and "absent" paths are exercised in
  the same fixture.
- `tests/interchange-tests.mjs` grew two new checks for this field, and the
  round-trip equality check was hardened to compare canonical
  (key-order-independent) JSON instead of raw string equality — the
  previous string-equality check would have been fragile to legitimate,
  non-lossy reordering.
- `spec/SPECIFICATION.md` documents the two-representation model
  (`locator` as the universal fallback, `structuredLocator` as an additive
  refinement) and is explicit that commentary, grading, and cross-reference
  systems are still unmodeled.

Full suite verified clean from a fresh install: 159/159 checks pass.

## Current honest status

The software is production-ready research infrastructure for its present scope. The imported records are still an unverified pilot corpus, not a critical edition and not an authenticity judgment. Narrator identities, boundaries, branching interpretations, and scholarly claims require qualified review. The narrator authority matching, chronology-warning, and review-workflow infrastructure added in 1.8 is real and tested, but it currently operates over non-historical fixture data — it has not yet been exercised against an actual imported biographical source. The 1.9-1.10 interchange and modeling work (XML schema, lossless converter, compatibility policy, structured locators) is real and tested against the existing fixture corpus, but the standard remains pre-1.0: commentary/grading/cross-reference systems are unmodeled, the whole-corpus importer's own structured output hasn't yet been folded into the core model using the new field, and no external implementation has yet round-tripped a document independently written against the spec.

## Interface confirmation

The implemented interface uses the required light appearance. Any future visual work must preserve the rules in [THEME.md](THEME.md).

## Related documents

- [GOAL.md](GOAL.md) defines the destination.
- [NEXT.md](NEXT.md) lists what remains.
- [THEME.md](THEME.md) defines the visual contract.
