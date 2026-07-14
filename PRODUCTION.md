# Production release checklist

## Included in 1.2

- Fresh deterministic build with `npm ci && npm run check`
- Five collections from three pinned OpenITI repositories, with checksums for every upstream source file
- No dependency on the local upstream checkout at runtime
- No automatic narrator merge or authenticity grading
- Search, navigation, responsive layout, and keyboard focus states
- Persistent review decisions and portable export
- Visible provenance and methodological limitations
- HTTP health check and defensive response headers
- CI across supported Node.js LTS versions

## Operational deployment

The bundled server binds to `127.0.0.1` intentionally. For public deployment, place the generated `dist/` directory behind a maintained HTTPS static host and retain equivalent Content Security Policy, frame, referrer, and MIME-sniffing protections.

## Scholarly publication gate

Do not relabel imported or machine-suggested records as verified until identified reviewers approve the source transcription, boundaries, identity assertions, and citations. Software readiness and scholarly verification are separate release dimensions.
