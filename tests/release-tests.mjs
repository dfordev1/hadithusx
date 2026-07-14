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
