// Pure, dependency-free functions for isnad-cum-matn cluster analysis
// (docs/NEXT.md / spec/ISNAD_CLUSTER_ANALYSIS.md).
//
// Design constraints these functions must uphold, per spec/ISNAD_CLUSTER_ANALYSIS.md
// and docs/GOAL.md:
//   - A computed "common-link candidate" is NEVER an authentication ruling and
//     is never asserted as fact. Every candidate is `reviewState:
//     "machine-suggested"` with `acceptedAsCommonLink: null`.
//   - Every candidate cites the exact witness/isnad/mention ids it was
//     computed from, so a human reviewer can verify it against the source
//     chains without trusting the computation blindly.
//   - Computation is deterministic: same input always produces the same
//     output in the same order.

const normalizeMatnText = (value) =>
  value
    .normalize("NFC")
    .replace(/[ًٌٍَُِّْـ]/gu, "")
    .replace(/[إأآٱ]/gu, "ا")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokensOf = (text) => normalizeMatnText(text).split(" ").filter(Boolean);

const shingleSet = (tokens, size = 4) => {
  if (tokens.length < size) return new Set(tokens.length ? [tokens.join(" ")] : []);
  return new Set(Array.from({ length: tokens.length - size + 1 }, (_, index) => tokens.slice(index, index + size).join(" ")));
};

/**
 * Find matn-similar pairs of witnesses within a single corpus document
 * (data/corpus.json shape: { witnesses: [{ id, matn: { diplomatic } }] }),
 * using the same shared-four-word-sequence + token-overlap method as
 * scripts/discover-parallels.mjs, so results are explainable the same way.
 *
 * This is the "in-corpus" half of matn-similarity: it does NOT require the
 * separately-staged openiti-parallel-candidates.json.gz file, which indexes
 * a different (openiti:) id namespace than data/corpus.json's (uh:witness:)
 * namespace and today has no overlapping ids with it (see
 * spec/ISNAD_CLUSTER_ANALYSIS.md "known gap").
 *
 * Returns a deterministic, sorted array of { left, right, measures, confidence }.
 */
export function findInCorpusMatnSimilarPairs(witnesses, options = {}) {
  const minimumTokenJaccard = options.minimumTokenJaccard ?? 0.16;
  const minimumShorterTextContainment = options.minimumShorterTextContainment ?? 0.42;
  // Real classical hadith matns are often only a few words long, so unlike
  // scripts/discover-parallels.mjs (which operates on thousands of long
  // reports and can require multiple shared four-word shingles), the
  // in-corpus method does not require any shared shingle by default and
  // relies on the token-overlap thresholds below instead. Shingles that do
  // exist are still recorded for citation/explainability.
  const minimumSharedSequences = options.minimumSharedSequences ?? 0;

  const usable = witnesses.filter((witness) => witness.matn?.diplomatic);
  const tokenSets = usable.map((witness) => new Set(tokensOf(witness.matn.diplomatic)));
  const shingles = usable.map((witness) => shingleSet(tokensOf(witness.matn.diplomatic)));

  const pairs = [];
  for (let a = 0; a < usable.length; a++) {
    for (let b = a + 1; b < usable.length; b++) {
      const shared = [...shingles[a]].filter((shingle) => shingles[b].has(shingle)).sort();
      if (shared.length < minimumSharedSequences) continue;
      const aTokens = tokenSets[a];
      const bTokens = tokenSets[b];
      let intersection = 0;
      for (const token of aTokens) if (bTokens.has(token)) intersection++;
      const union = aTokens.size + bTokens.size - intersection;
      const jaccard = union ? intersection / union : 0;
      const containment = Math.min(aTokens.size, bTokens.size) ? intersection / Math.min(aTokens.size, bTokens.size) : 0;
      if (jaccard < minimumTokenJaccard && containment < minimumShorterTextContainment) continue;
      pairs.push({
        left: usable[a].id,
        right: usable[b].id,
        sharedFourWordSequences: shared,
        measures: {
          tokenJaccard: Number(jaccard.toFixed(4)),
          shorterTextContainment: Number(containment.toFixed(4)),
          sharedSequenceCount: shared.length
        },
        method: "shared normalized four-word sequences with token-overlap thresholds 0.1 (in-corpus)",
        confidence: jaccard >= 0.5 || containment >= 0.75 ? "probable" : jaccard >= 0.3 || containment >= 0.58 ? "possible" : "uncertain"
      });
    }
  }
  pairs.sort((x, y) => y.measures.shorterTextContainment - x.measures.shorterTextContainment || x.left.localeCompare(y.left) || x.right.localeCompare(y.right));
  return pairs;
}

