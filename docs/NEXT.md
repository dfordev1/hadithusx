# Development roadmap

Work from the top downward unless a dependency or verified defect changes the order. Move an item to [DONE.md](DONE.md) only after implementation and testing.

## Phase 1 — narrator authority layer

- Import licensed biographical references with exact citations. **Not started.** The
  narrator authority schema, matching, chronology checks, and review workflow below
  are implemented and tested, but `data/narrator-authority.fixture.json` remains
  explicitly non-historical test fixture data (see its `"no historical claim"`
  citation). No licensed biographical source has been imported yet, and none should
  be added without confirming licensing terms first.
- Record names, kunyas, nisbas, generations, locations, teachers, students, dates, and
  source-specific evaluations. Schema and structural support exist
  (`schema/narrator-authority.schema.json`); real biographical records depend on the
  import above.
- Build candidate matching from narrator mentions to authority records. **Done.**
  `scripts/match-narrator-authority.mjs` / `scripts/lib/narrator-authority.mjs` score
  candidate links between the 6,992 real narrator-mention clusters and authority
  persons using deterministic normalized-surface comparison, with every candidate
  explaining its own score. Verified by `tests/narrator-authority-tests.mjs`
  (18 checks) and exposed via `/api/narrator-authority-candidates`.
- Require human approval for identity resolution and retain rejected alternatives.
  **Done.** The narrator-mentions page (`web/narrators.html`/`.js`) lets a reviewer
  accept, reject, or flag "needs evidence" for each candidate; decisions persist in
  `localStorage` keyed by candidate id (never deleted on rejection) and export as
  `unified-hadith-narrator-authority-review.json`, mirroring the existing
  parallel-candidate review pattern.
- Detect impossible chronology and broken-link candidates as warnings, never
  automatic rulings. **Done.** `detectChronologyWarnings()` compares recorded
  birth/death years on `teacher`/`student` assertions and flags implausible chains or
  unresolved person references as `warning`-typed entries; it never mutates or
  rejects the underlying assertion. Exercised against a deliberately impossible
  fixture case (student's fixture birth year postdates the claimed teacher's fixture
  death year) plus synthetic unit cases for the plausible and broken-link paths.

Next concrete step for this phase: source a properly licensed biographical
reference (with clear reuse terms), import it as real `sources`/`persons`/
`assertions` records, and confirm the matcher and chronology checks above produce
sensible, reviewable output against genuine historical data instead of the fixture.

## Phase 2 — full hadith interchange

- Finalize the normative JSON and XML specifications. **Partially done.**
  `schema/unified-hadith.xsd` now covers the full model field-for-field with
  `schema/unified-hadith.schema.json` (agents, works, editions, persons,
  witnesses/isnads/mentions/identityAssertions, matn/tokens, provenance,
  claims, alignments) rather than only the earlier witness/isnad/mention/matn
  skeleton. "Finalize" still implies the standard leaving `0.x` status per
  `spec/COMPATIBILITY.md`; that requires broader real-world exercise first
  (see Phase 3).
- Model collection, book, chapter, report numbering, commentary, grading, and
  cross-reference systems without overloading fields. **Partially done.**
  `witness.structuredLocator` (optional: `collectionLabel`, `book` required;
  `chapter`, `reportNumber` optional) is now part of the core model in both
  `schema/unified-hadith.schema.json` and `schema/unified-hadith.xsd`,
  additive alongside the existing free-text `locator` — a witness with only
  `locator` remains fully conformant. Field names match what
  `scripts/import-openiti-corpus.mjs` already parses
  (`collectionLabel`/`book`/`chapter`/`reportNumber`), so folding the
  whole-corpus importer's output into this shape is now straightforward.
  **Not done:** commentary, grading, and cross-reference systems are not
  modeled at all yet — `structuredLocator` only addresses bibliographic
  location.
- Add lossless converters and round-trip tests. **Done.**
  `scripts/lib/xml-interchange.mjs` converts every field in both directions;
  `scripts/convert-corpus.mjs` is the CLI entry point
  (`to-xml`/`to-json`); `tests/interchange-tests.mjs` round-trips the real
  corpus fixture through JSON -> XML -> JSON and asserts exact structural
  equality, plus validates the generated XML against
  `schema/unified-hadith.xsd` with `xmllint`.
- Publish conformance fixtures and a compatibility policy. **Done.**
  `spec/COMPATIBILITY.md` documents the `standardVersion` scheme, what
  "lossless" is and isn't a promise about, and points at `data/corpus.json` /
  `data/narrator-authority.fixture.json` as the fixtures an external
  implementation can validate against.
- Create a command-line validator and documented integration API. **Partially
  done.** `node scripts/validate.mjs` and `node scripts/convert-corpus.mjs`
  are documented in `spec/COMPATIBILITY.md` as subprocess-invokable CLI tools
  with no network dependency. Still open: `scripts/validate.mjs` currently
  hardcodes its input paths rather than accepting a file argument like
  `convert-corpus.mjs` does, and there is no published npm package / SDK for
  out-of-repo consumers yet (that's Phase 5).

## Phase 3 — corpus expansion

- Expand beyond the intentions family while preserving reproducible source locks.
- Add canonical collections incrementally, with licensing and provenance reviewed before import.

## Phase 4 — scholarly collaboration

- Add accounts, roles, projects, assignments, and review queues.
- Add immutable revision history and side-by-side change review.
- Support disagreements and multiple scholarly traditions without forcing consensus.
- Add citations, annotations, publication snapshots, and signed review exports.
- Add backups, migrations, observability, privacy controls, and deployment documentation.

## Phase 5 — ecosystem

- Publish the format, validator, sample corpus, and SDKs independently.
- Provide import/export bridges for common research tools and graph formats.
- Establish a transparent governance and versioning process.
- Invite scholarly and technical review before claiming broad standard status.

## Completion rules

An item is not complete merely because a screen exists. It needs appropriate tests, provenance behavior, documentation, accessibility, and an honest statement of scholarly limitations.

## Interface requirement for every phase

Before adding or changing UI, read [THEME.md](THEME.md). All phases retain the white scholarly interface; no dark theme or visually unrelated redesign should be introduced.

## Related documents

- [GOAL.md](GOAL.md) defines why the work exists.
- [DONE.md](DONE.md) records verified outcomes.
- [THEME.md](THEME.md) defines the visual contract.
