import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const corpusText = await readFile(new URL("data/corpus.json", root), "utf8");
const corpus = JSON.parse(corpusText);
const importedText = await readFile(new URL("data/staging/openiti-bukhari-intentions.json", root), "utf8");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(new URL("web/", root), dist, { recursive: true });
await writeFile(new URL("corpus.json", dist), `${JSON.stringify(corpus, null, 2)}\n`);
await writeFile(new URL("imported-witnesses.json", dist), importedText);

const nodes = corpus.persons.map((person) => ({ id: person.id, label: person.preferredName, type: "person", reviewState: person.reviewState }));
const edges = [];
for (const witness of corpus.witnesses) {
  for (const isnad of witness.isnads) {
    const resolved = isnad.route.map((mention) => mention.identityAssertions[0]?.person).filter(Boolean);
    for (let index = 0; index < resolved.length - 1; index++) {
      edges.push({ id: `${isnad.id}:edge:${index + 1}`, from: resolved[index], to: resolved[index + 1], witness: witness.id, isnad: isnad.id, term: isnad.route[index + 1].transmissionTerm, reviewState: isnad.reviewState });
    }
  }
}
await writeFile(new URL("graph.json", dist), `${JSON.stringify({ nodes, edges }, null, 2)}\n`);
const imported = JSON.parse(importedText);
const importedNodes = [];
const importedEdges = [];
for (const report of imported.reports) {
  const routes = report.segmentation.isnadStructure?.branches ?? [{ id: "branch-1", position: 1, narratorMentionCandidates: report.segmentation.narratorMentionCandidates }];
  for (const branch of routes) {
  const route = branch.narratorMentionCandidates;
  route.forEach((mention) => {
    const nodeId = `${report.stagingId}:${branch.id}:mention:${String(mention.position).padStart(2, "0")}`;
    importedNodes.push({
      id: nodeId,
      label: mention.surface,
      term: mention.transmissionTerm,
      position: mention.position,
      branchId: branch.id,
      branchPosition: branch.position,
      sourceSpan: mention.sourceSpan,
      witness: report.stagingId,
      sourceReportNumber: report.sourceReportNumber,
      collectionLabel: report.collectionLabel,
      identity: null,
      reviewState: mention.reviewState
    });
  });
  for (let index = 0; index < route.length - 1; index++) {
    importedEdges.push({
      id: `${report.stagingId}:${branch.id}:edge:${String(index + 1).padStart(2, "0")}`,
      from: `${report.stagingId}:${branch.id}:mention:${String(index + 1).padStart(2, "0")}`,
      to: `${report.stagingId}:${branch.id}:mention:${String(index + 2).padStart(2, "0")}`,
      witness: report.stagingId,
      sourceReportNumber: report.sourceReportNumber,
      collectionLabel: report.collectionLabel,
      branchId: branch.id,
      evidence: report.rawOpenITI,
      reviewState: "machine-suggested"
    });
  }
  }
}
await writeFile(new URL("imported-graph.json", dist), `${JSON.stringify({ source: imported.source, nodes: importedNodes, edges: importedEdges }, null, 2)}\n`);
const normalizeArabicName = (value) => value
  .normalize("NFC")
  .replace(/[ًٌٍَُِّْـ]/gu, "")
  .replace(/[إأآٱ]/gu, "ا")
  .replace(/ة/gu, "ه")
  .replace(/[^\p{L}\p{N}\s]/gu, " ")
  .replace(/\s+/g, " ")
  .trim();
const identitySuggestions = [];
for (let left = 0; left < importedNodes.length; left++) {
  for (let right = left + 1; right < importedNodes.length; right++) {
    const a = importedNodes[left], b = importedNodes[right];
    if (a.witness === b.witness) continue;
    const aName = normalizeArabicName(a.label), bName = normalizeArabicName(b.label);
    const aTokens = aName.split(" "), bTokens = bName.split(" ");
    const short = aTokens.length <= bTokens.length ? aTokens : bTokens;
    const long = aTokens.length <= bTokens.length ? bTokens : aTokens;
    const contained = short.every((token) => long.includes(token));
    let score = 0, reason = "";
    if (aName === bName) { score = 1; reason = "exact normalized surface match"; }
    else if (contained && short.length >= 2) { score = 0.9; reason = "multi-token name contained in expanded name"; }
    else if (contained && short.length === 1 && a.position === b.position) { score = 0.55; reason = "single-name match at the same chain position; highly ambiguous"; }
    if (!score) continue;
    identitySuggestions.push({
      id: `identity-suggestion:${identitySuggestions.length + 1}`,
      leftMention: a.id,
      rightMention: b.id,
      leftSurface: a.label,
      rightSurface: b.label,
      score,
      confidence: score === 1 ? "probable" : score >= 0.9 ? "possible" : "uncertain",
      reason,
      method: "deterministic Arabic surface-name comparison 0.1",
      reviewState: "machine-suggested",
      acceptedIdentity: null
    });
  }
}
await writeFile(new URL("identity-suggestions.json", dist), `${JSON.stringify({ source: imported.source, suggestions: identitySuggestions }, null, 2)}\n`);
const hash = createHash("sha256").update(corpusText).digest("hex");
await writeFile(new URL("build-manifest.json", dist), `${JSON.stringify({ releaseVersion: packageJson.version, standardVersion: corpus.standardVersion, sourceSha256: hash, generatedFiles: ["corpus.json", "graph.json", "imported-witnesses.json", "imported-graph.json", "identity-suggestions.json"] }, null, 2)}\n`);
console.log(`Built deterministic workbench with ${nodes.length} graph nodes and ${edges.length} evidence-linked edges.`);
