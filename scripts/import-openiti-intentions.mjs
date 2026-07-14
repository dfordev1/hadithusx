import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const lock = JSON.parse(await readFile(new URL("sources/source-lock.json", root), "utf8"));
const sources = Object.entries(lock).map(([sourceKey, source]) => ({ sourceKey, ...source }));

const checkouts = new Map();
for (const source of sources) {
  if (!source.checkout) throw new Error(`${source.sourceKey} has no checkout in source-lock.json`);
  const checkout = new URL(`sources/${source.checkout}/`, root);
  if (!checkouts.has(source.checkout)) {
    let actualCommit;
    try {
      actualCommit = execFileSync("git", ["-C", checkout.pathname.replace(/^\/(.:)/, "$1"), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    } catch {
      console.error(`OpenITI checkout is missing: sources/${source.checkout}`);
      process.exit(1);
    }
    checkouts.set(source.checkout, { checkout, actualCommit });
  }
  const { actualCommit } = checkouts.get(source.checkout);
  if (actualCommit !== source.commit) {
    console.error(`${source.sourceKey} commit mismatch: expected ${source.commit}, found ${actualCommit}`);
    process.exit(1);
  }
}

function cleanOpenITI(block) {
  return block.split(/\r?\n/)
    .filter((line) => !/^###/.test(line) && !/^# PageV/.test(line))
    .map((line) => line.replace(/^~~/, "").replace(/^# /, "").replace(/\bms\d+\b/g, "").replace(/PageV\d+P\d+/g, "").trim())
    .filter(Boolean).join(" ").replace(/\s+/g, " ").normalize("NFC").trim();
}

function extractMentionCandidates(chain, baseOffset = 0) {
  const termPattern = /(?<![\p{L}\p{M}])(حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا|أنه سمع|أنها سمعت|سمعت|عن|أن|يقول|قال)(?![\p{L}\p{M}])/gu;
  const terms = [...chain.matchAll(termPattern)];
  const candidates = [];
  for (let index = 0; index < terms.length; index++) {
    const term = terms[index][0];
    const start = terms[index].index + term.length;
    const end = terms[index + 1]?.index ?? chain.length;
    const surface = chain.slice(start, end).replace(/^[\s:،]+|[\s:،]+$/g, "").replace(/\s+رضي الله عنه(?:،?\s*(?:على المنبر|يخطب))?$/u, "").replace(/\s+/g, " ");
    if (!surface || /^(إنما|الأعمال|لكل)/u.test(surface)) continue;
    candidates.push({
      position: candidates.length + 1,
      transmissionTerm: term,
      transmissionTermSpan: { start: baseOffset + terms[index].index, end: baseOffset + terms[index].index + term.length, text: term },
      sourceSpan: { start: baseOffset + terms[index].index, end: baseOffset + end, text: chain.slice(terms[index].index, end) },
      surface,
      identity: null,
      reviewState: "machine-suggested"
    });
  }
  return candidates;
}

function extractIsnadStructure(chain) {
  const markerPattern = /(?<![\p{L}\p{M}])ح(?=\s+و?(?:حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا))/gu;
  const markers = [...chain.matchAll(markerPattern)];
  const boundaries = [0, ...markers.map((marker) => marker.index + marker[0].length), chain.length];
  const branches = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    let start = boundaries[index], end = boundaries[index + 1] - (markers[index]?.[0].length ?? 0);
    while (start < end && /[\s،]/u.test(chain[start])) start++;
    while (end > start && /\s/u.test(chain[end - 1])) end--;
    const text = chain.slice(start, end);
    if (!text) continue;
    branches.push({
      id: `branch-${branches.length + 1}`,
      position: branches.length + 1,
      sourceSpan: { start, end, text },
      introducedBy: branches.length ? "ح" : null,
      narratorMentionCandidates: extractMentionCandidates(text, start),
      reviewState: "machine-suggested"
    });
  }
  return {
    kind: branches.length > 1 ? "explicit-branches" : "single-route",
    branchMarkers: markers.map((marker, index) => ({ marker: marker[0], start: marker.index, end: marker.index + marker[0].length, beforeBranch: index + 1, afterBranch: index + 2 })),
    branches,
    reviewState: "machine-suggested"
  };
}

function parseReportNumber(value) {
  const western = value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  return Number(western);
}

async function extractSource(source) {
  const { checkout } = checkouts.get(source.checkout);
  const fileUrl = new URL(source.path, checkout);
  const text = await readFile(fileUrl, "utf8");
  const sha256 = createHash("sha256").update(text).digest("hex");
  if (sha256 !== source.sourceSha256) throw new Error(`${source.sourceKey} checksum mismatch: expected ${source.sourceSha256}, found ${sha256}`);
  const matches = [...text.matchAll(/^### \|+ ([0-9٠-٩]+)(?:\s+ms\d+)? -\s*$/gm)];
  const reports = [];
  for (let index = 0; index < matches.length; index++) {
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? text.length;
    const reportLines = [];
    for (const line of text.slice(start, end).split(/\r?\n/)) {
      if (/^###/.test(line) && !/^### \| \[ص:/.test(line)) break;
      reportLines.push(line);
    }
    const rawOpenITI = reportLines.join("\n").trim();
    const normalizedReading = cleanOpenITI(rawOpenITI);
    if (!/الأعمال\s+بالني(?:ة|ات)/u.test(normalizedReading)) continue;
    const quoteStart = normalizedReading.search(/[«"]/u);
    const quoteEnd = Math.max(normalizedReading.lastIndexOf("»"), normalizedReading.lastIndexOf('"'));
    const chainCandidate = quoteStart === -1 ? normalizedReading : normalizedReading.slice(0, quoteStart).trim();
    const matnCandidate = quoteStart === -1 ? normalizedReading.slice(normalizedReading.indexOf("إنما الأعمال")) : normalizedReading.slice(quoteStart + 1, quoteEnd > quoteStart ? quoteEnd : undefined).trim();
    const sourceReportNumber = parseReportNumber(matches[index][1]);
    const isnadStructure = extractIsnadStructure(chainCandidate);
    const narratorMentionCandidates = isnadStructure.branches.flatMap((branch) => branch.narratorMentionCandidates)
      .map((mention, index) => ({ ...mention, position: index + 1 }));
    reports.push({
      stagingId: `openiti:${source.version}:${sourceReportNumber}`,
      sourceKey: source.sourceKey,
      collectionLabel: source.collectionLabel,
      work: source.work,
      sourceReportNumber,
      rawOpenITI,
      normalizedReading,
      segmentation: { chainCandidate, matnCandidate, isnadStructure, narratorMentionCandidates, method: "Arabic quotation-boundary and explicit chain-switch heuristic", reviewState: "machine-suggested" },
      reviewState: "imported"
    });
  }
  return reports;
}

const reports = (await Promise.all(sources.map(extractSource))).flat();
const result = {
  format: "unified-hadith-openiti-staging-0.2",
  source: sources[0],
  sources,
  query: { description: "Numbered reports whose cleaned report text contains الأعمال بالنية or الأعمال بالنيات", expression: "الأعمال\\s+بالني(?:ة|ات)" },
  reports
};
await mkdir(new URL("data/staging/", root), { recursive: true });
await writeFile(new URL("data/staging/openiti-bukhari-intentions.json", root), `${JSON.stringify(result, null, 2)}\n`);
console.log(`Staged ${reports.length} OpenITI witness occurrence(s) across ${new Set(reports.map((report) => report.collectionLabel)).size} collections.`);
