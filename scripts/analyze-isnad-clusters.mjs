// Isnad-cum-matn cluster analysis: joins matn-similarity candidates with
// data/corpus.json's structured isnad chains to compute commonLinkCandidate
// evidence objects (machine-suggested transmission fan-out signals, never
// authentication rulings). See spec/ISNAD_CLUSTER_ANALYSIS.md and
// docs/NEXT.md for scope and known gaps.
//
//   node scripts/analyze-isnad-clusters.mjs

import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  findInCorpusMatnSimilarPairs,
  resolveStagedParallelPairs,
  clusterWitnessIds,
  buildCommonLinkCandidates
} from "./lib/isnad-cluster-analysis.mjs";

const root = new URL("../", import.meta.url);

const corpusText = await readFile(new URL("data/corpus.json", root), "utf8");
const corpus = JSON.parse(corpusText);

let stagedParallelBytes = null;
let stagedParallelData = null;
try {
  stagedParallelBytes = await readFile(new URL("data/staging/openiti-parallel-candidates.json.gz", root));
  stagedParallelData = JSON.parse(gunzipSync(stagedParallelBytes).toString("utf8"));
} catch {
  // Staged parallel candidates are optional input; if the file has not been
  // generated yet (npm run discover:parallels), we still run on the
  // in-corpus matn-similarity pairs alone.
}

const witnessIndex = new Map(corpus.witnesses.map((witness) => [witness.id, witness]));
const knownWitnessIds = new Set(witnessIndex.keys());

const inCorpusPairs = findInCorpusMatnSimilarPairs(corpus.witnesses);
const stagedPairs = stagedParallelData ? resolveStagedParallelPairs(stagedParallelData.candidates, knownWitnessIds) : [];
const allPairs = [...inCorpusPairs, ...stagedPairs];

const clusters = clusterWitnessIds(allPairs);
const candidates = clusters.flatMap((cluster) => buildCommonLinkCandidates(cluster, witnessIndex));

const result = {
  format: "unified-hadith-common-link-candidates-0.1",
  sourceCorpusSha256: createHash("sha256").update(corpusText).digest("hex"),
  sourceStagedParallelCandidatesSha256: stagedParallelBytes ? createHash("sha256").update(stagedParallelBytes).digest("hex") : null,
  matnSimilarPairCount: allPairs.length,
  matnSimilarClusterCount: clusters.length,
  clusters: clusters.map((cluster, index) => ({ id: `cluster:${index + 1}`, witnesses: cluster })),
  candidateCount: candidates.length,
  candidates,
  method: {
    matnSimilarity: "in-corpus shared normalized four-word sequences with token-overlap thresholds 0.1, plus (when present) staged accepted-or-high-confidence openiti parallel candidates resolved against known witness ids",
    isnadJoin: "union isnad chain graph across all witnesses in a matn-similar cluster; nodes are resolved narrator identities where available, otherwise raw mention surface text",
    fanOutDefinition: "route position 1 is the narrator closest to the compiler; higher positions are older. Fan-out for narrator X is the count of distinct younger (lower-position) narrators X's mentions transmit to (inform), across all isnad chains in the cluster -- the direction in which a classical common link is defined",
    minimumFanOut: 2,
    minimumChainCount: 2,
    automaticCommonLinkResolution: false,
    knownGap:
      "data/staging/openiti-parallel-candidates.json.gz uses the openiti: id namespace from the bulk imported five-collection corpus, which today has no isnad chain data and no overlapping ids with data/corpus.json's uh:witness: namespace. The staged-candidate join path exists and is exercised by tests, but currently resolves to zero pairs against real data until the two datasets are unified under one id space (tracked in docs/NEXT.md)."
  }
};

const json = `${JSON.stringify(result, null, 2)}\n`;
await mkdir(new URL("data/staging/", root), { recursive: true });
await writeFile(new URL("data/staging/common-link-candidates.json", root), json);
await writeFile(
  new URL("data/staging/common-link-candidates.manifest.json", root),
  `${JSON.stringify(
    {
      format: result.format,
      sourceCorpusSha256: result.sourceCorpusSha256,
      sourceStagedParallelCandidatesSha256: result.sourceStagedParallelCandidatesSha256,
      matnSimilarPairCount: result.matnSimilarPairCount,
      matnSimilarClusterCount: result.matnSimilarClusterCount,
      candidateCount: candidates.length,
      contentSha256: createHash("sha256").update(json).digest("hex"),
      contentBytes: json.length,
      method: result.method
    },
    null,
    2
  )}\n`
);
console.log(
  `Found ${allPairs.length} matn-similar pair(s) forming ${clusters.length} cluster(s), and computed ${candidates.length} common-link-candidate evidence object(s).`
);