/**
 * Filter staged parallel-discovery candidates (scripts/discover-parallels.mjs
 * output, data/staging/openiti-parallel-candidates.json.gz shape) down to
 * "accepted-similarity or high-confidence" pairs, and resolve their
 * left/right ids against a set of known corpus witness ids. Pairs whose
 * endpoints do not resolve to a known witness id are dropped (there is
 * nothing to join an isnad chain to). Today this is expected to return an
 * empty array against data/corpus.json because the two id namespaces do not
 * yet overlap; see spec/ISNAD_CLUSTER_ANALYSIS.md.
 */
export function resolveStagedParallelPairs(stagedCandidates, knownWitnessIds) {
  const known = knownWitnessIds instanceof Set ? knownWitnessIds : new Set(knownWitnessIds);
  return stagedCandidates
    .filter((candidate) => candidate.acceptedAlignment !== null || candidate.confidence === "probable")
    .filter((candidate) => known.has(candidate.left) && known.has(candidate.right))
    .map((candidate) => ({
      left: candidate.left,
      right: candidate.right,
      sharedFourWordSequences: candidate.sharedFourWordSequences ?? [],
      measures: candidate.measures ?? {},
      method: `${candidate.method ?? "staged parallel candidate"} (staged)`,
      confidence: candidate.confidence
    }))
    .sort((a, b) => a.left.localeCompare(b.left) || a.right.localeCompare(b.right));
}

/** Deterministic union-find over witness ids, grouping ids connected by any similarity pair. */
export function clusterWitnessIds(pairs) {
  const parent = new Map();
  const find = (id) => {
    if (!parent.has(id)) parent.set(id, id);
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root);
    let current = id;
    while (parent.get(current) !== root) {
      const next = parent.get(current);
      parent.set(current, root);
      current = next;
    }
    return root;
  };
  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  };
  for (const pair of pairs) union(pair.left, pair.right);

  const groups = new Map();
  for (const id of parent.keys()) {
    const root = find(id);
    const group = groups.get(root) ?? [];
    group.push(id);
    groups.set(root, group);
  }
  return [...groups.values()]
    .filter((group) => group.length >= 2)
    .map((group) => group.slice().sort())
    .sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * Build a union isnad chain graph for one matn-similar cluster of witnesses
 * and compute per-narrator transmission fan-out as machine-suggested
 * commonLinkCandidate evidence objects. Never marks anything as an
 * authenticated common link.
 *
 * `witnessIndex` maps witness id -> the witness object from data/corpus.json
 * (must have `.isnads`, each with `.id`, `.reviewState`, `.route[]` of
 * `{ position, surface, transmissionTerm, identityAssertions: [{ person }] }`).
 */
