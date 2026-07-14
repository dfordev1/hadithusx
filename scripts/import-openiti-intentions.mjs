import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const lock = JSON.parse(await readFile(new URL("sources/source-lock.json", root), "utf8"));
const source = lock.openiti0275AH;
const checkout = new URL("sources/openiti-0275AH/", root);
const fileUrl = new URL(source.path.replaceAll("\\", "/"), checkout);

let actualCommit;
try {
  actualCommit = execFileSync("git", ["-C", checkout.pathname.replace(/^\/(.:)/, "$1"), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  console.error("OpenITI checkout is missing. Clone the locked repository into sources/openiti-0275AH first.");
  process.exit(1);
}
if (actualCommit !== source.commit) {
  console.error(`OpenITI commit mismatch: expected ${source.commit}, found ${actualCommit}`);
  process.exit(1);
}

const text = await readFile(fileUrl, "utf8");
const sha256 = createHash("sha256").update(text).digest("hex");
if (sha256 !== source.sourceSha256) {
  console.error(`OpenITI source checksum mismatch: expected ${source.sourceSha256}, found ${sha256}`);
  process.exit(1);
}
const heading = /^### \| (\d+) -\s*$/gm;
const matches = [...text.matchAll(heading)];
const reports = [];

function cleanOpenITI(block) {
  return block
    .split(/\r?\n/)
    .filter((line) => !/^###/.test(line) && !/^# PageV/.test(line))
    .map((line) => line.replace(/^~~/, "").replace(/^# /, "").replace(/\bms\d+\b/g, "").replace(/PageV\d+P\d+/g, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .normalize("NFC")
    .trim();
}

function extractMentionCandidates(chain) {
  const termPattern = /(?<![\p{L}\p{M}])(حدثنا|أخبرنا|أخبرني|أنه سمع|أنها سمعت|سمعت|عن|أن|يقول|قال)(?![\p{L}\p{M}])/gu;
  const terms = [...chain.matchAll(termPattern)];
  const candidates = [];
  for (let index = 0; index < terms.length; index++) {
    const term = terms[index][0];
    const start = terms[index].index + term.length;
    const end = terms[index + 1]?.index ?? chain.length;
    let surface = chain.slice(start, end)
      .replace(/^[\s:،]+|[\s:،]+$/g, "")
      .replace(/\s+رضي الله عنه(?:،?\s*(?:على المنبر|يخطب))?$/u, "")
      .replace(/\s+/g, " ");
    if (!surface || /^(إنما|الأعمال|لكل)/u.test(surface)) continue;
    candidates.push({
      position: candidates.length + 1,
      transmissionTerm: term,
      surface,
      identity: null,
      reviewState: "machine-suggested"
    });
  }
  return candidates;
}

for (let index = 0; index < matches.length; index++) {
  const start = matches[index].index + matches[index][0].length;
  const end = matches[index + 1]?.index ?? text.length;
  const numberedSection = text.slice(start, end);
  const reportLines = [];
  for (const line of numberedSection.split(/\r?\n/)) {
    if (/^###/.test(line) && !/^### \| \[ص:/.test(line)) break;
    reportLines.push(line);
  }
  const raw = reportLines.join("\n").trim();
  const normalizedReading = cleanOpenITI(raw);
  if (!/الأعمال\s+بالني(?:ة|ات)/u.test(normalizedReading)) continue;
  const number = Number(matches[index][1]);
  const quoteStart = normalizedReading.indexOf("«");
  const quoteEnd = normalizedReading.lastIndexOf("»");
  const chainCandidate = quoteStart === -1 ? normalizedReading : normalizedReading.slice(0, quoteStart).trim();
  const matnCandidate = quoteStart === -1 ? "" : normalizedReading.slice(quoteStart + 1, quoteEnd > quoteStart ? quoteEnd : undefined).trim();
  reports.push({
    stagingId: `openiti:0256Bukhari.Sahih.Shamela0001681-ara1:${number}`,
    sourceReportNumber: number,
    rawOpenITI: raw,
    normalizedReading,
    segmentation: {
      chainCandidate,
      matnCandidate,
      narratorMentionCandidates: extractMentionCandidates(chainCandidate),
      method: "Arabic quotation-boundary heuristic",
      reviewState: "machine-suggested"
    },
    reviewState: "imported"
  });
}

const result = {
  format: "unified-hadith-openiti-staging-0.1",
  source: { ...source, sourceSha256: sha256 },
  query: { description: "Numbered reports whose cleaned report text contains الأعمال بالنية or الأعمال بالنيات", expression: "الأعمال\\s+بالني(?:ة|ات)" },
  reports
};
await mkdir(new URL("data/staging/", root), { recursive: true });
await writeFile(new URL("data/staging/openiti-bukhari-intentions.json", root), `${JSON.stringify(result, null, 2)}\n`);
console.log(`Staged ${reports.length} citable OpenITI witness occurrence(s): ${reports.map((report) => report.sourceReportNumber).join(", ")}`);
