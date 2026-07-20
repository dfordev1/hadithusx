// Exports the staged whole-corpus OpenITI reports as a single XML file that
// marks, per hadith report:
//   - the isnad chain's narratorMentions (already machine-suggested spans
//     from scripts/lib/propose-structure.mjs), each as a <narrator> element
//   - the matn text tokenized word-by-word, each token as a <w> element
//     carrying its 1-based index and exact character offsets into the
//     report's normalizedText, for downstream close-reading / concordance
//     study.
//
// Everything this script emits is explicitly reviewState="machine-suggested"
// (or "imported" for the raw report-level fields) — nothing here asserts a
// narrator identity, an authenticated matn boundary, or a corrected reading.
// This is a research/study export, not a critical edition.
//
// Word tokenization is intentionally simple and honestly scoped: it splits
// on Unicode whitespace only, so Arabic punctuation attached to a word
// (commas, colons, quotation marks) stays attached to the token rather than
// being split off as its own "word" — a deliberate choice recorded below and
// verified by the self-check this script runs on its own output before
// writing the file.

import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

const xmlEscape = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

// Tokenize a text span into words, returning each token's exact start/end
// offset *within that span's own local coordinate system* (0-based, code
// point aware via spread iteration so combining marks / astral characters
// are not split mid-character). Whitespace runs are the only separators;
// punctuation attached to a word is preserved as part of the token.
function tokenizeWords(text) {
  const tokens = [];
  const chars = [...text];
  let index = 0;
  while (index < chars.length) {
    while (index < chars.length && /\s/u.test(chars[index])) index++;
    if (index >= chars.length) break;
    const start = index;
    while (index < chars.length && !/\s/u.test(chars[index])) index++;
    const end = index;
    tokens.push({ start, end, text: chars.slice(start, end).join("") });
  }
  return tokens;
}

function narratorMentionsXml(narratorMentions) {
  if (!narratorMentions.length) return "      <narrators/>\n";
  const items = narratorMentions.map((mention) => {
    const identity = mention.identity
      ? ` identity="${xmlEscape(mention.identity)}"`
      : "";
    return `        <narrator position="${mention.position}" branch="${mention.branch}"` +
      ` transmissionTerm="${xmlEscape(mention.transmissionTerm)}"` +
      ` surface="${xmlEscape(mention.surface)}"` +
      ` sourceStart="${mention.sourceSpan.start}" sourceEnd="${mention.sourceSpan.end}"` +
      `${identity} reviewState="${mention.reviewState}">${xmlEscape(mention.sourceSpan.text)}</narrator>`;
  });
  return `      <narrators>\n${items.join("\n")}\n      </narrators>\n`;
}

function matnWordsXml(matnSpan) {
  if (!matnSpan) return "      <matn present=\"false\"/>\n";
  const tokens = tokenizeWords(matnSpan.text);
  const words = tokens.map((token, index) =>
    `        <w i="${index + 1}" start="${token.start}" end="${token.end}">${xmlEscape(token.text)}</w>`
  );
  return `      <matn present="true" wordCount="${tokens.length}" reviewState="machine-suggested">\n` +
    `        <text>${xmlEscape(matnSpan.text)}</text>\n` +
    `        <words>\n${words.join("\n")}\n        </words>\n` +
    `      </matn>\n`;
}

// Self-check: verify that re-concatenating the emitted <w> tokens by their
// own start/end offsets reproduces exactly the runs of non-whitespace
// characters in matnSpan.text with only whitespace removed between them —
// i.e. no character was dropped, duplicated, or reordered by tokenization.
// Any mismatch aborts the export rather than silently shipping bad offsets.
function verifyTokenization(matnSpan, report) {
  if (!matnSpan) return;
  const tokens = tokenizeWords(matnSpan.text);
  const chars = [...matnSpan.text];
  for (const token of tokens) {
    const sliced = chars.slice(token.start, token.end).join("");
    if (sliced !== token.text) {
      throw new Error(`${report.id}: token offset mismatch ("${sliced}" !== "${token.text}")`);
    }
  }
  const reconstructed = tokens.map((token) => token.text).join("");
  const collapsedOriginal = matnSpan.text.replace(/\s+/gu, "");
  if (reconstructed !== collapsedOriginal) {
    throw new Error(`${report.id}: tokenization lost or altered characters`);
  }
  // No two tokens may overlap, and tokens must be in strictly increasing order.
  for (let index = 1; index < tokens.length; index++) {
    if (tokens[index].start < tokens[index - 1].end) {
      throw new Error(`${report.id}: overlapping word tokens at index ${index}`);
    }
  }
}

function verifyNarratorSpans(structure, report) {
  const chars = [...report.normalizedText];
  for (const mention of structure.narratorMentions) {
    const sliced = chars.slice(mention.sourceSpan.start, mention.sourceSpan.end).join("");
    if (sliced !== mention.sourceSpan.text) {
      throw new Error(`${report.id}: narratorMention sourceSpan offset mismatch`);
    }
  }
  if (structure.matnSpan) {
    const sliced = chars.slice(structure.matnSpan.start, structure.matnSpan.end).join("");
    if (sliced !== structure.matnSpan.text) {
      throw new Error(`${report.id}: matnSpan offset mismatch against normalizedText`);
    }
  }
}

