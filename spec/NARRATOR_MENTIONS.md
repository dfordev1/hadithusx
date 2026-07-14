# Corpus Narrator Mentions 0.1

This layer extracts occurrence-specific narrator mention candidates from machine-proposed chain spans. It supplies evidence for authority work without asserting that any two mentions refer to the same person.

## Extraction

- Transmission expressions are detected only inside the proposed chain span.
- A mention candidate extends from a transmission expression to the next expression or explicit chain-switch marker.
- The exact transmission-term span and full source span are retained as offsets into normalized report text.
- Standalone `ح` chain switches introduce a new branch number and prevent the preceding mention from absorbing the switch marker.
- Empty, non-letter, and implausibly long surfaces are excluded.

All extracted mentions are `machine-suggested` and have `identity: null`.

## Surface clusters

Repeated surfaces are grouped only after conservative normalization: Unicode NFC, combining-mark and tatweel removal, alif folding, ta-marbuta folding, punctuation removal, and whitespace collapse. A cluster requires two occurrences.

A cluster is explicitly `surface-cluster-not-person`. It records occurrence counts, report counts, collection distribution, observed forms, and source-occurrence examples. Exact normalized equality may join homonyms and may separate spelling variants; it is a retrieval aid, not identity resolution.

## Authority boundary

Creating a historical person requires the separate narrator authority model, cited biographical evidence, and human review. This layer never creates authority persons, teacher/student claims, dates, locations, evaluations, or identity assertions.

## API

- `GET /api/narrators/meta` returns mention and cluster totals, corpus checksum, and method safeguards.
- `GET /api/narrators?q=<Arabic>&page=1&limit=20` searches surface clusters with a maximum page size of 50.
- `GET /api/narrator-cluster?id=<cluster-id>` returns the cluster and bounded source examples.

## Interface

The permanent white scholarly interface labels clusters as “not a person” and exposes source report, branch, position, transmission expression, and exact source offsets.
