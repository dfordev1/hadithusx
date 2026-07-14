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

## Current honest status

The software is production-ready research infrastructure for its present scope. The imported records are still an unverified pilot corpus, not a critical edition and not an authenticity judgment. Narrator identities, boundaries, branching interpretations, and scholarly claims require qualified review.

## Interface confirmation

The implemented interface uses the required light appearance. Any future visual work must preserve the rules in [THEME.md](THEME.md).

## Related documents

- [GOAL.md](GOAL.md) defines the destination.
- [NEXT.md](NEXT.md) lists what remains.
- [THEME.md](THEME.md) defines the visual contract.
