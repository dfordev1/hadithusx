import { readFile } from "node:fs/promises";
import { validateCorpus } from "../scripts/lib/validate-corpus.mjs";

const original = JSON.parse(await readFile(new URL("../data/corpus.json", import.meta.url), "utf8"));
const clone = () => structuredClone(original);
const cases = [
  ["valid corpus", () => original, true],
  ["duplicate top-level ID", () => { const x = clone(); x.persons[1].id = x.persons[0].id; return x; }, false],
  ["unresolved edition", () => { const x = clone(); x.witnesses[0].edition = "uh:edition:missing"; return x; }, false],
  ["broken token continuity", () => { const x = clone(); x.witnesses[0].matn.tokens[1].position = 9; return x; }, false],
  ["text/token mismatch", () => { const x = clone(); x.witnesses[0].matn.tokens[0].text = "مختلف"; return x; }, false],
  ["unresolved narrator", () => { const x = clone(); x.witnesses[0].isnads[0].route[0].identityAssertions[0].person = "uh:person:missing"; return x; }, false],
  ["human-attributed machine suggestion", () => { const x = clone(); const a = x.witnesses[2].isnads[0].route[0].identityAssertions[0]; a.assertedBy = "uh:agent:prototype-editor"; return x; }, false],
  ["missing claim citation", () => { const x = clone(); x.claims[0].citation = ""; return x; }, false],
  ["unresolved alignment token", () => { const x = clone(); x.alignments[0].members[0].tokens[0] = "uh:token:missing:001"; return x; }, false]
];

let failed = 0;
for (const [name, make, shouldPass] of cases) {
  const errors = validateCorpus(make());
  const passed = shouldPass ? errors.length === 0 : errors.length > 0;
  console.log(`${passed ? "PASS" : "FAIL"} ${name}${errors.length ? ` (${errors[0]})` : ""}`);
  if (!passed) failed++;
}
if (failed) process.exit(1);
console.log(`${cases.length}/${cases.length} conformance tests passed.`);

