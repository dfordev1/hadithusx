# Whole-corpus API 0.2

The local corpus service exposes a bounded read API over the reproducible OpenITI-derived working index.

## Metadata

`GET /api/corpus/meta` returns corpus size, source locks, per-source totals, licensing, structural coverage, and supported search modes.

## Search

`GET /api/corpus` accepts:

- `q`: Arabic text, heading text, or report number;
- `collection`: a source key from the metadata response;
- `mode`: `normalized` (default) or `exact`;
- `page`: a positive one-based page number;
- `limit`: 1–50, with 20 as the default.

`normalized` search removes Arabic combining marks and tatweel and folds hamzated alif forms to bare alif. `exact` search preserves spelling and combining marks after Unicode NFC normalization. Both modes are literal substring searches, not morphological search.

Results omit the bulky raw OpenITI block. Every result retains its source key, edition version, report number, duplicate-number occurrence, headings, normalized report text, imported review state, and machine-proposed structure.

## Structural candidates

The index recognizes explicit OpenITI `@MATN@` markers first, then Arabic quotation boundaries. Reports without either remain `unsegmented`. Transmission expressions are preserved with exact character offsets into normalized report text. All structures remain `machine-suggested`; coverage is not scholarly accuracy.

## Stability

The API format is versioned in the response. Consumers must not infer authenticity or narrator identity from search results or machine boundaries.
