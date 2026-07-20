import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReviewExport, corpusToXml, xmlToCorpus, SDK_VERSION, matchNarratorAuthorityCandidates } from "../sdk/index.mjs";

const run = promisify(execFile);
const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check("SDK version is 2.x", /^2\./.test(SDK_VERSION));
const corpus = JSON.parse(await readFile(new URL("data/corpus.json", root), "utf8"));
const round = xmlToCorpus(corpusToXml(corpus));
check("SDK re-exports lossless XML round-trip", round.witnesses.length === corpus.witnesses.length);
const exportDoc = createReviewExport({
  projectId: "demo",
  reviewer: "tester",
  decisions: [{ id: "d1", decision: "needs-evidence", reviewState: "disputed" }]
});
check("SDK review export retains disagreements", exportDoc.disagreements.length === 1);
check("matcher export is callable from SDK", typeof matchNarratorAuthorityCandidates === "function");

await mkdir(new URL("dist/graph/", root), { recursive: true });
await run(process.execPath, ["scripts/export-graph.mjs"], { cwd: rootPath });
const graphml = await readFile(new URL("dist/graph/corpus.graphml", root), "utf8");
const jsonld = JSON.parse(await readFile(new URL("dist/graph/corpus.jsonld", root), "utf8"));
check("graph export writes GraphML", /<graphml[\s>]/.test(graphml) && /hasMention/.test(graphml));
check("graph export writes JSON-LD", Array.isArray(jsonld["@graph"]) && jsonld["@graph"].length > 0);

let failures = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) failures += 1;
}
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} SDK/graph tests passed.`);
