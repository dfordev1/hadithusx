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
check("structural coverage accounts for every report", corpus.structureCoverage.reports === corpus.reportCount && Object.values(corpus.structureCoverage.byBoundaryMethod).reduce((sum, count) => sum + count, 0) === corpus.reportCount);
check("matn boundary coverage is measured, not universalized", corpus.structureCoverage.withMatnBoundary === 24991 && corpus.structureCoverage.byBoundaryMethod.unsegmented === 1736);
check("transmission term spans reproduce exact text", corpus.records.every((record) => record.structure.transmissionTerms.every((term) => record.normalizedText.slice(term.start, term.end) === term.term)));
check("chain spans reproduce exact text", corpus.records.every((record) => record.normalizedText.slice(record.structure.chainSpan.start, record.structure.chainSpan.end) === record.structure.chainSpan.text));
check("matn spans reproduce candidate text", corpus.records.every((record) => !record.structure.matnSpan || record.normalizedText.slice(record.structure.matnSpan.start, record.structure.matnSpan.end).trim() === record.structure.matnSpan.text));
check("all structural proposals remain machine-suggested", corpus.records.every((record) => record.structure.reviewState === "machine-suggested"));
check("corpus mention spans reproduce exact evidence", corpus.records.every((record) => record.structure.narratorMentions.every((mention) => record.normalizedText.slice(mention.transmissionTermSpan.start, mention.transmissionTermSpan.end) === mention.transmissionTerm && record.normalizedText.slice(mention.sourceSpan.start, mention.sourceSpan.end) === mention.sourceSpan.text)));
check("chain-switch markers reproduce exact evidence", corpus.records.every((record) => record.structure.branchMarkers.every((marker) => record.normalizedText.slice(marker.start, marker.end) === marker.marker) && record.structure.branchCount === record.structure.branchMarkers.length + 1));
check("corpus mentions never resolve identity automatically", corpus.records.every((record) => record.structure.narratorMentions.every((mention) => mention.identity === null && mention.reviewState === "machine-suggested")));

let failures = 0;
for (const [name, passed] of checks) { console.log(`${passed ? "PASS" : "FAIL"} ${name}`); if (!passed) failures++; }
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} whole-corpus tests passed.`);
