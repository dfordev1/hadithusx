import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  findInCorpusMatnSimilarPairs,
  resolveStagedParallelPairs,
  clusterWitnessIds,
  buildCommonLinkCandidates
} from "../scripts/lib/isnad-cluster-analysis.mjs";

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

// --- Unit-style checks on the pure functions, using small synthetic
// fixtures so the algorithm's behavior is verified directly, independent of
// whatever the real demonstration corpus currently happens to cluster. ---

const mention = (position, surface, personId, transmissionTerm = "عن") => ({
  position,
  surface,
  transmissionTerm,
  identityAssertions: personId ? [{ person: personId }] : []
});
const witness = (id, diplomatic, isnads) => ({ id, matn: { diplomatic }, isnads });
const isnad = (id, route) => ({ id, reviewState: "editor-reviewed", route });

{
  // findInCorpusMatnSimilarPairs: near-identical short matns should pair;
  // a completely unrelated matn should not.
  const witnesses = [
    witness("uh:witness:t1", "إنما الأعمال بالنيات", []),
    witness("uh:witness:t2", "الأعمال بالنية", []),
    witness("uh:witness:t3", "قصة أخرى مختلفة تماما بلا علاقة", [])
  ];
  const pairs = findInCorpusMatnSimilarPairs(witnesses);
  check("similar short matns are paired", pairs.some((p) => p.left === "uh:witness:t1" && p.right === "uh:witness:t2"));
  check("unrelated matn is not paired with anything", !pairs.some((p) => p.left === "uh:witness:t3" || p.right === "uh:witness:t3"));
  check("every pair reports a confidence and measures", pairs.every((p) => p.confidence && typeof p.measures.tokenJaccard === "number"));
}

{
  // clusterWitnessIds: union-find groups transitively, drops singletons.
  const clusters = clusterWitnessIds([
    { left: "a", right: "b" },
    { left: "b", right: "c" },
    { left: "x", right: "y" }
  ]);
  check("transitively linked ids form one cluster", clusters.some((c) => c.length === 3 && c.includes("a") && c.includes("b") && c.includes("c")));
  check("a separate pair forms its own cluster", clusters.some((c) => c.length === 2 && c.includes("x") && c.includes("y")));
  check("clustering is deterministic (sorted output)", JSON.stringify(clusters) === JSON.stringify(clusterWitnessIds([
    { left: "a", right: "b" },
    { left: "b", right: "c" },
    { left: "x", right: "y" }
  ])));
}

{
  // resolveStagedParallelPairs: only accepted-similarity or probable
  // candidates whose BOTH endpoints are known witness ids survive.
  const staged = [
    { left: "uh:witness:k1", right: "uh:witness:k2", confidence: "probable", acceptedAlignment: null, method: "m", measures: {} },
    { left: "uh:witness:k1", right: "uh:witness:unknown", confidence: "probable", acceptedAlignment: null, method: "m", measures: {} },
    { left: "uh:witness:k1", right: "uh:witness:k2", confidence: "uncertain", acceptedAlignment: null, method: "m", measures: {} },
    { left: "uh:witness:k1", right: "uh:witness:k2", confidence: "uncertain", acceptedAlignment: "uh:alignment:1", method: "m", measures: {} }
  ];
  const known = new Set(["uh:witness:k1", "uh:witness:k2"]);
  const resolved = resolveStagedParallelPairs(staged, known);
  check("probable pair with both known endpoints resolves", resolved.some((p) => p.confidence === "probable"));
  check("pair with an unknown endpoint is dropped", !resolved.some((p) => p.right === "uh:witness:unknown"));
  check("low-confidence unaccepted pair is dropped, accepted low-confidence pair is kept", resolved.length === 2);
}

{
  // buildCommonLinkCandidates: a narrator who informs two different
  // younger narrators across two different chains is a fan-out candidate.
  // A narrator seen in only one chain, or who only ever informs the same
  // single narrator, is not.
  const w1 = witness("uh:witness:c1", "m", [
    isnad("uh:isnad:c1:a", [mention(1, "younger-a", "uh:person:younger-a"), mention(2, "common", "uh:person:common"), mention(3, "origin", "uh:person:origin")])
  ]);
  const w2 = witness("uh:witness:c2", "m", [
    isnad("uh:isnad:c2:a", [mention(1, "younger-b", "uh:person:younger-b"), mention(2, "common", "uh:person:common"), mention(3, "origin", "uh:person:origin")])
  ]);
  const witnessIndex = new Map([[w1.id, w1], [w2.id, w2]]);
  const candidates = buildCommonLinkCandidates([w1.id, w2.id], witnessIndex);

  const common = candidates.find((c) => c.narrator === "uh:person:common");
  check("a narrator informing two different younger narrators across two chains is flagged", Boolean(common));
  check("its fan-out count is 2", common?.transmissionFanOut === 2);
  check("its chain count is 2", common?.chainCount === 2);
  check("it cites both underlying isnad chains", ["uh:isnad:c1:a", "uh:isnad:c2:a"].every((id) => common.citations.some((c) => c.isnad === id)));
  check("a narrator seen in only one chain is never flagged (chainCount gate)", !candidates.some((c) => c.narrator === "uh:person:younger-a"));
  check("origin (informs nobody older) is never flagged", !candidates.some((c) => c.narrator === "uh:person:origin"));
  check("every candidate is machine-suggested, never auto-confirmed", candidates.every((c) => c.reviewState === "machine-suggested" && c.acceptedAsCommonLink === null));
  check("every candidate names an agent and a non-empty note", candidates.every((c) => c.agent && c.note && c.note.length > 0));
  check("every candidate cites at least one real chain", candidates.every((c) => Array.isArray(c.citations) && c.citations.length > 0));
  check("candidate ids are unique", new Set(candidates.map((c) => c.id)).size === candidates.length);

  const rerun = buildCommonLinkCandidates([w1.id, w2.id], witnessIndex);
  check("computation is deterministic across repeated runs", JSON.stringify(candidates) === JSON.stringify(rerun));
}

