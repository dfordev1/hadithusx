# Isnad-cum-matn cluster analysis (staging evidence, not authentication)

Status: first scoped increment, implemented and tested. No schema changes.
No UI/API changes. Output is a staging artifact only, following the same
pattern as `data/staging/openiti-narrator-authority-candidates.*`.

## What this is

`scripts/analyze-isnad-clusters.mjs` joins two things the project already
had, but never joined:

1. matn-similarity candidates (the same shared-four-word-sequence,
   token-overlap method as `scripts/discover-parallels.mjs`), and
2. the structured isnad chains in `data/corpus.json`.

For each cluster of matn-similar witnesses, it builds the **union isnad
chain graph** across all of those witnesses' chains, and computes, per
narrator, how many **distinct younger narrators** they transmit
information *to* ("inform"), across how many **distinct chains**. A
narrator with a high fan-out across multiple independent chains in a
matn-similar cluster is the textbook computational signature classical
isnad criticism calls a **common link** — but this script only ever
produces a `commonLinkCandidate` **evidence object**. It never authenticates
anything, never grades a hadith, and never silently promotes a candidate to
a fact.

## Route direction

`data/corpus.json` isnad `route[]` entries are ordered position 1 (closest
to the compiler / most recent narrator) to position N (closest to the
original authority / oldest). Transmission flows from older to younger:
the narrator at `route[index + 1]` informed the narrator at `route[index]`.
Fan-out is therefore counted in that informer → informed direction, which
is the direction a classical common link is defined in (one older narrator,
many independent younger transmitters).

## Every `commonLinkCandidate` record has

- `agent`: `"uh:agent:isnad-cluster-analyzer"` (a software agent, per
  `docs/GOAL.md` principle 4 — every assertion has an accountable author).
- `citations`: the exact `{ witness, isnad }` pairs of every chain in the
  cluster the computation drew from, so a reviewer can check the source
  chains directly.
- `confidence`: `"possible"` or `"uncertain"` only, derived from fan-out and
  chain-count magnitude. Never `"certain"`.
- `reviewState`: always `"machine-suggested"`.
- `acceptedAsCommonLink`: always `null`. Nothing in this codebase ever sets
  it to anything else; that would require a human/editor workflow this
  increment does not build.
- `identityResolved` / `narratorSurfaceForms`: when a route mention has no
  resolved `identityAssertions`, the candidate is still produced (keyed by
  raw surface text) but is honestly marked `identityResolved: false` — a
  mention is never treated as a confirmed identity.

## Output

- `data/staging/common-link-candidates.json` — deterministic, pretty-printed
  JSON (not gzipped; small enough not to need it for this fixture-scale
  corpus).
- `data/staging/common-link-candidates.manifest.json` — a `sourceCorpusSha256`
  binding it to the exact `data/corpus.json` it was computed from, plus a
  `contentSha256` checksum of the output file itself. Regenerate with
  `npm run analyze:isnad-clusters` and re-check into the repo, same workflow
  as the other staged candidate files.

## Known, honestly documented gap

`data/staging/openiti-parallel-candidates.json.gz` (built by
`scripts/discover-parallels.mjs` from the bulk-imported five-collection
OpenITI corpus) uses the `openiti:` report-id namespace. `data/corpus.json`
(the validated, schema-conformant demonstration corpus with structured
isnad chains) uses the `uh:witness:` namespace. **These two id spaces do not
overlap today**, and the bulk OpenITI corpus does not yet carry
schema-validated isnad chain data at all (only raw `narratorMentions` text
spans). So:

- `resolveStagedParallelPairs()` — the function that would join staged
  cross-collection parallel candidates to known witness ids — exists, is
  unit-tested, and is wired into `scripts/analyze-isnad-clusters.mjs`, but
  **resolves to zero pairs against real data today**. This is not a bug; it
  is documented in the script's own `method.knownGap` field and verified by
  a test that the field is present and non-empty, so nobody mistakes silence
  for "no similar reports exist."
- The only source of real (non-synthetic) matn-similar clusters right now is
  the in-corpus method (`findInCorpusMatnSimilarPairs`), run directly over
  `data/corpus.json`'s own (small, demonstration-status) witness set.
- On the current `data/corpus.json` fixture, this legitimately produces
  **zero `commonLinkCandidate` records**: the one matn-similar pair found
  (`demo-intentions-1` / `demo-intentions-2`) shares a simple two-narrator
  linear chain with no branching, and the witness with a genuinely
  branching two-chain isnad (`demo-intentions-3`) uses different vocabulary
  ("لكل عمل نية" vs. "إنما الأعمال بالنيات") that does not clear the
  lexical matn-similarity threshold. The algorithm's correctness — fan-out
  computation, direction, chain-count gating, non-auto-fact behavior,
  citation completeness, determinism — is instead verified directly against
  synthetic fixtures in `tests/common-link-candidate-tests.mjs`, the same
  approach `tests/narrator-authority-tests.mjs` already uses for exactly
  this reason.

Unifying the two id namespaces (or importing isnad chains for the bulk
OpenITI corpus) is future work, tracked in `docs/NEXT.md`.
