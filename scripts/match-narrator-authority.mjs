import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { matchNarratorAuthorityCandidates, detectChronologyWarnings } from "./lib/narrator-authority.mjs";

const root = new URL("../", import.meta.url);
const authorityText = await readFile(new URL("data/narrator-authority.fixture.json", root), "utf8");
const authority = JSON.parse(authorityText);
const narratorBytes = await readFile(new URL("data/staging/openiti-narrator-mentions.json.gz", root));
const narrators = JSON.parse(gunzipSync(narratorBytes).toString("utf8"));

const candidates = matchNarratorAuthorityCandidates(authority.persons, narrators.clusters);
const chronologyWarnings = detectChronologyWarnings(authority.persons, authority.assertions);

const result = {
  format: "unified-hadith-narrator-authority-candidates-0.1",
  sourceAuthoritySha256: createHash("sha256").update(authorityText).digest("hex"),
  sourceNarratorIndexSha256: createHash("sha256").update(narratorBytes).digest("hex"),
  candidateCount: candidates.length,
  candidates,
  chronologyWarningCount: chronologyWarnings.length,
  chronologyWarnings,
  method: {
    matching: "deterministic normalized Arabic surface comparison 0.1",
    automaticIdentityResolution: false,
    chronologyChecks: "teacher/student assertions compared against birth/death years when both are recorded; broken links flagged when the related person id does not resolve",
    warningsAreNotRulings: true
  }
};
const json = `${JSON.stringify(result)}\n`;
const compressed = gzipSync(Buffer.from(json), { level: 9, mtime: 0 });
await mkdir(new URL("data/staging/", root), { recursive: true });
await writeFile(new URL("data/staging/openiti-narrator-authority-candidates.json.gz", root), compressed);
await writeFile(
  new URL("data/staging/openiti-narrator-authority-candidates.manifest.json", root),
  `${JSON.stringify(
    {
      format: result.format,
      sourceAuthoritySha256: result.sourceAuthoritySha256,
      sourceNarratorIndexSha256: result.sourceNarratorIndexSha256,
      candidateCount: candidates.length,
      chronologyWarningCount: chronologyWarnings.length,
      uncompressedSha256: createHash("sha256").update(json).digest("hex"),
      compressedSha256: createHash("sha256").update(compressed).digest("hex"),
      compressedBytes: compressed.length,
      method: result.method
    },
    null,
    2
  )}\n`
);
console.log(
  `Matched ${candidates.length} narrator-authority candidates and detected ${chronologyWarnings.length} chronology/broken-link warning(s) (${compressed.length} compressed bytes).`
);