{
  // A narrator who always informs the SAME single younger narrator across
  // multiple chains (a plain linear repeated transmission, not a branch)
  // must not be treated as a fan-out candidate.
  const w1 = witness("uh:witness:l1", "m", [isnad("uh:isnad:l1:a", [mention(1, "y", "uh:person:y"), mention(2, "x", "uh:person:x")])]);
  const w2 = witness("uh:witness:l2", "m", [isnad("uh:isnad:l2:a", [mention(1, "y", "uh:person:y"), mention(2, "x", "uh:person:x")])]);
  const witnessIndex = new Map([[w1.id, w1], [w2.id, w2]]);
  const candidates = buildCommonLinkCandidates([w1.id, w2.id], witnessIndex);
  check("a narrator with two chains but only one downstream narrator (no branching) is not flagged", !candidates.some((c) => c.narrator === "uh:person:x"));
}

{
  // Unresolved narrator identity (no identityAssertions) still produces a
  // surface-keyed candidate, but is honestly marked as unresolved.
  const w1 = witness("uh:witness:u1", "m", [isnad("uh:isnad:u1:a", [mention(1, "younger-a", "uh:person:younger-a"), mention(2, "مجهول", null), mention(3, "origin", "uh:person:origin")])]);
  const w2 = witness("uh:witness:u2", "m", [isnad("uh:isnad:u2:a", [mention(1, "younger-b", "uh:person:younger-b"), mention(2, "مجهول", null), mention(3, "origin", "uh:person:origin")])]);
  const witnessIndex = new Map([[w1.id, w1], [w2.id, w2]]);
  const candidates = buildCommonLinkCandidates([w1.id, w2.id], witnessIndex);
  const unresolved = candidates.find((c) => c.narrator === null);
  check("an unresolved narrator surface can still be flagged as a candidate", Boolean(unresolved));
  check("an unresolved candidate is honestly marked identityResolved: false", unresolved?.identityResolved === false);
  check("an unresolved candidate still records its surface form(s)", unresolved?.narratorSurfaceForms.includes("مجهول"));
}

// --- Integration checks against the real staged output ---

const root = new URL("../", import.meta.url);
const corpusText = await readFile(new URL("data/corpus.json", root), "utf8");
const corpus = JSON.parse(corpusText);
const staged = JSON.parse(await readFile(new URL("data/staging/common-link-candidates.json", root), "utf8"));
const manifest = JSON.parse(await readFile(new URL("data/staging/common-link-candidates.manifest.json", root), "utf8"));
const stagedText = `${JSON.stringify(staged, null, 2)}\n`;

check("staged content checksum matches manifest", createHash("sha256").update(stagedText).digest("hex") === manifest.contentSha256);
check("staged output is bound to the exact corpus it was computed from", staged.sourceCorpusSha256 === createHash("sha256").update(corpusText).digest("hex"));
check("staged candidate count matches array length", staged.candidateCount === staged.candidates.length);
check("staged cluster witnesses are all real corpus witness ids", staged.clusters.every((cluster) => cluster.witnesses.every((id) => corpus.witnesses.some((w) => w.id === id))));
check("staged candidates never auto-confirm a common link", staged.candidates.every((c) => c.reviewState === "machine-suggested" && c.acceptedAsCommonLink === null));
check("staged candidates always cite at least one underlying chain", staged.candidates.every((c) => Array.isArray(c.citations) && c.citations.length > 0));
check("staged method documents the known cross-dataset id-namespace gap honestly", typeof staged.method.knownGap === "string" && staged.method.knownGap.length > 0);
check("re-running the staged computation deterministically reproduces the same output", (() => {
  const witnessIndex = new Map(corpus.witnesses.map((w) => [w.id, w]));
  const pairs = findInCorpusMatnSimilarPairs(corpus.witnesses);
  const clusters = clusterWitnessIds(pairs);
  const candidates = clusters.flatMap((cluster) => buildCommonLinkCandidates(cluster, witnessIndex));
  return JSON.stringify(candidates) === JSON.stringify(staged.candidates);
})());

let failures = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) failures++;
}
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} common-link-candidate tests passed.`);
