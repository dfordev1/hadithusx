const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
let meta, page = 1;

async function getJson(url) { const response = await fetch(url, { cache: "no-store" }); if (!response.ok) throw new Error(`${url} returned ${response.status}`); return response.json(); }

function renderMetrics() {
  const boundaryPercent = Math.round(meta.structureCoverage.withMatnBoundary / meta.reportCount * 100);
  $("#corpus-metrics").innerHTML = [[meta.reportCount, "numbered reports"], [meta.sources.length, "collections"], [`${boundaryPercent}%`, "matn boundary candidates"], ["CC", "non-commercial share-alike"]].map(([value, label]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("");
  $("select[name=collection]").insertAdjacentHTML("beforeend", meta.sources.map((source) => `<option value="${escapeHtml(source.sourceKey)}">${escapeHtml(source.collectionLabel)} (${source.reports})</option>`).join(""));
}

async function search(targetPage = 1) {
  page = targetPage;
  const form = new FormData($("#corpus-search"));
  const params = new URLSearchParams({ q: form.get("q"), collection: form.get("collection"), mode: form.get("mode"), page: String(page), limit: "20" });
  $("#results").innerHTML = "<p>Searching pinned corpus…</p>";
  const data = await getJson(`/api/corpus?${params}`);
  const cards = data.results.map((report) => `<article class="card corpus-result"><div>${report.reviewState === "imported" ? '<span class="badge machine-suggested">imported</span>' : ""} <span class="badge">${escapeHtml(report.structure.boundaryMethod)}</span></div><h2>${escapeHtml(report.collectionLabel)} ${report.reportNumber}${report.occurrence > 1 ? ` · occurrence ${report.occurrence}` : ""}</h2><p class="id">${escapeHtml(report.id)}</p>${report.book ? `<p><strong>${escapeHtml(report.book)}</strong>${report.chapter ? `<br>${escapeHtml(report.chapter)}` : ""}</p>` : ""}<p class="arabic corpus-arabic" lang="ar" dir="rtl">${escapeHtml(report.normalizedText)}</p></article>`).join("");
  $("#results").innerHTML = `<div class="section-heading"><div><p class="eyebrow">SEARCH RESULTS · ${escapeHtml(data.mode)}</p><h2>${data.total.toLocaleString()} reports</h2></div><p>Page ${data.pages ? data.page : 0} of ${data.pages}</p></div>${cards || '<div class="empty"><h3>No matching reports</h3><p>Try a different Arabic phrase, mode, or collection.</p></div>'}<div class="pagination"><button data-page="${Math.max(1, data.page - 1)}" ${data.page <= 1 ? "disabled" : ""}>Previous</button><button data-page="${data.page + 1}" ${data.page >= data.pages ? "disabled" : ""}>Next</button></div>`;
  $("#results").focus({ preventScroll: true });
}

try {
  meta = await getJson("/api/corpus/meta"); renderMetrics(); await search();
  $("#corpus-search").addEventListener("submit", (event) => { event.preventDefault(); search(1).catch(showError); });
  $("#results").addEventListener("click", (event) => { const button = event.target.closest("[data-page]"); if (button && !button.disabled) search(Number(button.dataset.page)).catch(showError); });
} catch (error) { showError(error); }
function showError(error) { $("#results").innerHTML = `<div class="fatal"><h2>The corpus could not load</h2><p>${escapeHtml(error.message)}</p><button onclick="location.reload()">Retry</button></div>`; }
