import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const compressed = await readFile(new URL("data/staging/openiti-five-collections.json.gz", root));
const manifest = JSON.parse(await readFile(new URL("data/staging/openiti-five-collections.manifest.json", root), "utf8"));
const corpus = JSON.parse(gunzipSync(compressed).toString("utf8"));
const lock = JSON.parse(await readFile(new URL("sources/source-lock.json", root), "utf8"));
const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);
check("compressed corpus checksum matches manifest", createHash("sha256").update(compressed).digest("hex") === manifest.compressedSha256);
check("uncompressed corpus checksum matches manifest", createHash("sha256").update(`${JSON.stringify(corpus)}\n`).digest("hex") === manifest.uncompressedSha256);
check("whole-corpus report count is substantial and exact", corpus.reportCount === 26727 && corpus.records.length === corpus.reportCount);
check("per-source counts sum to corpus total", corpus.sources.reduce((sum, source) => sum + source.reports, 0) === corpus.reportCount);
check("all five locked collections are represented", corpus.sources.length === 5 && corpus.sources.every((source) => lock[source.sourceKey]?.commit === source.commit && lock[source.sourceKey]?.sourceSha256 === source.sourceSha256));
check("report identifiers are unique", new Set(corpus.records.map((record) => record.id)).size === corpus.records.length);
check("all records retain locator and imported state", corpus.records.every((record) => Number.isInteger(record.reportNumber) && record.reportNumber > 0 && record.normalizedText && record.reviewState === "imported"));
check("normalized report text is NFC", corpus.records.every((record) => record.normalizedText === record.normalizedText.normalize("NFC")));
check("OpenITI attribution and license are explicit", corpus.license === "CC BY-NC-SA 4.0" && corpus.attribution.includes("OpenITI") && corpus.licenseUrl.startsWith("https://"));

let failures = 0;
for (const [name, passed] of checks) { console.log(`${passed ? "PASS" : "FAIL"} ${name}`); if (!passed) failures++; }
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} whole-corpus tests passed.`);
