import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("dist/build-manifest.json", root), "utf8"));
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);
check("manifest release matches package", manifest.releaseVersion === packageJson.version);
check("all manifest assets exist", (await Promise.all(manifest.generatedFiles.map(async (file) => readFile(new URL(`dist/${file}`, root)).then(() => true, () => false)))).every(Boolean));

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
