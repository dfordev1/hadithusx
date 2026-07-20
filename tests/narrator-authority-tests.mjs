import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { matchNarratorAuthorityCandidates, detectChronologyWarnings, normalizeArabicSurface } from "../scripts/lib/narrator-authority.mjs";

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

// --- Unit-style checks on the pure matching/chronology functions ---
// These use small synthetic fixtures so the algorithm's behavior is
// verified directly, independent of whatever the real corpus currently
// contains (which may legitimately produce zero matches, since the
// project's authority data is still non-historical test fixture data).

const person = (id, nameForms) => ({ id, nameForms: nameForms.map((text, index) => ({ text, type: index === 0 ? "preferred" : "variant" })) });
const cluster = (id, normalizedSurface, occurrenceCount = 5) => ({ id, normalizedSurface, occurrenceCount });

{
  const persons = [person("uh:person:a", ["مالك بن انس"]), person("uh:person:b", ["سفيان"])];
  const clusters = [cluster("uh:cluster:1", normalizeArabicSurface("مالك بن أنس")), cluster("uh:cluster:2", normalizeArabicSurface("سفيان الثوري")), cluster("uh:cluster:3", normalizeArabicSurface("لا علاقة"))];
  const candidates = matchNarratorAuthorityCandidates(persons, clusters);
  check("exact normalized match scores 1 and is explainable", candidates.some((c) => c.person === "uh:person:a" && c.cluster === "uh:cluster:1" && c.score === 1 && c.reason));
  check("single-token ambiguous match scores lower than exact", candidates.find((c) => c.cluster === "uh:cluster:2")?.score < 1);
  check("unrelated cluster produces no candidate", !candidates.some((c) => c.cluster === "uh:cluster:3"));
  check("no candidate ever auto-resolves identity", candidates.every((c) => c.acceptedIdentity === null && c.reviewState === "machine-suggested"));
  check("candidate ids are unique and sequential", candidates.every((c, index) => c.id === `uh:authority-candidate:${index + 1}`));
}

{
  // Impossible chronology: student born after claimed teacher's death.
  const persons = [person("uh:person:teacher", ["م"]), person("uh:person:student", ["ط"])];
  const assertions = [
    { id: "a1", subject: "uh:person:teacher", predicate: "death", value: "100" },
    { id: "a2", subject: "uh:person:student", predicate: "birth", value: "120" },
    { id: "a3", subject: "uh:person:student", predicate: "teacher", value: "uh:person:teacher" }
  ];
  const warnings = detectChronologyWarnings(persons, assertions);
  check("impossible chronology is detected", warnings.some((w) => w.type === "impossible-chronology" && w.assertion === "a3"));
  check("chronology warning never mutates or rejects the assertion", assertions.every((a) => !("reviewState" in a) || a.reviewState !== "rejected"));
}

{
  // Plausible chronology: student born well before teacher's death.
  const persons = [person("uh:person:teacher", ["م"]), person("uh:person:student", ["ط"])];
  const assertions = [
    { id: "a1", subject: "uh:person:teacher", predicate: "death", value: "200" },
    { id: "a2", subject: "uh:person:student", predicate: "birth", value: "150" },
    { id: "a3", subject: "uh:person:student", predicate: "teacher", value: "uh:person:teacher" }
  ];
  const warnings = detectChronologyWarnings(persons, assertions);
  check("plausible chronology produces no impossible-chronology warning", !warnings.some((w) => w.type === "impossible-chronology"));
}

{
  // Broken link: teacher/student assertion references an unknown person.
  const persons = [person("uh:person:student", ["ط"])];
  const assertions = [{ id: "a1", subject: "uh:person:student", predicate: "teacher", value: "uh:person:does-not-exist" }];
  const warnings = detectChronologyWarnings(persons, assertions);
  check("broken link to an unresolved person is flagged", warnings.some((w) => w.type === "broken-link" && w.assertion === "a1"));
}

{
  const warnings = detectChronologyWarnings([], []);
  check("no assertions produces no warnings", warnings.length === 0);
}

// --- Integration checks against the real staged candidate file ---

const root = new URL("../", import.meta.url);
const authorityText = await readFile(new URL("data/narrator-authority.fixture.json", root), "utf8");
const authority = JSON.parse(authorityText);
const narratorBytes = await readFile(new URL("data/staging/openiti-narrator-mentions.json.gz", root));
const candidateBytes = await readFile(new URL("data/staging/openiti-narrator-authority-candidates.json.gz", root));
const candidateData = JSON.parse(gunzipSync(candidateBytes).toString("utf8"));
const manifest = JSON.parse(await readFile(new URL("data/staging/openiti-narrator-authority-candidates.manifest.json", root), "utf8"));

check("staged checksum matches manifest", createHash("sha256").update(candidateBytes).digest("hex") === manifest.compressedSha256);
check("staged candidates are tied to the exact authority fixture", candidateData.sourceAuthoritySha256 === createHash("sha256").update(authorityText).digest("hex"));
check("staged candidates are tied to the exact narrator index", candidateData.sourceNarratorIndexSha256 === createHash("sha256").update(narratorBytes).digest("hex"));
check("staged candidate count matches array length", candidateData.candidateCount === candidateData.candidates.length);
check("staged candidates reference real authority persons", candidateData.candidates.every((c) => authority.persons.some((p) => p.id === c.person)));
check("staged candidates never auto-resolve identity", candidateData.candidates.every((c) => c.acceptedIdentity === null && c.reviewState === "machine-suggested"));
check("staged chronology warnings are structurally a warning list, not rulings", Array.isArray(candidateData.chronologyWarnings) && candidateData.method.warningsAreNotRulings === true);
check("the fixture's deliberately impossible teacher/student claim is caught in the staged output", candidateData.chronologyWarnings.some((w) => w.type === "impossible-chronology" && w.subject === "uh:person:authority-fixture-two"));

let failures = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) failures++;
}
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} narrator-authority-matching tests passed.`);
