# Work completed

This file records verified outcomes, not plans or untested claims. Update it only after the relevant checks pass.

## Release 1.2

### Standard and data model

- JSON Schema and XML Schema foundations exist.
- Stable typed identifiers and reference validation are implemented.
- Source witnesses, editions, matn tokens, isnad routes, narrator mentions, people, claims, and alignments are modeled separately.
- Ordered isnads and branching representation are supported by the core model.
- Review state, attribution, citations, and confidence can be recorded.

### Real source pilot

- Twelve real occurrences of the intentions narration are staged.
- Five collections are represented: Sahih al-Bukhari, Sunan Abi Dawud, Sunan Ibn Majah, Jamiʿ al-Tirmidhi, and Sunan al-Nasaʾi.
- Source repositories are pinned to exact commits.
- Every imported source file has a locked SHA-256 checksum.
- The importer supports ASCII and Arabic-Indic report numbers and multiple OpenITI heading forms.
- Raw OpenITI evidence is retained beside normalized and machine-segmented candidates.

### Scholarly workbench

- Real-data-first dashboard and witness reader are implemented.
- Matn variants can be compared across imported witnesses.
- Occurrence-specific isnad routes can be viewed as a graph.
- Narrator identity suggestions remain unresolved until reviewed.
- Review decisions persist locally and can be exported as JSON.
- Search, hash navigation, provenance, responsive layout, keyboard focus, and error recovery are implemented.

### Operations and verification

- Deterministic generation is implemented.
- Schema, semantic, negative, UI, and release tests pass.
- The local server provides a health endpoint and defensive HTTP headers.
- CI supports maintained Node.js versions.
- The live local build is served at `http://localhost:8090` when the server is running.

## Current honest status

The software is production-ready research infrastructure for its present scope. The imported records are still an unverified pilot corpus, not a critical edition and not an authenticity judgment. Narrator identities, boundaries, branching interpretations, and scholarly claims require qualified review.

## Interface confirmation

The implemented interface uses the required light appearance. Any future visual work must preserve the rules in [THEME.md](THEME.md).

## Related documents

- [GOAL.md](GOAL.md) defines the destination.
- [NEXT.md](NEXT.md) lists what remains.
- [THEME.md](THEME.md) defines the visual contract.