async function loadCorpus() {
  const gz = await readFile(new URL("data/staging/openiti-five-collections.json.gz", root));
  const { gunzipSync } = await import("node:zlib");
  return JSON.parse(gunzipSync(gz).toString("utf8"));
}

const corpus = await loadCorpus();
let checkedReports = 0;
let checkedWords = 0;
let checkedNarrators = 0;

const reportXml = corpus.records.map((report) => {
  verifyNarratorSpans(report.structure, report);
  verifyTokenization(report.structure.matnSpan, report);
  checkedReports++;
  checkedWords += report.structure.matnSpan ? tokenizeWords(report.structure.matnSpan.text).length : 0;
  checkedNarrators += report.structure.narratorMentions.length;

  return `    <hadith id="${xmlEscape(report.id)}" collection="${xmlEscape(report.sourceKey)}"` +
    ` collectionLabel="${xmlEscape(report.collectionLabel)}" reportNumber="${report.reportNumber}"` +
    ` occurrence="${report.occurrence}" reviewState="imported">\n` +
    `      <book>${xmlEscape(report.book)}</book>\n` +
    `      <chapter>${xmlEscape(report.chapter)}</chapter>\n` +
    `      <isnad boundaryMethod="${xmlEscape(report.structure.boundaryMethod)}"` +
    ` branchCount="${report.structure.branchCount}"` +
    ` chainStart="${report.structure.chainSpan.start}" chainEnd="${report.structure.chainSpan.end}">\n` +
    `        <chainText>${xmlEscape(report.structure.chainSpan.text)}</chainText>\n` +
    narratorMentionsXml(report.structure.narratorMentions) +
    `      </isnad>\n` +
    matnWordsXml(report.structure.matnSpan) +
    `    </hadith>`;
}).join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<!--\n` +
  `  Unified Hadith Workbench — word/narrator-tagged study export.\n` +
  `  Generated by scripts/export-word-tagged-xml.mjs from data/staging/openiti-five-collections.json.gz.\n` +
  `\n` +
  `  IMPORTANT SCOPE, READ BEFORE USE:\n` +
  `  - Every narrator surface and matn boundary here is reviewState="machine-suggested"\n` +
  `    or "imported" (see docs/DONE.md, Release 2.0.1) — NOT verified readings.\n` +
  `  - Known unfixed issues in this data (see docs/NEXT.md Phase 3) still apply here\n` +
  `    unchanged: leftover @MATN@ markers / stray footnote digits in some Tirmidhi and\n` +
  `    Nasa'i reports, occasional isnad chains capturing a matn sentence as a narrator\n` +
  `    "name", multi-narrator chains joined by \"و\" collapsed into one mention, and some\n` +
  `    Bukhari \"book\" fields holding a raw page marker instead of a title. This export\n` +
  `    does not fix any of these — it surfaces the corpus exactly as currently staged.\n` +
  `  - Word tokenization splits on whitespace only; attached punctuation (commas,\n` +
  `    colons, closing quotation marks) stays glued to its word as one token, by design.\n` +
  `  - word start/end and narrator sourceStart/sourceEnd are 0-based code-point offsets\n` +
  `    into each <matn>/<isnad> element's own text (matn offsets are LOCAL to matnSpan.text,\n` +
  `    not into the whole report), verified during export (see below) to slice back to\n` +
  `    the exact token text with no loss, duplication, or overlap.\n` +
  `-->\n` +
  `<hadithExport format="unified-hadith-word-tagged-export-0.1" generatedFrom="${xmlEscape(corpus.generatedBy)}"` +
  ` license="${xmlEscape(corpus.license)}" licenseUrl="${xmlEscape(corpus.licenseUrl)}"` +
  ` reportCount="${corpus.records.length}" wordCount="${checkedWords}" narratorMentionCount="${checkedNarrators}">\n` +
  `  <hadiths>\n${reportXml}\n  </hadiths>\n` +
  `</hadithExport>\n`;

await mkdir(new URL("data/staging/", root), { recursive: true });
const outPath = new URL("data/staging/word-tagged-export.xml.gz", root);
const compressed = gzipSync(Buffer.from(xml), { level: 9, mtime: 0 });
await writeFile(outPath, compressed);
const manifest = {
  format: "unified-hadith-word-tagged-export-0.1",
  reportCount: corpus.records.length,
  wordCount: checkedWords,
  narratorMentionCount: checkedNarrators,
  uncompressedSha256: createHash("sha256").update(xml).digest("hex"),
  compressedSha256: createHash("sha256").update(compressed).digest("hex"),
  compressedBytes: compressed.length,
  uncompressedBytes: xml.length,
  selfCheck: "every narratorMention sourceSpan and matnSpan verified against normalizedText; every word token verified to slice back exactly with no loss/duplication/overlap"
};
await writeFile(
  new URL("data/staging/word-tagged-export.manifest.json", root),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(`Exported ${corpus.records.length} reports (${checkedNarrators} narrator mentions, ${checkedWords} matn words) — self-check passed.`);
console.log(`Written: data/staging/word-tagged-export.xml.gz (${compressed.length} bytes)`);
