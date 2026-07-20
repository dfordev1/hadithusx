# Unified Hadith Workbench 2.0

Unified Hadith is an evidence-first data standard and scholarly workbench for hadith studies. It keeps source text, editorial interpretation, narrator identity, scholarly judgment, and machine-generated suggestions as separate, traceable layers.

> Release status: **software-complete research platform** with imported/machine-suggested pilot data. It is not a scholarly edition and must not be used to determine hadith authenticity.

## What’s in 2.0

- Everything from 1.7–1.11 (five-collection OpenITI index, parallels, narrator mentions, workbench, JSON↔XML interchange, validator CLI, deep links)
- Commentary / grading / cross-reference model with disagreement retention
- OpenITI-attested narrator authority vocabulary + optional Wikidata CC0 enrichment
- Local collaboration workspace with revision history and hashed snapshot export
- In-repo SDK (`sdk/index.mjs`) and GraphML/JSON-LD export
- Governance and deployment docs

## Run it

```bash
npm ci
npm run check
npm start
```

Then open `http://localhost:8090`.

- Whole corpus: `/corpus.html`
- Narrators: `/narrators.html`
- Collaboration: `/collaborate.html`
- Health: `/healthz`

## Key commands

```bash
npm run validate
npm run convert:to-xml -- data/corpus.json tmp/corpus.xml
npm run export:graph
npm run import:attested-authority
npm run match:narrator-authority
```

## Honest boundaries

- OpenITI indexes: CC BY-NC-SA 4.0 (`THIRD_PARTY_NOTICES.md`)
- Code: MIT
- Attested authority is **not** a verified biographical encyclopedia
- Machine suggestions never auto-merge identities or invent authenticity grades

## Project continuity

- [Product goal](docs/GOAL.md)
- [Verified work completed](docs/DONE.md)
- [Ordered next steps](docs/NEXT.md)
- [Theme contract](docs/THEME.md)
- [Governance](GOVERNANCE.md)
- [Deployment](DEPLOYMENT.md)
