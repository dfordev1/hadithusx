import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const corpusBytes = await readFile(new URL("data/staging/openiti-five-collections.json.gz", root));
const narratorBytes = await readFile(new URL("data/staging/openiti-narrator-mentions.json.gz", root));
const narrators = JSON.parse(gunzipSync(narratorBytes).toString("utf8"));
const manifest = JSON.parse(await readFile(new URL("data/staging/openiti-narrator-mentions.manifest.json", root), "utf8"));
const corpus = JSON.parse(gunzipSync(corpusBytes).toString("utf8"));
const reports = new Map(corpus.records.map((report) => [report.id, report]));
const mentions = new Map(narrators.mentions.map((mention) => [mention.id, mention]));
const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);
check("narrator checksum matches manifest", createHash("sha256").update(narratorBytes).digest("hex") === manifest.compressedSha256);
check("narrator index is tied to exact corpus", narrators.sourceCorpusSha256 === createHash("sha256").update(corpusBytes).digest("hex"));
check("mention and cluster totals are substantial and exact", narrators.mentionCount === 156330 && narrators.mentions.length === narrators.mentionCount && narrators.clusterCount === 6992 && narrators.clusters.length === narrators.clusterCount);
check("mention identifiers are unique", mentions.size === narrators.mentionCount);
check("mentions reference existing reports", narrators.mentions.every((mention) => reports.has(mention.report)));
check("mention term and source spans reproduce evidence", narrators.mentions.every((mention) => { const text = reports.get(mention.report).normalizedText; return text.slice(mention.transmissionTermSpan.start, mention.transmissionTermSpan.end) === mention.transmissionTerm && text.slice(mention.sourceSpan.start, mention.sourceSpan.end) === mention.sourceSpan.text; }));
check("mentions retain valid branch and route positions", narrators.mentions.every((mention) => Number.isInteger(mention.position) && mention.position >= 1 && Number.isInteger(mention.branch) && mention.branch >= 1));
check("clusters reference existing example mentions", narrators.clusters.every((cluster) => cluster.exampleMentions.every((id) => mentions.has(id))));
check("clusters require repeated normalized surfaces", narrators.clusters.every((cluster) => cluster.occurrenceCount >= 2 && cluster.normalizedSurface && cluster.candidateType === "surface-cluster-not-person"));
check("no mention or cluster creates a person identity", narrators.method.automaticPersonCreation === false && narrators.mentions.every((mention) => mention.identity === null) && narrators.clusters.every((cluster) => cluster.identity === null));
check("all narrator evidence remains machine-suggested", narrators.mentions.every((mention) => mention.reviewState === "machine-suggested") && narrators.clusters.every((cluster) => cluster.reviewState === "machine-suggested"));

let failures = 0;
for (const [name, passed] of checks) { console.log(`${passed ? "PASS" : "FAIL"} ${name}`); if (!passed) failures++; }
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} narrator-evidence tests passed.`);
