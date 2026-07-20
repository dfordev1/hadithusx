# Deployment

## Local research use

```bash
npm ci
npm run check
npm start
```

Open `http://localhost:8090`.

## Public static hosting

1. Run `npm run build`.
2. Serve the generated `dist/` directory behind HTTPS.
3. Keep Content-Security-Policy, frame, referrer, and MIME-sniffing protections equivalent to `scripts/serve.mjs`.
4. Do not expose write APIs; review decisions are browser-local unless you add your own backend.

## Data boundaries

- OpenITI-derived indexes remain CC BY-NC-SA 4.0 — see `THIRD_PARTY_NOTICES.md`.
- Software code remains MIT.
- Attested narrator authority (`data/narrator-authority.openiti-attested.json`) is corpus-derived vocabulary plus optional Wikidata CC0 enrichment; it is not a verified rijāl edition.
