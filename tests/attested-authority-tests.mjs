import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = new URL("../", import.meta.url);
const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

const authorityText = await readFile(new URL("data/narrator-authority.openiti-attested.json", root), "utf8");
const authority = JSON.parse(authorityText);
const schema = JSON.parse(await readFile(new URL("schema/narrator-authority.schema.json", root), "utf8"));
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const valid = ajv.validate(schema, authority);
check("attested authority validates against narrator-authority schema", valid);
check("attested authority declares OpenITI license on its primary source", authority.sources.some((s) => s.id === "uh:source:openiti-attested-surfaces" && /CC-BY-NC-SA-4\.0/i.test(s.license)));
check("attested authority includes a substantial person set", authority.persons.length >= 50);
check("attested persons remain imported/machine-suggested, never scholar-verified", authority.persons.every((p) => p.reviewState === "imported" || p.reviewState === "machine-suggested"));
check("attested authority provenance denies encyclopedia status", /Not a biographical encyclopedia/i.test(authority.sources[0].provenance));

const candidateBytes = await readFile(new URL("data/staging/openiti-attested-authority-candidates.json.gz", root));
const candidateData = JSON.parse(gunzipSync(candidateBytes).toString("utf8"));
const manifest = JSON.parse(await readFile(new URL("data/staging/openiti-attested-authority-candidates.manifest.json", root), "utf8"));
check("attested candidates are checksum-tied to attested authority", candidateData.sourceAuthoritySha256 === createHash("sha256").update(authorityText).digest("hex"));
check("attested candidate count is substantial", candidateData.candidateCount >= 50 && candidateData.candidates.length === candidateData.candidateCount);
check("attested candidates never auto-resolve identity", candidateData.candidates.every((c) => c.acceptedIdentity === null && c.reviewState === "machine-suggested"));
check("attested candidate manifest matches staged artifact", manifest.candidateCount === candidateData.candidateCount && manifest.compressedSha256 === createHash("sha256").update(candidateBytes).digest("hex"));

let failures = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) failures += 1;
}
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} attested-authority tests passed.`);
