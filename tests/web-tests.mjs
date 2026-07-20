import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [html, css, app, corpusText, graphText, importedGraphText, identityText] = await Promise.all([
  readFile(new URL("web/index.html", root), "utf8"),
  readFile(new URL("web/styles.css", root), "utf8"),
  readFile(new URL("web/app.js", root), "utf8"),
  readFile(new URL("data/corpus.json", root), "utf8"),
  readFile(new URL("dist/graph.json", root), "utf8"),
  readFile(new URL("dist/imported-graph.json", root), "utf8"),
  readFile(new URL("dist/identity-suggestions.json", root), "utf8")
]);
const corpusHtml = await readFile(new URL("web/corpus.html", root), "utf8");
const corpusApp = await readFile(new URL("web/corpus.js", root), "utf8");
const narratorHtml = await readFile(new URL("web/narrators.html", root), "utf8");
const narratorApp = await readFile(new URL("web/narrators.js", root), "utf8");

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);
check("document declares UTF-8", /<meta charset="utf-8">/i.test(html));
check("document has responsive viewport", /name="viewport"/i.test(html));
check("document has description", /name="description"/i.test(html));
check("stylesheet is linked", /href="styles\.css"/i.test(html));
check("application module is linked", /src="app\.js"/i.test(html));
check("white theme is mandatory", /color-scheme:\s*light/i.test(css) && /background:#f7f9f8/i.test(css));
check("dark theme declaration is absent", !/color-scheme:\s*dark/i.test(css));
check("whole-corpus browser follows white theme", /href="styles\.css"/.test(corpusHtml) && /theme-color" content="#ffffff"/.test(corpusHtml));
check("whole-corpus browser uses paginated API", /\/api\/corpus/.test(corpusApp) && /data-page/.test(corpusApp));
check("whole-corpus browser exposes exact and normalized modes", /value="normalized"/.test(corpusHtml) && /value="exact"/.test(corpusHtml) && /form\.get\("mode"\)/.test(corpusApp));
check("whole-corpus browser labels machine boundaries", /boundaryMethod/.test(corpusApp));
check("whole-corpus browser exposes parallel discovery", /data-find-parallels/.test(corpusApp) && /\/api\/parallels/.test(corpusApp));
check("parallel candidates show evidence and warning", /sharedFourWordSequences/.test(corpusApp) && /does not prove/.test(corpusApp));
check("parallel decisions persist and export", /localStorage\.setItem\(PARALLEL_REVIEW_KEY/.test(corpusApp) && /unified-hadith-parallel-review\.json/.test(corpusApp));
check("parallel acceptance does not create alignment", /accept-candidate/.test(corpusApp) && !/acceptedAlignment\s*=/.test(corpusApp));
check("narrator corpus browser follows white theme", /href="styles\.css"/.test(narratorHtml) && /theme-color" content="#ffffff"/.test(narratorHtml));
check("narrator browser warns clusters are not people", /not automatic identity/i.test(narratorHtml) && /not a person/.test(narratorApp));
check("narrator browser exposes source evidence", /\/api\/narrator-cluster/.test(narratorApp) && /sourceSpan/.test(narratorApp));
check("narrator browser exposes identity candidates", /data-show-authority/.test(narratorApp) && /\/api\/narrator-authority-candidates/.test(narratorApp));
check("corpus search is deep-linkable via URL hash without a self-triggered loop", /history\.replaceState/.test(corpusApp) && /addEventListener\("hashchange"/.test(corpusApp) && /applySearchHashToForm/.test(corpusApp));
check("narrator search is deep-linkable via URL hash without a self-triggered loop", /history\.replaceState/.test(narratorApp) && /addEventListener\("hashchange"/.test(narratorApp) && /applySearchHashToForm/.test(narratorApp));
check("identity candidates show reasoning and never auto-merge", /candidate\.reason/.test(narratorApp) && !/acceptedIdentity\s*=\s*['"]/.test(narratorApp));
check("identity decisions persist and export, retaining rejected alternatives", /localStorage\.setItem\(AUTHORITY_REVIEW_KEY/.test(narratorApp) && /unified-hadith-narrator-authority-review\.json/.test(narratorApp) && /never deleted on rejection/.test(narratorApp));

const buttonViews = [...html.matchAll(/data-view="([^"]+)"/g)].map((match) => match[1]);
for (const view of buttonViews) check(`view exists: ${view}`, new RegExp(`(?:function\\s+${view}|${view}:\\s*graphView|\\b${view}\ ?[,}])`).test(app));
check("all six workbench views are exposed", buttonViews.length === 6 && new Set(buttonViews).size === 6);

const corpus = JSON.parse(corpusText);
const graph = JSON.parse(graphText);
const realGraph = JSON.parse(importedGraphText);
const identities = JSON.parse(identityText);
const imported = JSON.parse(await readFile(new URL("data/staging/openiti-bukhari-intentions.json", root), "utf8"));
const persons = new Set(corpus.persons.map((person) => person.id));
const witnesses = new Set(corpus.witnesses.map((witness) => witness.id));
check("all graph nodes reference persons", graph.nodes.every((node) => persons.has(node.id)));
check("all graph edges reference nodes", graph.edges.every((edge) => persons.has(edge.from) && persons.has(edge.to)));
check("all graph edges retain witness evidence", graph.edges.every((edge) => witnesses.has(edge.witness) && edge.isnad && edge.term));
const importedCollections = new Set(imported.reports.map((report) => report.collectionLabel));
check("cross-collection OpenITI witnesses are staged", imported.reports.length >= 12 && importedCollections.size === 5);
check("all five intended collections are present", ["Sahih al-Bukhari", "Sunan Abi Dawud", "Sunan Ibn Majah", "Jamiʿ al-Tirmidhi", "Sunan al-Nasaʾi"].every((label) => importedCollections.has(label)));
check("all real witnesses have isnad candidates", imported.reports.every((report) => report.segmentation.chainCandidate && report.segmentation.narratorMentionCandidates.length >= 5));
check("every report has explicit isnad structure", imported.reports.every((report) => report.segmentation.isnadStructure?.branches.length >= 1));
check("Nasa'i combined chain is preserved as branches", imported.reports.some((report) => report.collectionLabel === "Sunan al-Nasaʾi" && report.sourceReportNumber === 75 && report.segmentation.isnadStructure.kind === "explicit-branches" && report.segmentation.isnadStructure.branches.length >= 2));
check("transmission terms retain exact source spans", imported.reports.every((report) => report.segmentation.isnadStructure.branches.every((branch) => branch.narratorMentionCandidates.every((mention) => report.segmentation.chainCandidate.slice(mention.transmissionTermSpan.start, mention.transmissionTermSpan.end) === mention.transmissionTerm && report.segmentation.chainCandidate.slice(mention.sourceSpan.start, mention.sourceSpan.end) === mention.sourceSpan.text))));
check("all real witnesses have matn candidates", imported.reports.every((report) => report.segmentation.matnCandidate));
check("candidate identities remain unresolved", imported.reports.every((report) => report.segmentation.narratorMentionCandidates.every((mention) => mention.identity === null && mention.reviewState === "machine-suggested")));
check("honorifics do not create false عن terms", imported.reports.every((report) => report.segmentation.narratorMentionCandidates.every((mention) => mention.surface !== "ه" && !mention.surface.startsWith("ه،"))));
check("real matn variants drive comparison view", /Matn variants/.test(app) && /reports\.map/.test(app));
const realNodeIds = new Set(realGraph.nodes.map((node) => node.id));
check("real graph has one route per imported witness", new Set(realGraph.nodes.map((node) => node.witness)).size === imported.reports.length);
check("real graph identities remain unresolved", realGraph.nodes.every((node) => node.identity === null && node.reviewState === "machine-suggested"));
check("real graph edges reference mention nodes", realGraph.edges.every((edge) => realNodeIds.has(edge.from) && realNodeIds.has(edge.to)));
check("real graph edges retain source evidence", realGraph.edges.every((edge) => edge.evidence && edge.witness && edge.reviewState === "machine-suggested"));
check("real graph never joins separate branches", realGraph.edges.every((edge) => realGraph.nodes.find((node) => node.id === edge.from)?.branchId === realGraph.nodes.find((node) => node.id === edge.to)?.branchId));
check("identity candidates are generated", identities.suggestions.length > 0);
check("identity candidates never auto-merge", identities.suggestions.every((item) => item.acceptedIdentity === null && item.reviewState === "machine-suggested"));
check("identity candidates explain their score", identities.suggestions.every((item) => item.reason && item.method && item.confidence));
check("review decisions persist locally", /localStorage\.setItem\(REVIEW_KEY/.test(app));
check("segmentation corrections persist separately", /localStorage\.setItem\(SEGMENTATION_KEY/.test(app) && /proposed-correction/.test(app));
check("review export is available", /unified-hadith-review\.json/.test(app));
check("review export includes reversible segmentation patches", /segmentationCorrections/.test(app) && /identityDecisions/.test(app));
check("hash navigation is supported", /hashchange/.test(app) && /location\.hash/.test(app));
check("load failures have a visible recovery state", /workbench could not load/.test(app) && /Retry/.test(app));
check("skip navigation is provided", /class="skip-link"/.test(html));
check("web assets contain no common mojibake", !/[ÃÂâ][\x80-\xBF]/u.test(`${html}\n${app}`));

let failures = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) failures++;
}
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} web smoke tests passed.`);
