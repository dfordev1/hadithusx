// Lightweight out-of-repo SDK surface for Unified Hadith tooling.
// Consumers can import from this module or invoke the CLI scripts documented
// in spec/COMPATIBILITY.md.

export { validateCorpus } from "../scripts/lib/validate-corpus.mjs";
export { corpusToXml, xmlToCorpus } from "../scripts/lib/xml-interchange.mjs";
export {
  normalizeArabicSurface,
  matchNarratorAuthorityCandidates,
  detectChronologyWarnings
} from "../scripts/lib/narrator-authority.mjs";

export const SDK_VERSION = "2.0.0";
export const STANDARD_VERSION = "0.1";

export function createReviewExport({ projectId, reviewer, decisions, notes = [] }) {
  const payload = {
    format: "unified-hadith-review-export-0.1",
    projectId,
    reviewer,
    exportedAt: new Date().toISOString(),
    decisionCount: decisions.length,
    decisions,
    notes,
    disagreements: decisions.filter((d) => d.reviewState === "disputed" || d.decision === "needs-evidence")
  };
  return payload;
}
