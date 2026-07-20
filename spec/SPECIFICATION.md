# Unified Hadith Data Model 0.1

## 1. Scope

Unified Hadith encodes textual witnesses, their transmission chains, proposed narrator identities, textual relationships, and attributed scholarly claims. It is an interchange and preservation model, not an automated grading methodology.

## 2. Normative principles

1. A witness is one occurrence of a report in one identified source edition.
2. Source transcription is immutable evidence. Normalization and correction are annotations.
3. A narrator mention in an isnad is not the same entity as a historical person.
4. Identity resolution is an attributed assertion with confidence and review state.
5. Every scholarly evaluation is a claim with an agent and citation.
6. Every machine inference is labelled with method, software version, and review state.
7. Parallel reports are related without collapsing their independent texts or chains.
8. Graphs, search indexes, and aggregate grades are derived views, never archival truth.

## 3. Core entities

### Work and edition

A `work` represents an intellectual work. An `edition` represents a particular publication, manuscript transcription, or digital source. Witnesses always cite an edition.

### Witness

A `witness` contains bibliographic location, one or more ordered isnads, and an addressable matn. Combined chains are represented as multiple routes with an optional shared segment; they are not flattened into an unordered narrator set.

Bibliographic location has two representations, which may both be present. `locator` is a required free-text string (e.g. `"book 1, report 1"`) and is always the fallback: any edition can be located with it even before structured parsing exists for that source. `structuredLocator` is an optional object (`collectionLabel`, `book`, required; `chapter`, `reportNumber`, optional) for editions where collection/book/chapter/report-number structure has been parsed out — this mirrors the fields the whole-corpus importer (`scripts/import-openiti-corpus.mjs`) already extracts for its own search index. A witness with only `locator` is not less conformant than one with both; `structuredLocator` is additive, not a replacement.

`structuredLocator` models bibliographic addressing. Optional top-level `commentaries`, `gradings`, and `crossReferences` arrays model scholarly annotation layers without overloading witness fields. Competing grades may `contradict` each other; traditions may be labeled without forcing consensus.

### Narrator mention and person

An isnad node preserves the exact name as found in the witness. Its `identityAssertions` propose links to person records. Multiple competing assertions are permitted.

### Claim

A claim is a reified assertion: subject, predicate, object, asserting agent, citation, method, confidence, and review state. Claims may support or contradict other claims.

### Commentary, grading, and cross-reference

- `commentary` attaches attributed notes to a witness or person id.
- `grading` records an attributed grade (`sahih` / `hasan` / `daif` / `mawdu` / `other` / `unspecified`) with optional tradition and contradiction links.
- `crossReference` links two ids with a typed relation (`same-report`, `parallel`, `commentary-on`, `abridgement-of`, `see-also`).

These layers never rewrite source text and never auto-promote machine suggestions to scholar-verified status.

### Alignment

An alignment relates addressable spans from two or more witnesses and classifies the relationship, such as exact, orthographic, abbreviated, expanded, paraphrase, same-event, or possible-parallel.

## 4. Review states

- `imported` — received from an external dataset without local verification
- `machine-suggested` — produced automatically
- `editor-reviewed` — checked by an identified editor
- `scholar-verified` — approved under the project's scholarly review policy
- `disputed` — actively contested
- `rejected` — retained for audit history but not accepted

## 5. Confidence

Confidence is categorical: `certain`, `probable`, `possible`, `uncertain`, or `unknown`. Numeric model scores may be recorded as method metadata but never replace the categorical editorial assessment.

## 6. Provenance

All derived records carry `createdBy`, `createdAt`, `method`, and `derivedFrom`. The intended semantic mapping follows W3C PROV-O: records are entities, processing steps are activities, and humans/software are agents.

## 7. Conformance

A conforming corpus must pass the structural schema and semantic validator. Conformance does not imply historical accuracy or scholarly endorsement.

