# Development roadmap

Work from the top downward unless a dependency or verified defect changes the order. Move an item to [DONE.md](DONE.md) only after implementation and testing.

## Phase 1 — narrator authority layer

- Import licensed biographical references with exact citations. **Partially done.** OpenITI-attested surface authority is imported under CC BY-NC-SA 4.0; optional Wikidata CC0 enrichment exists. A full licensed classical rijāl encyclopedia import is still open and must not be added without confirming reuse terms.
- Record names, kunyas, nisbas, generations, locations, teachers, students, dates, and source-specific evaluations. **Partial** — schema ready; attested surfaces + limited Wikidata death/labels only.
- Candidate matching, human approval workflow, chronology warnings. **Done** (see 1.8 / 2.0).

## Phase 2 — full hadith interchange

- Normative JSON/XML, structured locators, commentary/grading/cross-reference, lossless converters, compatibility policy, CLI validator. **Done for software scope** (standard remains `0.x` until broader external exercise).
- Fold whole-corpus importer locators into every indexed report as first-class `structuredLocator` in a published corpus package. **Still open** (pilot fixture has examples; bulk fold-back remains).

## Phase 3 — corpus expansion

- Expand detailed witness packages beyond the intentions family while preserving reproducible source locks.
- Add canonical collections incrementally, with licensing and provenance reviewed before import.
- **Blocking data-integrity finding (unresolved):** re-cloning all 5 pinned OpenITI source commits listed in `sources/source-lock.json` and hashing the exact checked-out file content (the same method `scripts/import-openiti-corpus.mjs` uses, `sha256(readFile(path, "utf8"))`) produces a **different** `sourceSha256` than the one recorded in `source-lock.json`, for **all five** sources — not just one. This was discovered while investigating confirmed content-quality bugs (leftover `@MATN@` markers and stray footnote digits in the staged corpus text; see below). Because every source mismatches consistently, this looks like a systematic hashing-methodology discrepancy from whatever process originally computed and locked these checksums (e.g. a different git-read path, encoding, or trailing-newline handling) rather than post-hoc tampering — but this has **not** been confirmed either way. Do not regenerate `data/staging/openiti-five-collections.json.gz` (or update `source-lock.json`'s checksums to match a fresh clone) until this is reconciled; doing so without understanding the discrepancy would defeat the entire point of checksum-pinning the source. `scripts/import-openiti-corpus.mjs`'s own checksum assertion already refuses to run against a mismatched checkout, so this blocks any real re-import, not just a hypothetical one.
- **Known, confirmed, and NOT yet fixed in the currently-staged 26,727-report corpus** (blocked on the above): (1) Tirmidhi reports containing literal unstripped `@MATN@` markers and multiple distinct hadiths/editorial commentary fused into one report with no separator; (2) most Nasa'i reports ending in a stray digit glued to the closing quotation mark (an unstripped footnote/reference marker); (3) some isnad chains capturing a full sentence of matn text as if it were a narrator's name; (4) multi-narrator chains joined by "و" or an editorial divergence note collapsed into one `narratorMention` instead of separate branches; (5) Bukhari's `book` field sometimes holding a raw page marker (`[ص: NN]`) instead of a real title. `scripts/import-openiti-corpus.mjs`'s `proposeStructure()`/`clean()` were fixed for (1) and (2) so a *future, checksum-reconciled* re-import will produce clean text — but the already-published `data/staging/openiti-five-collections.json.gz` (and therefore the live site) still contains the old, uncleaned text until that re-import can safely run. (3), (4), (5) are not yet fixed at all; see the new structural-conformance harness (`sources/conformance/`, `tests/structural-conformance-tests.mjs`) for a documented, tested example of (3) on a real Bukhari report.

## Phase 4 — scholarly collaboration

- Local project/history/disagreement/export. **Done** (browser-local).
- Accounts, roles, assignments, server-backed queues, immutable multi-user revision. **Open.**

## Phase 5 — ecosystem

- In-repo SDK + GraphML/JSON-LD export + governance/deployment docs. **Done** as foundations.
- Published npm package, independent implementations, formal external review invitation process. **Open.**

## Interface requirement for every phase

Before adding or changing UI, read [THEME.md](THEME.md). All phases retain the white scholarly interface.
