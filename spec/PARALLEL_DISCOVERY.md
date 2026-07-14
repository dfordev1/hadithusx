# Explainable Parallel Discovery 0.1

Parallel discovery creates review candidates between reports in different collections. It does not declare two reports identical, establish a common historical origin, or make an authenticity judgment.

## Evidence method

1. Use the machine-proposed matn candidate when available; otherwise use normalized report text.
2. Normalize Unicode, remove Arabic combining marks and tatweel, fold hamzated alif, and remove punctuation.
3. Form sets of four-word sequences.
4. Ignore sequences occurring in more than 60 reports to reduce formulaic noise.
5. Consider cross-collection pairs sharing at least two retained sequences.
6. Retain a pair when token Jaccard similarity is at least 0.16 or shorter-text containment is at least 0.42.

Every candidate records up to twelve shared four-word sequences, both similarity measures, the method version, categorical confidence, and `machine-suggested` review state. `acceptedAlignment` remains null until human review.

## Safeguards

- Same-collection repetitions are excluded from this candidate index.
- Common high-frequency sequences are excluded.
- Candidate generation is deterministic and tied to the exact compressed corpus checksum.
- Similarity labels are prioritization aids, not probabilities.
- No candidate automatically modifies corpus alignments.

## API

`GET /api/parallels?report=<stable-report-id>&limit=10` returns at most 20 candidates with counterpart report text and explainable evidence. The report identifier is required.

## Interface

The white-theme corpus browser displays the shared wording, measures, uncertainty label, and a warning that similarity does not prove a relationship or authenticity.

Reviewers may accept a candidate for further alignment work, reject it, or request more evidence. These decisions remain local and export as a checksum-bound review bundle; accepting a candidate does not create or approve a corpus alignment.
