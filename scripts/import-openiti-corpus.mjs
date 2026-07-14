import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const lock = JSON.parse(await readFile(new URL("sources/source-lock.json", root), "utf8"));
const sources = Object.entries(lock).map(([sourceKey, source]) => ({ sourceKey, ...source }));
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const parseNumber = (value) => Number(value.replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit))));
const clean = (value) => value.split(/\r?\n/)
  .filter((line) => !/^###/.test(line) && !/^# PageV/.test(line))
  .map((line) => line.replace(/^~~/, "").replace(/^# /, "").replace(/\bms\d+\b/g, "").replace(/PageV\d+P\d+/g, "").trim())
  .filter(Boolean).join(" ").replace(/\s+/g, " ").normalize("NFC").trim();

const records = [];
const sourceSummary = [];
for (const source of sources) {
  const checkout = new URL(`sources/${source.checkout}/`, root);
  const checkoutPath = checkout.pathname.replace(/^\/(.:)/, "$1");
  let actualCommit;
  try { actualCommit = execFileSync("git", ["-C", checkoutPath, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { throw new Error(`Missing checkout sources/${source.checkout}`); }
  if (actualCommit !== source.commit) throw new Error(`${source.sourceKey} commit mismatch: expected ${source.commit}, found ${actualCommit}`);
  const text = await readFile(new URL(source.path, checkout), "utf8");
  const sha256 = createHash("sha256").update(text).digest("hex");
  if (sha256 !== source.sourceSha256) throw new Error(`${source.sourceKey} checksum mismatch`);

  const headingPattern = /^### (\|{1,3})\s+(.+?)\s*$/gm;
  const headings = [...text.matchAll(headingPattern)];
  let book = "", chapter = "", count = 0;
  const reportOccurrences = new Map();
  for (let index = 0; index < headings.length; index++) {
    const pipes = headings[index][1].length;
    const label = headings[index][2].trim();
    const reportMatch = label.match(/^([0-9٠-٩]+)(?:\s+ms\d+)?\s+-\s*$/u);
    if (!reportMatch) {
      if (pipes === 1) { book = label; chapter = ""; }
      else if (pipes === 2) chapter = label;
      continue;
    }
    const start = headings[index].index + headings[index][0].length;
    const end = headings[index + 1]?.index ?? text.length;
    const rawOpenITI = text.slice(start, end).trim();
    const normalizedText = clean(rawOpenITI);
    if (!normalizedText) continue;
    const reportNumber = parseNumber(reportMatch[1]);
    const occurrence = (reportOccurrences.get(reportNumber) ?? 0) + 1;
    reportOccurrences.set(reportNumber, occurrence);
    records.push({
      id: `openiti:${source.version}:${reportNumber}${occurrence > 1 ? `:occurrence-${occurrence}` : ""}`,
      sourceKey: source.sourceKey,
      collectionLabel: source.collectionLabel,
      work: source.work,
      version: source.version,
      reportNumber,
      occurrence,
      book,
      chapter,
      rawOpenITI,
      normalizedText,
      reviewState: "imported"
    });
    count++;
  }
  sourceSummary.push({ sourceKey: source.sourceKey, collectionLabel: source.collectionLabel, repository: source.repository, commit: source.commit, sourceSha256: source.sourceSha256, license: source.license, licenseUrl: source.licenseUrl, reports: count });
}

const corpus = {
  format: "unified-hadith-corpus-index-0.1",
  generatedBy: "scripts/import-openiti-corpus.mjs",
  license: "CC BY-NC-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  attribution: "OpenITI corpus; source versions and commits listed in sources",
  sources: sourceSummary,
  reportCount: records.length,
  records
};
const json = `${JSON.stringify(corpus)}\n`;
const compressed = gzipSync(Buffer.from(json), { level: 9, mtime: 0 });
await mkdir(new URL("data/staging/", root), { recursive: true });
await writeFile(new URL("data/staging/openiti-five-collections.json.gz", root), compressed);
await writeFile(new URL("data/staging/openiti-five-collections.manifest.json", root), `${JSON.stringify({ format: corpus.format, reportCount: records.length, uncompressedSha256: createHash("sha256").update(json).digest("hex"), compressedSha256: createHash("sha256").update(compressed).digest("hex"), compressedBytes: compressed.length, sources: sourceSummary }, null, 2)}\n`);
console.log(`Indexed ${records.length} reports across ${sources.length} collections (${compressed.length} compressed bytes).`);
