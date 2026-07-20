// Self-contained SDK surface for Unified Hadith tooling.
// Everything this package needs lives under sdk/ (this file, sdk/lib/*,
// sdk/fixtures/*) so the package can be extracted, packed, and installed
// on its own — see sdk/README.md for a quickstart and spec/COMPATIBILITY.md
// for the broader interchange standard this SDK implements.

export { validateCorpus } from "./lib/validate-corpus.mjs";
export { corpusToXml, xmlToCorpus } from "./lib/xml-interchange.mjs";
export {
  normalizeArabicSurface,
  matchNarratorAuthorityCandidates,
  detectChronologyWarnings
} from "./lib/narrator-authority.mjs";

export const SDK_VERSION = "0.1.0";
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
