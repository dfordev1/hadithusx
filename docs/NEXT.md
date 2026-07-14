# Development roadmap

Work from the top downward unless a dependency or verified defect changes the order. Move an item to [DONE.md](DONE.md) only after implementation and testing.

## Phase 1 — narrator authority layer

- Import licensed biographical references with exact citations.
- Record names, kunyas, nisbas, generations, locations, teachers, students, dates, and source-specific evaluations.
- Build candidate matching from narrator mentions to authority records.
- Require human approval for identity resolution and retain rejected alternatives.
- Detect impossible chronology and broken-link candidates as warnings, never automatic rulings.

## Phase 2 — full hadith interchange

- Finalize the normative JSON and XML specifications.
- Model collection, book, chapter, report numbering, commentary, grading, and cross-reference systems without overloading fields.
- Add lossless converters and round-trip tests.
- Publish conformance fixtures and a compatibility policy.
- Create a command-line validator and documented integration API.

## Phase 3 — corpus expansion

- Expand beyond the intentions family while preserving reproducible source locks.
- Add canonical collections incrementally, with licensing and provenance reviewed before import.
- Add parallel-narration discovery with explainable similarity evidence.

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
