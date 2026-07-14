import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { gunzipSync } from "node:zlib";

const port = Number(process.env.PORT || 8090);
const root = new URL("../dist/", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };
const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};
let wholeCorpus;
let parallelIndex;
let narratorIndex;
async function getWholeCorpus() {
  if (!wholeCorpus) wholeCorpus = JSON.parse(gunzipSync(await readFile(join(root, "openiti-five-collections.json.gz"))).toString("utf8"));
  return wholeCorpus;
}
async function getParallelIndex() {
  if (!parallelIndex) parallelIndex = JSON.parse(gunzipSync(await readFile(join(root, "openiti-parallel-candidates.json.gz"))).toString("utf8"));
  return parallelIndex;
}
async function getNarratorIndex() {
  if (!narratorIndex) narratorIndex = JSON.parse(gunzipSync(await readFile(join(root, "openiti-narrator-mentions.json.gz"))).toString("utf8"));
  return narratorIndex;
}
const normalizeSearch = (value) => value.normalize("NFC").replace(/[ًٌٍَُِّْـ]/gu, "").replace(/[إأآٱ]/gu, "ا").toLocaleLowerCase("ar");
const exactSearch = (value) => value.normalize("NFC").toLocaleLowerCase("ar");

createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const urlPath = decodeURIComponent(requestUrl.pathname);
    if (urlPath === "/healthz") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (urlPath === "/api/corpus") {
      if (!new Set(["GET", "HEAD"]).has(request.method)) { response.writeHead(405, { Allow: "GET, HEAD", ...securityHeaders }); response.end(); return; }
      const corpus = await getWholeCorpus();
      const mode = requestUrl.searchParams.get("mode") === "exact" ? "exact" : "normalized";
      const searchTransform = mode === "exact" ? exactSearch : normalizeSearch;
      const query = searchTransform(requestUrl.searchParams.get("q")?.trim() || "");
      const collection = requestUrl.searchParams.get("collection")?.trim() || "";
      const page = Math.max(1, Number.parseInt(requestUrl.searchParams.get("page") || "1", 10) || 1);
      const limit = Math.min(50, Math.max(1, Number.parseInt(requestUrl.searchParams.get("limit") || "20", 10) || 20));
      const matches = corpus.records.filter((record) => (!collection || record.sourceKey === collection) && (!query || searchTransform(`${record.reportNumber} ${record.book} ${record.chapter} ${record.normalizedText}`).includes(query)));
      const start = (page - 1) * limit;
      const payload = { format: "unified-hadith-corpus-search-0.2", query: requestUrl.searchParams.get("q") || "", mode, collection, page, limit, total: matches.length, pages: Math.ceil(matches.length / limit), results: matches.slice(start, start + limit).map(({ rawOpenITI, ...record }) => record) };
      const body = JSON.stringify(payload);
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...securityHeaders });
      response.end(request.method === "HEAD" ? undefined : body);
      return;
    }
    if (urlPath === "/api/corpus/meta") {
      const corpus = await getWholeCorpus();
      const body = JSON.stringify({ format: corpus.format, reportCount: corpus.reportCount, structureCoverage: corpus.structureCoverage, searchModes: ["normalized", "exact"], license: corpus.license, licenseUrl: corpus.licenseUrl, attribution: corpus.attribution, sources: corpus.sources });
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...securityHeaders });
      response.end(request.method === "HEAD" ? undefined : body);
      return;
    }
    if (urlPath === "/api/parallels") {
      const report = requestUrl.searchParams.get("report")?.trim() || "";
      if (!report) { response.writeHead(400, { "Content-Type": "application/json; charset=utf-8", ...securityHeaders }); response.end(JSON.stringify({ error: "report is required" })); return; }
      const limit = Math.min(20, Math.max(1, Number.parseInt(requestUrl.searchParams.get("limit") || "10", 10) || 10));
      const confidence = requestUrl.searchParams.get("confidence") || "";
      const [corpus, parallels] = await Promise.all([getWholeCorpus(), getParallelIndex()]);
      const records = new Map(corpus.records.map((record) => [record.id, record]));
      const matches = parallels.candidates.filter((candidate) => (candidate.left === report || candidate.right === report) && (!confidence || candidate.confidence === confidence)).slice(0, limit).map((candidate) => {
        const counterpartId = candidate.left === report ? candidate.right : candidate.left;
        const counterpart = records.get(counterpartId);
        return { ...candidate, counterpart: counterpart ? { id: counterpart.id, collectionLabel: counterpart.collectionLabel, reportNumber: counterpart.reportNumber, occurrence: counterpart.occurrence, normalizedText: counterpart.normalizedText } : null };
      });
      const body = JSON.stringify({ format: "unified-hadith-parallel-search-0.1", sourceCorpusSha256: parallels.sourceCorpusSha256, report, total: parallels.candidates.filter((candidate) => candidate.left === report || candidate.right === report).length, returned: matches.length, candidates: matches });
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...securityHeaders });
      response.end(request.method === "HEAD" ? undefined : body);
      return;
    }
    if (urlPath === "/api/narrators/meta") {
      const narrators = await getNarratorIndex();
      const body = JSON.stringify({ format: narrators.format, sourceCorpusSha256: narrators.sourceCorpusSha256, mentionCount: narrators.mentionCount, clusterCount: narrators.clusterCount, method: narrators.method });
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...securityHeaders }); response.end(request.method === "HEAD" ? undefined : body); return;
    }
    if (urlPath === "/api/narrators") {
      const narrators = await getNarratorIndex();
      const q = normalizeSearch(requestUrl.searchParams.get("q")?.trim() || "");
      const page = Math.max(1, Number.parseInt(requestUrl.searchParams.get("page") || "1", 10) || 1);
      const limit = Math.min(50, Math.max(1, Number.parseInt(requestUrl.searchParams.get("limit") || "20", 10) || 20));
      const matches = narrators.clusters.filter((cluster) => !q || normalizeSearch(`${cluster.normalizedSurface} ${cluster.surfaceForms.join(" ")}`).includes(q));
      const start = (page - 1) * limit;
      const body = JSON.stringify({ format: "unified-hadith-narrator-cluster-search-0.1", query: requestUrl.searchParams.get("q") || "", page, limit, total: matches.length, pages: Math.ceil(matches.length / limit), results: matches.slice(start, start + limit) });
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...securityHeaders }); response.end(request.method === "HEAD" ? undefined : body); return;
    }
    if (urlPath === "/api/narrator-cluster") {
      const id = requestUrl.searchParams.get("id")?.trim() || "";
      if (!id) { response.writeHead(400, { "Content-Type": "application/json; charset=utf-8", ...securityHeaders }); response.end(JSON.stringify({ error: "id is required" })); return; }
      const narrators = await getNarratorIndex();
      const cluster = narrators.clusters.find((item) => item.id === id);
      if (!cluster) { response.writeHead(404, { "Content-Type": "application/json; charset=utf-8", ...securityHeaders }); response.end(JSON.stringify({ error: "cluster not found" })); return; }
      const examples = cluster.exampleMentions.map((mentionId) => narrators.mentions.find((mention) => mention.id === mentionId)).filter(Boolean);
      const body = JSON.stringify({ format: "unified-hadith-narrator-cluster-detail-0.1", cluster, examples });
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...securityHeaders }); response.end(request.method === "HEAD" ? undefined : body); return;
    }
    const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
    let file = normalize(join(root, relative));
    if (!file.toLowerCase().startsWith(normalize(root).toLowerCase())) throw new Error("Forbidden");
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      ...securityHeaders
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Unified Hadith Workbench: http://localhost:${port}`));
