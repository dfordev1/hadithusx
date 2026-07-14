# Unified Hadith Workbench 1.2

Unified Hadith is an evidence-first data standard and prototype scholarly workbench for hadith studies. It keeps source text, editorial interpretation, narrator identity, scholarly judgment, and machine-generated suggestions as separate, traceable layers.

> Release status: production-ready research software with an imported, unverified pilot corpus. It is not a scholarly edition and must not be used to determine hadith authenticity.

## Production capabilities

- Twelve real source occurrences across Sahih al-Bukhari, Sunan Abi Dawud, Sunan Ibn Majah, Jamiʿ al-Tirmidhi, and Sunan al-Nasaʾi, imported from pinned OpenITI commits
- Source-file and corpus checksums
- Separate raw, normalized, isnad, and matn layers
- Searchable witness reader and parallel matn comparison
- Evidence-linked, occurrence-specific isnad graph
- Reversible narrator identity suggestions with no automatic merging
- Persistent local review decisions and JSON export
- Responsive, keyboard-accessible white interface
- Visible loading failures and a health endpoint
- JSON Schema and XML Schema foundations
- Stable, typed identifiers
- Ordered and branching isnad representation
- Separate narrator mentions and person identities
- Token-addressable matn witnesses and variant alignments
- Sourced claims with confidence and review status
- Deterministic graph and workbench generation
- Corpus, negative, release, and UI smoke tests

## Run it

```bash
npm run check
npm start
```

Then open `http://localhost:8090`. `npm start` always rebuilds the release first.

Health check: `http://localhost:8090/healthz`.

## Review workflow

1. Open **Identity review**.
2. Search or filter the suggestions.
3. Mark each candidate as accepted, rejected, or needing evidence.
4. Use **Export review** to save the decision bundle.

Decisions stay in the browser until exported. Accepting a candidate records a review decision; it does not rewrite source data or silently create a person identity.

## Source reproducibility

The pilot importer locks every source file to an OpenITI repository commit and SHA-256 checksum in `sources/source-lock.json`. The committed staging file allows clean builds without downloading upstream repositories.

To regenerate staging from upstream, clone repositories `0275AH`, `0300AH`, and `0325AH` into the checkout directories recorded by the lock file, check out their recorded commits, and run:

```bash
npm run import:openiti
```

## Repository map

- `spec/` — normative design and identifier rules
- `schema/` — JSON and XML schemas
- `data/` — standard fixtures and real imported staging records
- `docs/` — product goal, completed work, roadmap, and permanent white-theme contract
- `scripts/` — validation, generation, and local server
- `tests/` — positive and negative conformance tests
- `web/` — dependency-free scholarly workbench

The source records in `data/` are authoritative for this release. Generated files in `dist/` must be reproducible from them.

## Project continuity

- [Product goal](docs/GOAL.md)
- [Verified work completed](docs/DONE.md)
- [Ordered next steps](docs/NEXT.md)
- [White interface theme contract](docs/THEME.md)

Read the theme contract before every interface change. `AGENTS.md` preserves these instructions for future development sessions.

## Design principle

The system records that a source or scholar made a claim. It does not silently convert that claim into universal truth. Automated boundaries and identity suggestions are research aids, never authenticity rulings.

## Known scholarly boundary

The software release is operationally production-ready. The pilot records remain `imported` or `machine-suggested`; narrator identities, biographical evidence, transmission continuity, and grading require qualified scholarly review before publication as verified data.
