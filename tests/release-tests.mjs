import { execFile, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("dist/build-manifest.json", root), "utf8"));
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);
check("manifest release matches package", manifest.releaseVersion === packageJson.version);
check("all manifest assets exist", (await Promise.all(manifest.generatedFiles.map(async (file) => readFile(new URL(`dist/${file}`, root)).then(() => true, () => false)))).every(Boolean));

// --- scripts/validate.mjs as a general-purpose CLI (spec/COMPATIBILITY.md) ---
{
  const defaultRun = await execFileAsync(process.execPath, ["scripts/validate.mjs"], { cwd: root }).catch((e) => e);
  check("validator with no args validates the default fixtures", !(defaultRun instanceof Error) && /witnesses/.test(defaultRun.stdout) && /Narrator authority validation passed/.test(defaultRun.stdout));

  const explicitBothRun = await execFileAsync(process.execPath, ["scripts/validate.mjs", "data/corpus.json", "data/narrator-authority.fixture.json"], { cwd: root }).catch((e) => e);
  check("validator accepts explicit corpus and authority file arguments", !(explicitBothRun instanceof Error) && /Narrator authority validation passed/.test(explicitBothRun.stdout));

  const corpusOnlyRun = await execFileAsync(process.execPath, ["scripts/validate.mjs", "data/corpus.json"], { cwd: root }).catch((e) => e);
  check("validator accepts a corpus-only argument and skips authority validation", !(corpusOnlyRun instanceof Error) && /skipped narrator authority validation/.test(corpusOnlyRun.stdout));

  const missingFileRun = await execFileAsync(process.execPath, ["scripts/validate.mjs", "/tmp/unified-hadith-does-not-exist.json"], { cwd: root }).catch((e) => e);
  check("validator exits non-zero with a clean message for a missing file", missingFileRun instanceof Error && missingFileRun.code === 1 && /Could not read or parse corpus file/.test(missingFileRun.stderr));

  const invalidCorpusPath = new URL("data/invalid-cli-test-corpus.json", root);
  const invalidCorpus = { ...JSON.parse(await readFile(new URL("data/corpus.json", root), "utf8")) };
  invalidCorpus.persons = invalidCorpus.persons.slice(1); // drop a person referenced by an identity assertion -> semantic validation failure
  await writeFile(invalidCorpusPath, JSON.stringify(invalidCorpus), "utf8");
  const invalidRun = await execFileAsync(process.execPath, ["scripts/validate.mjs", "data/invalid-cli-test-corpus.json"], { cwd: root }).catch((e) => e);
  check("validator rejects a semantically invalid corpus file with a non-zero exit", invalidRun instanceof Error && invalidRun.code === 1 && /unresolved person/.test(invalidRun.stderr));
  await import("node:fs/promises").then((fs) => fs.rm(invalidCorpusPath, { force: true }));
}

