import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { corpusToXml, xmlToCorpus } from "../scripts/lib/xml-interchange.mjs";

const run = promisify(execFile);
const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

// Canonical stringify: sorts object keys recursively so structural equality
// doesn't depend on property insertion order. Round-tripping through XML
// (attribute order, element construction order) has no reason to preserve
// JSON key order, and it shouldn't have to for the data to be "lossless."
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

const root = new URL("../", import.meta.url);
const original = JSON.parse(await readFile(new URL("data/corpus.json", root), "utf8"));

// --- Round-trip: JSON -> XML -> JSON must reproduce the original exactly ---
const xml = corpusToXml(original);
const roundTripped = xmlToCorpus(xml);
check("round-trip reproduces the corpus exactly (deep structural equality)", JSON.stringify(canonical(roundTripped)) === JSON.stringify(canonical(original)));
check("round-trip preserves witness count", roundTripped.witnesses.length === original.witnesses.length);
check("round-trip preserves every isnad route length", original.witnesses.every((w, i) => w.isnads.every((isnad, j) => isnad.route.length === roundTripped.witnesses[i].isnads[j].route.length)));
check("round-trip preserves Arabic diplomatic text exactly", original.witnesses.every((w, i) => w.matn.diplomatic === roundTripped.witnesses[i].matn.diplomatic));
check("round-trip preserves optional fields (license, notes, evidence) when present", original.editions.some((e) => "license" in e) ? roundTripped.editions.some((e) => "license" in e) : true);
check("round-trip omits optional fields when absent, rather than inventing empty strings", original.persons.filter((p) => !("notes" in p)).every((p) => !("notes" in roundTripped.persons.find((r) => r.id === p.id))));
check("structuredLocator round-trips when present, including optional chapter/reportNumber", (() => {
  const withLocator = original.witnesses.find((w) => w.structuredLocator);
  if (!withLocator) return false;
  const back = roundTripped.witnesses.find((w) => w.id === withLocator.id);
  return JSON.stringify(canonical(back.structuredLocator)) === JSON.stringify(canonical(withLocator.structuredLocator)) && typeof back.structuredLocator.reportNumber === "number";
})());
check("structuredLocator stays absent on witnesses that never had one", original.witnesses.filter((w) => !w.structuredLocator).every((w) => !("structuredLocator" in roundTripped.witnesses.find((r) => r.id === w.id))));
check("commentaries/gradings/crossReferences round-trip when present", (() => {
  if (!original.commentaries?.length || !original.gradings?.length || !original.crossReferences?.length) return false;
  return (
    JSON.stringify(canonical(roundTripped.commentaries)) === JSON.stringify(canonical(original.commentaries)) &&
    JSON.stringify(canonical(roundTripped.gradings)) === JSON.stringify(canonical(original.gradings)) &&
    JSON.stringify(canonical(roundTripped.crossReferences)) === JSON.stringify(canonical(original.crossReferences))
  );
})());
check("competing gradings can disagree without collapsing", original.gradings.some((g) => g.contradicts) && roundTripped.gradings.some((g) => g.contradicts));

// --- Generated XML must validate against the XSD via xmllint ---
const tmpDir = await mkdtemp(join(tmpdir(), "uh-xml-"));
const xmlPath = join(tmpDir, "corpus.xml");
await writeFile(xmlPath, xml, "utf8");
let xmllintAvailable = true;
let xsdValid = false;
try {
  await run("xmllint", ["--noout", "--schema", new URL("schema/unified-hadith.xsd", root).pathname, xmlPath]);
  xsdValid = true;
} catch (error) {
  if (error.code === "ENOENT") xmllintAvailable = false;
  else xsdValid = false;
}
await rm(tmpDir, { recursive: true, force: true });
if (xmllintAvailable) {
  check("generated XML validates against schema/unified-hadith.xsd", xsdValid);
} else {
  console.log("SKIP generated XML validates against schema/unified-hadith.xsd (xmllint not installed)");
}

// --- Malformed XML must fail loudly, not silently produce a partial corpus ---
check("parsing non-corpus XML throws instead of returning a partial object", (() => {
  try {
    xmlToCorpus("<?xml version=\"1.0\"?><notCorpus/>");
    return false;
  } catch {
    return true;
  }
})());

let failures = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) failures++;
}
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} JSON<->XML interchange tests passed.`);
