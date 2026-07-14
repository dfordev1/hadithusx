import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const corpusBytes = await readFile(new URL("data/staging/openiti-five-collections.json.gz", root));
const corpus = JSON.parse(gunzipSync(corpusBytes).toString("utf8"));
const normalizeSurface = (value) => value.normalize("NFC").replace(/[ًٌٍَُِّْـ]/gu, "").replace(/[إأآٱ]/gu, "ا").replace(/ة/gu, "ه").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const mentions = [];
for (const report of corpus.records) {
  for (const mention of report.structure.narratorMentions) {
    const normalizedSurface = normalizeSurface(mention.surface);
    if (normalizedSurface.length < 2 || normalizedSurface.length > 180) continue;
    mentions.push({
      id: `${report.id}:mention:${String(mention.position).padStart(2, "0")}`,
      report: report.id,
      sourceKey: report.sourceKey,
      collectionLabel: report.collectionLabel,
      reportNumber: report.reportNumber,
      occurrence: report.occurrence,
      position: mention.position,
      branch: mention.branch,
      transmissionTerm: mention.transmissionTerm,
      transmissionTermSpan: mention.transmissionTermSpan,
      sourceSpan: mention.sourceSpan,
      surface: mention.surface,
      normalizedSurface,
      identity: null,
      reviewState: "machine-suggested"
    });
  }
}

const groups = new Map();
for (const mention of mentions) {
  const group = groups.get(mention.normalizedSurface) ?? [];
  group.push(mention);
  groups.set(mention.normalizedSurface, group);
}
const clusters = [...groups.entries()].filter(([, group]) => group.length >= 2).map(([normalizedSurface, group]) => {
  const collections = Object.fromEntries([...new Set(group.map((mention) => mention.collectionLabel))].sort().map((collection) => [collection, group.filter((mention) => mention.collectionLabel === collection).length]));
  return {
    id: `uh:cluster:name-${createHash("sha256").update(normalizedSurface).digest("hex").slice(0, 16)}`,
    normalizedSurface,
    occurrenceCount: group.length,
    reportCount: new Set(group.map((mention) => mention.report)).size,
    collections,
    surfaceForms: [...new Set(group.map((mention) => mention.surface))].sort().slice(0, 20),
    exampleMentions: group.slice(0, 12).map((mention) => mention.id),
    method: "exact normalized narrator-surface grouping 0.1",
    candidateType: "surface-cluster-not-person",
    identity: null,
    reviewState: "machine-suggested"
  };
}).sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.normalizedSurface.localeCompare(b.normalizedSurface, "ar"));

const result = { format: "unified-hadith-narrator-mention-index-0.1", sourceCorpusSha256: createHash("sha256").update(corpusBytes).digest("hex"), mentionCount: mentions.length, clusterCount: clusters.length, method: { grouping: "exact normalized surface", automaticPersonCreation: false, minimumClusterOccurrences: 2 }, mentions, clusters };
const json = `${JSON.stringify(result)}\n`;
const compressed = gzipSync(Buffer.from(json), { level: 9, mtime: 0 });
await mkdir(new URL("data/staging/", root), { recursive: true });
await writeFile(new URL("data/staging/openiti-narrator-mentions.json.gz", root), compressed);
await writeFile(new URL("data/staging/openiti-narrator-mentions.manifest.json", root), `${JSON.stringify({ format: result.format, sourceCorpusSha256: result.sourceCorpusSha256, mentionCount: mentions.length, clusterCount: clusters.length, uncompressedSha256: createHash("sha256").update(json).digest("hex"), compressedSha256: createHash("sha256").update(compressed).digest("hex"), compressedBytes: compressed.length, method: result.method }, null, 2)}\n`);
console.log(`Indexed ${mentions.length} narrator mention candidates into ${clusters.length} non-identity surface clusters (${compressed.length} compressed bytes).`);
