// Conformance harness for scripts/lib/propose-structure.mjs's proposeStructure().
//
// proposeStructure() does all the load-bearing work of turning raw OpenITI
// report text into isnad/matn segmentation and narrator-mention extraction for
// the whole corpus importer. Until this test existed, nothing checked its
// output against a hand-verified answer for even a single report -- every
// downstream consumer (narrator mention build, narrator-authority matching,
// the review UI) was trusting an unverified heuristic.
//
// sources/conformance/openitiBukhari.fixture.json holds 15 hand-verified
// Sahih al-Bukhari reports (see that file's top-level "description" and each
// report's optional "verificationNote"). This test runs the real
// proposeStructure() function on each report's exact reportText and diffs
// the result against the fixture's expected boundaryMethod, chainSpan.text,
// matnSpan.text, and narratorMentions surfaces, then fails if per-field
// accuracy drops below a configurable threshold.
//
// This is a machine-suggestion QUALITY gate, not a correctness proof: every
// narratorMentions entry proposeStructure emits is still reviewState
// "machine-suggested" and still requires a human identityAssertion before it
// becomes a fact (see sdk/lib/validate-corpus.mjs). This harness only
// keeps the *segmentation heuristic itself* from silently regressing.

import { readFile } from "node:fs/promises";
import { proposeStructure } from "../scripts/lib/propose-structure.mjs";

const root = new URL("../", import.meta.url);
const fixture = JSON.parse(await readFile(new URL("sources/conformance/openitiBukhari.fixture.json", root), "utf8"));

// Configurable per-field accuracy thresholds. matnSpan and narratorMentions
// thresholds are set below 100% on purpose: the fixture deliberately keeps a
// few reports (5, 7, 32) where the current heuristic's real, hand-confirmed
// output falls short of ideal segmentation (see their verificationNote)
// rather than only shipping cases that make the harness look artificially
// perfect. Any regression below these floors should fail CI.
const THRESHOLDS = {
  boundaryMethod: 1,
  chainSpanText: 0.9,
  matnSpanText: 0.8,
  narratorMentionsExact: 0.8
};

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check("fixture has at least 15 hand-verified reports", fixture.reports.length >= 15);
check("every fixture report carries reportText to run proposeStructure on", fixture.reports.every((report) => typeof report.reportText === "string" && report.reportText.length > 0));
check("fixture spans more than one book/chapter", new Set(fixture.reports.map((report) => `${report.book}::${report.chapter}`)).size > 1);
check("fixture includes at least one multi-branch isnad", fixture.reports.some((report) => report.expected.narratorMentions.some((mention) => mention.branch > 1)));

const fieldTallies = {
  boundaryMethod: { correct: 0, total: 0 },
  chainSpanText: { correct: 0, total: 0 },
  matnSpanText: { correct: 0, total: 0 },
  narratorMentionsExact: { correct: 0, total: 0 }
};

const mentionKey = (mention) => `${mention.branch}|${mention.transmissionTerm}|${mention.surface}`;

for (const report of fixture.reports) {
  const actual = proposeStructure(report.reportText);
  const expected = report.expected;

  fieldTallies.boundaryMethod.total++;
  const boundaryMethodMatch = actual.boundaryMethod === expected.boundaryMethod;
  if (boundaryMethodMatch) fieldTallies.boundaryMethod.correct++;

  fieldTallies.chainSpanText.total++;
  const chainSpanMatch = actual.chainSpan.text === expected.chainSpan.text;
  if (chainSpanMatch) fieldTallies.chainSpanText.correct++;

  fieldTallies.matnSpanText.total++;
  const expectedMatnText = expected.matnSpan ? expected.matnSpan.text : null;
  const actualMatnText = actual.matnSpan ? actual.matnSpan.text : null;
  const matnSpanMatch = actualMatnText === expectedMatnText;
  if (matnSpanMatch) fieldTallies.matnSpanText.correct++;

  fieldTallies.narratorMentionsExact.total++;
  const actualSurfaces = actual.narratorMentions.map(mentionKey);
  const expectedSurfaces = expected.narratorMentions.map(mentionKey);
  const mentionsMatch = actualSurfaces.length === expectedSurfaces.length && actualSurfaces.every((value, index) => value === expectedSurfaces[index]);
  if (mentionsMatch) fieldTallies.narratorMentionsExact.correct++;

  if (!(boundaryMethodMatch && chainSpanMatch && matnSpanMatch && mentionsMatch)) {
    console.log(`  DIFF report ${report.reportNumber} (${report.id})${report.verificationNote ? " [known limitation on record]" : ""}`);
    if (!boundaryMethodMatch) console.log(`    boundaryMethod: expected ${JSON.stringify(expected.boundaryMethod)}, got ${JSON.stringify(actual.boundaryMethod)}`);
    if (!chainSpanMatch) console.log(`    chainSpan.text mismatch`);
    if (!matnSpanMatch) console.log(`    matnSpan.text: expected ${JSON.stringify(expectedMatnText)}, got ${JSON.stringify(actualMatnText)}`);
    if (!mentionsMatch) console.log(`    narratorMentions: expected ${JSON.stringify(expectedSurfaces)}, got ${JSON.stringify(actualSurfaces)}`);
  }
}

console.log("Per-field structural-conformance accuracy:");
for (const [field, tally] of Object.entries(fieldTallies)) {
  const accuracy = tally.correct / tally.total;
  const threshold = THRESHOLDS[field];
  const passed = accuracy >= threshold;
  console.log(`  ${passed ? "PASS" : "FAIL"} ${field}: ${tally.correct}/${tally.total} (${(accuracy * 100).toFixed(1)}%), threshold ${(threshold * 100).toFixed(0)}%`);
  check(`${field} accuracy meets threshold`, passed);
}

let failures = 0;
for (const [name, passed] of checks) { console.log(`${passed ? "PASS" : "FAIL"} ${name}`); if (!passed) failures++; }
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} structural-conformance tests passed.`);
