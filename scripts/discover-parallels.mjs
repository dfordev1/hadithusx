import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const compressedCorpus = await readFile(new URL("data/staging/openiti-five-collections.json.gz", root));
const corpus = JSON.parse(gunzipSync(compressedCorpus).toString("utf8"));
const normalize = (value) => value.normalize("NFC").replace(/[ًٌٍَُِّْـ]/gu, "").replace(/[إأآٱ]/gu, "ا").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const tokensFor = (record) => normalize(record.structure.matnSpan?.text || record.normalizedText).split(" ").filter(Boolean).slice(0, 500);
const shingleSet = (tokens, size = 4) => new Set(Array.from({ length: Math.max(0, tokens.length - size + 1) }, (_, index) => tokens.slice(index, index + size).join(" ")));
const tokenSets = corpus.records.map((record) => new Set(tokensFor(record)));
const shingles = corpus.records.map((record) => shingleSet(tokensFor(record)));
const inverted = new Map();
for (let index = 0; index < shingles.length; index++) {
  for (const shingle of shingles[index]) {
    const list = inverted.get(shingle) ?? [];
    if (list.length <= 60) list.push(index);
    inverted.set(shingle, list);
  }
}

const candidatePairs = new Map();
for (const [shingle, indexes] of inverted) {
  if (indexes.length < 2 || indexes.length > 60) continue;
  for (let left = 0; left < indexes.length; left++) for (let right = left + 1; right < indexes.length; right++) {
    const a = indexes[left], b = indexes[right];
    if (corpus.records[a].sourceKey === corpus.records[b].sourceKey) continue;
    const key = `${a}:${b}`;
    const pair = candidatePairs.get(key) ?? { a, b, shared: [] };
    if (pair.shared.length < 12) pair.shared.push(shingle);
    candidatePairs.set(key, pair);
  }
}

const candidates = [];
for (const pair of candidatePairs.values()) {
  if (pair.shared.length < 2) continue;
  const aTokens = tokenSets[pair.a], bTokens = tokenSets[pair.b];
  let intersection = 0;
  for (const token of aTokens) if (bTokens.has(token)) intersection++;
  const union = aTokens.size + bTokens.size - intersection;
  const jaccard = union ? intersection / union : 0;
  const containment = Math.min(aTokens.size, bTokens.size) ? intersection / Math.min(aTokens.size, bTokens.size) : 0;
  if (jaccard < 0.16 && containment < 0.42) continue;
  const left = corpus.records[pair.a], right = corpus.records[pair.b];
  candidates.push({
    id: `uh:parallel:machine-${candidates.length + 1}`,
    left: left.id,
    right: right.id,
    leftCollection: left.collectionLabel,
    rightCollection: right.collectionLabel,
    sharedFourWordSequences: pair.shared.sort(),
    measures: { tokenJaccard: Number(jaccard.toFixed(4)), shorterTextContainment: Number(containment.toFixed(4)), sharedSequenceCount: pair.shared.length },
    method: "shared normalized four-word sequences with token-overlap thresholds 0.1",
    confidence: jaccard >= 0.5 || containment >= 0.75 ? "probable" : jaccard >= 0.3 || containment >= 0.58 ? "possible" : "uncertain",
    reviewState: "machine-suggested",
    acceptedAlignment: null
  });
}
candidates.sort((a, b) => b.measures.shorterTextContainment - a.measures.shorterTextContainment || b.measures.tokenJaccard - a.measures.tokenJaccard || a.left.localeCompare(b.left) || a.right.localeCompare(b.right));
candidates.forEach((candidate, index) => { candidate.id = `uh:parallel:machine-${index + 1}`; });
const result = { format: "unified-hadith-parallel-candidates-0.1", sourceCorpusSha256: createHash("sha256").update(compressedCorpus).digest("hex"), candidateCount: candidates.length, method: { shingleSize: 4, maxShingleFrequency: 60, minimumSharedSequences: 2, minimumTokenJaccard: 0.16, minimumShorterTextContainment: 0.42, crossCollectionOnly: true }, candidates };
const json = `${JSON.stringify(result)}\n`;
const compressed = gzipSync(Buffer.from(json), { level: 9, mtime: 0 });
await mkdir(new URL("data/staging/", root), { recursive: true });
await writeFile(new URL("data/staging/openiti-parallel-candidates.json.gz", root), compressed);
await writeFile(new URL("data/staging/openiti-parallel-candidates.manifest.json", root), `${JSON.stringify({ format: result.format, candidateCount: candidates.length, sourceCorpusSha256: result.sourceCorpusSha256, uncompressedSha256: createHash("sha256").update(json).digest("hex"), compressedSha256: createHash("sha256").update(compressed).digest("hex"), compressedBytes: compressed.length, method: result.method }, null, 2)}\n`);
console.log(`Generated ${candidates.length} explainable cross-collection parallel candidates (${compressed.length} compressed bytes).`);
