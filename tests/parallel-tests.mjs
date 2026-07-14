import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const corpusBytes = await readFile(new URL("data/staging/openiti-five-collections.json.gz", root));
const corpus = JSON.parse(gunzipSync(corpusBytes).toString("utf8"));
const parallelBytes = await readFile(new URL("data/staging/openiti-parallel-candidates.json.gz", root));
const parallels = JSON.parse(gunzipSync(parallelBytes).toString("utf8"));
const manifest = JSON.parse(await readFile(new URL("data/staging/openiti-parallel-candidates.manifest.json", root), "utf8"));
const records = new Map(corpus.records.map((record) => [record.id, record]));
const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);
check("parallel checksum matches manifest", createHash("sha256").update(parallelBytes).digest("hex") === manifest.compressedSha256);
check("parallel index is tied to exact corpus", parallels.sourceCorpusSha256 === createHash("sha256").update(corpusBytes).digest("hex"));
check("candidate count is substantial and exact", parallels.candidateCount === manifest.candidateCount && parallels.candidates.length === parallels.candidateCount && parallels.candidateCount > 30000);
check("candidate identifiers are valid and unique", new Set(parallels.candidates.map((candidate) => candidate.id)).size === parallels.candidateCount && parallels.candidates.every((candidate) => /^uh:parallel:machine-\d+$/.test(candidate.id)));
check("all candidates reference existing reports", parallels.candidates.every((candidate) => records.has(candidate.left) && records.has(candidate.right)));
check("candidates are cross-collection only", parallels.candidates.every((candidate) => records.get(candidate.left).sourceKey !== records.get(candidate.right).sourceKey));
check("every candidate exposes shared four-word evidence", parallels.candidates.every((candidate) => candidate.sharedFourWordSequences.length >= 2 && candidate.sharedFourWordSequences.every((sequence) => sequence.split(" ").length === 4)));
check("every candidate satisfies a declared threshold", parallels.candidates.every((candidate) => candidate.measures.tokenJaccard >= parallels.method.minimumTokenJaccard || candidate.measures.shorterTextContainment >= parallels.method.minimumShorterTextContainment));
check("no candidate is automatically accepted", parallels.candidates.every((candidate) => candidate.reviewState === "machine-suggested" && candidate.acceptedAlignment === null));
check("confidence remains categorical", parallels.candidates.every((candidate) => ["probable", "possible", "uncertain"].includes(candidate.confidence)));

let failures = 0;
for (const [name, passed] of checks) { console.log(`${passed ? "PASS" : "FAIL"} ${name}`); if (!passed) failures++; }
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} parallel-discovery tests passed.`);
