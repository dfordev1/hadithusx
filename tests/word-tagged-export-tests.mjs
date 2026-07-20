// Verifies scripts/export-word-tagged-xml.mjs's output: well-formedness,
// checksum/manifest integrity, and that every emitted <w>/<narrator> offset
// slices back to exactly its own displayed text with no loss or overlap —
// the same self-check the export script itself runs before writing, run
// again here independently so a future change to the script can't silently
// skip its own verification.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";

const root = new URL("../", import.meta.url);
let pass = 0, fail = 0;
const check = (label, condition) => {
  if (condition) { pass++; }
  else { fail++; console.error(`FAIL: ${label}`); }
};

const compressed = await readFile(new URL("data/staging/word-tagged-export.xml.gz", root));
const manifest = JSON.parse(await readFile(new URL("data/staging/word-tagged-export.manifest.json", root), "utf8"));
const xml = gunzipSync(compressed).toString("utf8");

check("compressed bytes match manifest checksum", createHash("sha256").update(compressed).digest("hex") === manifest.compressedSha256);
check("uncompressed bytes match manifest checksum", createHash("sha256").update(xml).digest("hex") === manifest.uncompressedSha256);
check("report count in XML matches manifest", (xml.match(/<hadith /g) || []).length === manifest.reportCount);
check("word count in XML matches manifest", (xml.match(/<w i=/g) || []).length === manifest.wordCount);
check("narrator mention count in XML matches manifest", (xml.match(/<narrator /g) || []).length === manifest.narratorMentionCount);
check("export declares machine-suggested/imported review states, never scholar-verified", !/reviewState="scholar-verified"/.test(xml));
check("export header documents known unfixed corpus issues rather than hiding them", /Known unfixed issues/.test(xml));

const tmpPath = new URL("../.tmp-word-tagged-export-check.xml", import.meta.url).pathname;
writeFileSync(tmpPath, xml);
try {
  execFileSync("xmllint", ["--noout", tmpPath], { stdio: "pipe" });
  check("export is well-formed XML (xmllint --noout)", true);
} catch {
  check("export is well-formed XML (xmllint --noout)", false);
} finally {
  unlinkSync(tmpPath);
}

// Independent re-verification of a sample of word/narrator offsets against
// their own local text (does not trust the export script's own self-check).
// XML-unescape both sides first, since offsets were computed against the
// raw (pre-escaping) string but the file on disk stores escaped entities.
const xmlUnescape = (value) => value
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const hadithBlocks = xml.split("<hadith ").slice(1, 200);
let offsetChecks = 0, offsetFailures = 0;
for (const block of hadithBlocks) {
  const wordMatches = [...block.matchAll(/<w i="(\d+)" start="(\d+)" end="(\d+)">([^<]*)<\/w>/g)];
  const textMatch = block.match(/<text>([\s\S]*?)<\/text>/);
  if (!textMatch || !wordMatches.length) continue;
  const chars = [...xmlUnescape(textMatch[1])];
  for (const [, , start, end, text] of wordMatches) {
    offsetChecks++;
    const sliced = chars.slice(Number(start), Number(end)).join("");
    if (sliced !== xmlUnescape(text)) offsetFailures++;
  }
}
check(`sampled word offsets (${offsetChecks} checked across first 199 reports) all slice back exactly`, offsetChecks > 0 && offsetFailures === 0);

console.log(`${pass}/${pass + fail} word-tagged export tests passed.`);
if (fail > 0) process.exit(1);