export function buildCommonLinkCandidates(clusterWitnessIdList, witnessIndex, options = {}) {
  const minimumFanOut = options.minimumFanOut ?? 2;
  const minimumChainCount = options.minimumChainCount ?? 2;

  // node key -> { narrator (person id or null), surfaceForms: Set, chains: Set(isnadId), downstream: Map(nodeKey -> Set(isnadId)) }
  const nodes = new Map();
  const chainCitations = [];
  const nodeKeyOf = (mention) => {
    const person = mention.identityAssertions?.[0]?.person ?? null;
    return person ? `person:${person}` : `surface:${mention.surface}`;
  };
  const touch = (mention) => {
    const key = nodeKeyOf(mention);
    if (!nodes.has(key)) {
      nodes.set(key, {
        narrator: mention.identityAssertions?.[0]?.person ?? null,
        surfaceForms: new Set(),
        chains: new Set(),
        downstream: new Map()
      });
    }
    const node = nodes.get(key);
    node.surfaceForms.add(mention.surface);
    return node;
  };

  for (const witnessId of clusterWitnessIdList) {
    const witness = witnessIndex.get(witnessId);
    if (!witness) continue;
    for (const isnad of witness.isnads ?? []) {
      chainCitations.push({ witness: witnessId, isnad: isnad.id, isnadReviewState: isnad.reviewState });
      // Route position 1 is the narrator closest to the compiler (most
      // recent); increasing position moves back toward the original
      // authority. Transmission therefore flows from the HIGHER-position
      // (older) narrator to the LOWER-position (younger) narrator: the
      // person at route[index + 1] informed the person at route[index].
      // A common-link candidate is an older narrator whose mentions
      // "transmit to" (inform) multiple distinct younger narrators across
      // multiple chains -- i.e. fan-out measured in that informer->informed
      // direction.
      const route = isnad.route ?? [];
      for (let index = 0; index < route.length; index++) {
        const currentNode = touch(route[index]);
        currentNode.chains.add(isnad.id);
        const informer = route[index + 1];
        if (!informer) continue;
        const informerNode = touch(informer);
        informerNode.chains.add(isnad.id);
        const informedKey = nodeKeyOf(route[index]);
        const existing = informerNode.downstream.get(informedKey) ?? new Set();
        existing.add(isnad.id);
        informerNode.downstream.set(informedKey, existing);
      }
    }
  }

  const clusterId = `cluster:${clusterWitnessIdList.join("+")}`;
  const candidates = [];
  for (const [key, node] of [...nodes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const fanOut = node.downstream.size;
    const chainCount = node.chains.size;
    if (fanOut < minimumFanOut || chainCount < minimumChainCount) continue;
    const downstreamNarrators = [...node.downstream.entries()]
      .map(([downstreamKey, chains]) => ({ narrator: downstreamKey, chains: [...chains].sort() }))
      .sort((a, b) => a.narrator.localeCompare(b.narrator));
    const confidence = fanOut >= 3 && chainCount >= 3 ? "possible" : "uncertain";
    candidates.push({
      id: "", // assigned after final sort, below
      cluster: clusterId,
      clusterWitnesses: clusterWitnessIdList,
      narrator: node.narrator,
      identityResolved: node.narrator !== null,
      narratorSurfaceForms: [...node.surfaceForms].sort(),
      transmissionFanOut: fanOut,
      chainCount,
      downstreamNarrators,
      citations: chainCitations.slice().sort((a, b) => a.isnad.localeCompare(b.isnad)),
      method: "union isnad chain graph over matn-similar report cluster; narrator transmission fan-out 0.1",
      agent: "uh:agent:isnad-cluster-analyzer",
      confidence,
      reviewState: "machine-suggested",
      acceptedAsCommonLink: null,
      note:
        "A narrator whose transmission point diverges to multiple downstream narrators across multiple isnad chains of a matn-similar report cluster is a computational signal consistent with, but not proof of, a common-link narrator in the classical isnad-cum-matn sense. This is not an authentication ruling and requires scholarly review."
    });
  }
  candidates.sort((a, b) => b.transmissionFanOut - a.transmissionFanOut || b.chainCount - a.chainCount || (a.narrator ?? "").localeCompare(b.narrator ?? "") || a.narratorSurfaceForms[0].localeCompare(b.narratorSurfaceForms[0]));
  candidates.forEach((candidate, index) => {
    candidate.id = `uh:common-link-candidate:${clusterWitnessIdList[0]}:${index + 1}`;
  });
  return candidates;
}
