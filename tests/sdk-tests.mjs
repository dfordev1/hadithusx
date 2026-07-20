import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReviewExport, corpusToXml, xmlToCorpus, SDK_VERSION, matchNarratorAuthorityCandidates } from "../sdk/index.mjs";

const run = promisify(execFile);
const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const sdkPath = fileURLToPath(new URL("../sdk/", import.meta.url));
const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check("SDK version is 0.x (standalone package)", /^0\./.test(SDK_VERSION));
const corpus = JSON.parse(await readFile(new URL("data/corpus.json", root), "utf8"));
const round = xmlToCorpus(corpusToXml(corpus));
check("SDK re-exports lossless XML round-trip", round.witnesses.length === corpus.witnesses.length);
const exportDoc = createReviewExport({
  projectId: "demo",
  reviewer: "tester",
  decisions: [{ id: "d1", decision: "needs-evidence", reviewState: "disputed" }]
});
check("SDK review export retains disagreements", exportDoc.disagreements.length === 1);
check("matcher export is callable from SDK", typeof matchNarratorAuthorityCandidates === "function");

await mkdir(new URL("dist/graph/", root), { recursive: true });
await run(process.execPath, ["scripts/export-graph.mjs"], { cwd: rootPath });
const graphml = await readFile(new URL("dist/graph/corpus.graphml", root), "utf8");
const jsonld = JSON.parse(await readFile(new URL("dist/graph/corpus.jsonld", root), "utf8"));
check("graph export writes GraphML", /<graphml[\s>]/.test(graphml) && /hasMention/.test(graphml));
check("graph export writes JSON-LD", Array.isArray(jsonld["@graph"]) && jsonld["@graph"].length > 0);

// --- sdk/ package self-containment: pack, extract, and import from OUTSIDE
// the repo entirely, so any accidental "../scripts/..." or "../data/..."
// import would fail loudly instead of silently working because it happens
// to still resolve inside the monorepo checkout.
const packInfo = JSON.parse((await run("npm", ["pack", "--json", "--pack-destination", sdkPath], { cwd: sdkPath })).stdout);
const tarballName = packInfo[0].filename;
const tarballPath = join(sdkPath, tarballName);
check("sdk package tarball contains only files under sdk/", packInfo[0].files.every((f) => !f.path.startsWith("..")));
check(
  "sdk package tarball has no stray files beyond index/lib/fixtures/README/package.json",
  packInfo[0].files.every((f) => /^(index\.mjs|package\.json|README\.md|lib\/.+\.mjs|fixtures\/.+\.json)$/.test(f.path))
);

const extractDir = await mkdtemp(join(tmpdir(), "unified-hadith-sdk-pack-"));
try {
  await run("tar", ["-xzf", tarballPath, "-C", extractDir]);
  const packageDir = join(extractDir, "package");
  // Install the package's own declared dependencies (just @xmldom/xmldom)
  // in isolation, so the probe below cannot accidentally resolve anything
  // from the monorepo's node_modules.
  await run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], { cwd: packageDir });

  // Run in a subprocess whose cwd is entirely outside the monorepo, and
  // whose only filesystem context is the extracted tarball, proving the
  // package needs nothing from ../scripts or ../data.
  const probeScript = `
    import { readFile } from "node:fs/promises";
    import { validateCorpus, corpusToXml, xmlToCorpus, matchNarratorAuthorityCandidates, SDK_VERSION } from ${JSON.stringify(join(packageDir, "index.mjs"))};
    const corpus = JSON.parse(await readFile(${JSON.stringify(join(packageDir, "fixtures/demo-corpus.json"))}, "utf8"));
    const errors = validateCorpus(corpus);
    const roundTripped = xmlToCorpus(corpusToXml(corpus));
    const ok =
      errors.length === 0 &&
      roundTripped.witnesses.length === corpus.witnesses.length &&
      typeof matchNarratorAuthorityCandidates === "function" &&
      typeof SDK_VERSION === "string";
    console.log(ok ? "PACKED_SDK_OK" : "PACKED_SDK_FAIL:" + JSON.stringify(errors));
  `;
  const probePath = join(extractDir, "probe.mjs");
  await (await import("node:fs/promises")).writeFile(probePath, probeScript, "utf8");
  const { stdout } = await run(process.execPath, [probePath], { cwd: extractDir });
  check("packed sdk tarball is importable and functional from outside the repo", stdout.includes("PACKED_SDK_OK"));
} finally {
  await rm(extractDir, { recursive: true, force: true });
  await rm(tarballPath, { force: true });
}

let failures = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) failures += 1;
}
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} SDK/graph tests passed.`);
