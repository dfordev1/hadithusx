# Governance

Unified Hadith is an evidence-first research standard and workbench.

## Principles

1. Source text is never silently rewritten.
2. Machine suggestions are labeled and never auto-promoted to scholarly truth.
3. Competing traditions and disagreements are retained, not collapsed.
4. Licensing and provenance travel with every imported dataset.
5. Software readiness and scholarly verification are separate release dimensions.

## Versioning

- Software releases use `package.json` SemVer (`2.0.0` for this software-complete platform cut).
- Interchange documents use `standardVersion` / `authorityVersion` under `spec/COMPATIBILITY.md`.
- Breaking schema changes require a `standardVersion` bump and fixtures.

## Review before broad standard claims

Do not claim global interchange-standard status until:

- at least one independent implementation round-trips documents,
- a licensed biographical authority source has been imported and human-reviewed,
- and external scholarly/technical review has been invited and recorded.
