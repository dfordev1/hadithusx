# Production release checklist

## Included in 1.7

- Fresh deterministic build with `npm ci && npm run check`
- Five collections from three pinned OpenITI repositories, with checksums for every upstream source file
- Deterministic 26,727-report compressed index with per-collection totals and duplicate-number occurrence identifiers
- Bounded, paginated Arabic corpus-search API and responsive white-theme corpus browser
- Explicit exact and normalized Arabic search semantics
- Measured corpus-wide structural candidates with exact offsets and honest unsegmented records
- Checksum-bound cross-collection parallel discovery with shared-phrase evidence and similarity measures
- Bounded parallel API plus persistent, exportable review decisions that never auto-create alignments
- Corpus-wide branch-aware narrator mention extraction with exact evidence offsets
- Checksum-bound name-form clustering, bounded narrator APIs, and an explicit zero-auto-identity invariant
- Explicit OpenITI attribution and CC BY-NC-SA 4.0 notices
- No dependency on the local upstream checkout at runtime
- No automatic narrator merge or authenticity grading
- Search, navigation, responsive layout, and keyboard focus states
- Persistent review decisions and portable export
- Explicit chain-switch preservation, source spans, and non-destructive segmentation corrections
- Visible provenance and methodological limitations
- HTTP health check and defensive response headers
- CI across supported Node.js LTS versions

## Operational deployment

The bundled server binds to `127.0.0.1` intentionally. For public deployment, place the generated `dist/` directory behind a maintained HTTPS static host and retain equivalent Content Security Policy, frame, referrer, and MIME-sniffing protections.

## Scholarly publication gate

Do not relabel imported or machine-suggested records as verified until identified reviewers approve the source transcription, boundaries, identity assertions, and citations. Software readiness and scholarly verification are separate release dimensions.