const port = 18090;
const server = spawn(process.execPath, ["scripts/serve.mjs"], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { const response = await fetch(`http://127.0.0.1:${port}/healthz`); ready = response.ok; if (ready) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  check("release server becomes healthy", ready);
  if (ready) {
    const page = await fetch(`http://127.0.0.1:${port}/`);
    check("release homepage is served", page.ok && (await page.text()).includes("Unified Hadith"));
    check("content type protection is enabled", page.headers.get("x-content-type-options") === "nosniff");
    check("frame embedding is denied", page.headers.get("x-frame-options") === "DENY");
    check("content security policy is enabled", page.headers.get("content-security-policy")?.includes("default-src 'self'"));
    const head = await fetch(`http://127.0.0.1:${port}/app.js`, { method: "HEAD" });
    check("HEAD requests are supported", head.ok && (await head.text()) === "");
    const missing = await fetch(`http://127.0.0.1:${port}/missing-file`);
    check("missing assets return 404", missing.status === 404);
    const corpusPage = await fetch(`http://127.0.0.1:${port}/corpus.html`);
    check("whole-corpus browser is served", corpusPage.ok && (await corpusPage.text()).includes("Whole corpus"));
    const corpusMetaResponse = await fetch(`http://127.0.0.1:${port}/api/corpus/meta`);
    const corpusMeta = await corpusMetaResponse.json();
    check("whole-corpus metadata API reports all records", corpusMetaResponse.ok && corpusMeta.reportCount === 26727 && corpusMeta.sources.length === 5);
    const corpusSearchResponse = await fetch(`http://127.0.0.1:${port}/api/corpus?q=${encodeURIComponent("إنما الأعمال")}&limit=5`);
    const corpusSearch = await corpusSearchResponse.json();
    check("Arabic corpus search is paginated", corpusSearchResponse.ok && corpusSearch.results.length <= 5 && corpusSearch.total >= 5 && corpusSearch.page === 1);
    check("corpus API omits bulky raw source blocks", corpusSearch.results.every((result) => !("rawOpenITI" in result)));
    const boundedResponse = await fetch(`http://127.0.0.1:${port}/api/corpus?limit=500`);
    const bounded = await boundedResponse.json();
    check("corpus API enforces page-size ceiling", bounded.limit === 50 && bounded.results.length === 50);
    const normalizedResponse = await fetch(`http://127.0.0.1:${port}/api/corpus?q=${encodeURIComponent("الاعمال")}&mode=normalized&limit=1`);
    const exactResponse = await fetch(`http://127.0.0.1:${port}/api/corpus?q=${encodeURIComponent("الاعمال")}&mode=exact&limit=1`);
    const normalizedSearch = await normalizedResponse.json(), exactSearch = await exactResponse.json();
    check("normalized Arabic search folds hamza", normalizedSearch.mode === "normalized" && normalizedSearch.total > exactSearch.total);
    check("exact Arabic search preserves spelling", exactSearch.mode === "exact");
    check("corpus metadata reports search modes and structure coverage", corpusMeta.searchModes.includes("exact") && corpusMeta.structureCoverage.withMatnBoundary === 24991);
    const parallelResponse = await fetch(`http://127.0.0.1:${port}/api/parallels?report=${encodeURIComponent("openiti:0256Bukhari.Sahih.Shamela0001681-ara1:1117")}&limit=3`);
    const parallelSearch = await parallelResponse.json();
    check("parallel API returns bounded explainable candidates", parallelResponse.ok && parallelSearch.candidates.length > 0 && parallelSearch.candidates.length <= 3 && parallelSearch.candidates.every((candidate) => candidate.sharedFourWordSequences.length >= 2 && candidate.counterpart));
    const missingReportResponse = await fetch(`http://127.0.0.1:${port}/api/parallels`);
    check("parallel API requires a report identifier", missingReportResponse.status === 400);
    const narratorMetaResponse = await fetch(`http://127.0.0.1:${port}/api/narrators/meta`);
    const narratorMeta = await narratorMetaResponse.json();
    check("narrator metadata API reports occurrence evidence", narratorMetaResponse.ok && narratorMeta.mentionCount === 156330 && narratorMeta.clusterCount === 6992 && narratorMeta.method.automaticPersonCreation === false);
    const narratorSearchResponse = await fetch(`http://127.0.0.1:${port}/api/narrators?q=${encodeURIComponent("عمر بن الخطاب")}&limit=5`);
    const narratorSearch = await narratorSearchResponse.json();
    check("Arabic narrator cluster search is bounded", narratorSearchResponse.ok && narratorSearch.results.length > 0 && narratorSearch.results.length <= 5 && narratorSearch.results.every((cluster) => cluster.identity === null));
    const clusterResponse = await fetch(`http://127.0.0.1:${port}/api/narrator-cluster?id=${encodeURIComponent(narratorSearch.results[0].id)}`);
    const cluster = await clusterResponse.json();
    check("narrator cluster detail retains source occurrences", clusterResponse.ok && cluster.examples.length > 0 && cluster.examples.every((mention) => mention.report && mention.sourceSpan));
    const missingClusterResponse = await fetch(`http://127.0.0.1:${port}/api/narrator-cluster`);
    check("narrator detail API requires cluster id", missingClusterResponse.status === 400);
    const authorityMetaResponse = await fetch(`http://127.0.0.1:${port}/api/narrator-authority/meta`);
    const authorityMeta = await authorityMetaResponse.json();
    check("narrator-authority metadata API reports method and warning count", authorityMetaResponse.ok && authorityMeta.method.automaticIdentityResolution === false && Number.isInteger(authorityMeta.chronologyWarningCount));
    const authorityCandidatesResponse = await fetch(`http://127.0.0.1:${port}/api/narrator-authority-candidates?cluster=${encodeURIComponent(narratorSearch.results[0].id)}`);
    const authorityCandidates = await authorityCandidatesResponse.json();
    check("narrator-authority candidate API responds for a real cluster and never auto-resolves", authorityCandidatesResponse.ok && Array.isArray(authorityCandidates.candidates) && authorityCandidates.candidates.every((candidate) => candidate.acceptedIdentity === null));
    const missingAuthorityClusterResponse = await fetch(`http://127.0.0.1:${port}/api/narrator-authority-candidates`);
    check("narrator-authority candidate API requires a cluster id", missingAuthorityClusterResponse.status === 400);
  }
} finally {
  server.kill();
}

let failures = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) failures++;
}
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} release tests passed.`);
