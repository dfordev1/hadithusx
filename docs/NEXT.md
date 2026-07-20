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

## Phase 4 — scholarly collaboration

- Local project/history/disagreement/export. **Done** (browser-local).
- Accounts, roles, assignments, server-backed queues, immutable multi-user revision. **Open.**

## Phase 5 — ecosystem

- In-repo SDK + GraphML/JSON-LD export + governance/deployment docs. **Done** as foundations.
- Published npm package, independent implementations, formal external review invitation process. **Open.**

## Interface requirement for every phase

Before adding or changing UI, read [THEME.md](THEME.md). All phases retain the white scholarly interface.
