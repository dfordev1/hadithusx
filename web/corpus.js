const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
let meta, page = 1;
const PARALLEL_REVIEW_KEY = "unified-hadith-parallel-review-v1";
let parallelReview = JSON.parse(localStorage.getItem(PARALLEL_REVIEW_KEY) || "{}");
let parallelSourceCorpusSha256 = null;

async function getJson(url) { const response = await fetch(url, { cache: "no-store" }); if (!response.ok) throw new Error(`${url} returned ${response.status}`); return response.json(); }

// Deep-linkable search: the current query/collection/mode/page is mirrored
// into the URL hash (via replaceState, so it never fires hashchange itself
// and can't self-trigger a loop) so a search result can be bookmarked or
// shared as a plain URL. Genuine browser back/forward navigation still
// fires hashchange and is handled separately below.
function syncSearchHash(params) {
  history.replaceState(null, "", `#${params.toString()}`);
}
function readSearchHash() {
  return new URLSearchParams(location.hash.slice(1));
}

function renderMetrics() {
  const boundaryPercent = Math.round(meta.structureCoverage.withMatnBoundary / meta.reportCount * 100);
  $("#corpus-metrics").innerHTML = [[meta.reportCount, "numbered reports"], [meta.sources.length, "collections"], [`${boundaryPercent}%`, "matn boundary candidates"], ["CC", "non-commercial share-alike"]].map(([value, label]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("");
  $("select[name=collection]").insertAdjacentHTML("beforeend", meta.sources.map((source) => `<option value="${escapeHtml(source.sourceKey)}">${escapeHtml(source.collectionLabel)} (${source.reports})</option>`).join(""));
}

async function search(targetPage = 1) {
  page = targetPage;
  const form = new FormData($("#corpus-search"));
  const params = new URLSearchParams({ q: form.get("q"), collection: form.get("collection"), mode: form.get("mode"), page: String(page), limit: "20" });
  syncSearchHash(params);
  $("#results").innerHTML = "<p>Searching pinned corpus…</p>";
  const data = await getJson(`/api/corpus?${params}`);
  const cards = data.results.map((report) => `<article class="card corpus-result" data-report-id="${escapeHtml(report.id)}"><div>${report.reviewState === "imported" ? '<span class="badge machine-suggested">imported</span>' : ""} <span class="badge">${escapeHtml(report.structure.boundaryMethod)}</span></div><h2>${escapeHtml(report.collectionLabel)} ${report.reportNumber}${report.occurrence > 1 ? ` · occurrence ${report.occurrence}` : ""}</h2><p class="id">${escapeHtml(report.id)}</p>${report.book ? `<p><strong>${escapeHtml(report.book)}</strong>${report.chapter ? `<br>${escapeHtml(report.chapter)}` : ""}</p>` : ""}<p class="arabic corpus-arabic" lang="ar" dir="rtl">${escapeHtml(report.normalizedText)}</p><button type="button" data-find-parallels>Find parallel candidates</button><div data-parallel-results></div></article>`).join("");
  $("#results").innerHTML = `<div class="section-heading"><div><p class="eyebrow">SEARCH RESULTS · ${escapeHtml(data.mode)}</p><h2>${data.total.toLocaleString()} reports</h2></div><p>Page ${data.pages ? data.page : 0} of ${data.pages}</p></div>${cards || '<div class="empty"><h3>No matching reports</h3><p>Try a different Arabic phrase, mode, or collection.</p></div>'}<div class="pagination"><button data-page="${Math.max(1, data.page - 1)}" ${data.page <= 1 ? "disabled" : ""}>Previous</button><button data-page="${data.page + 1}" ${data.page >= data.pages ? "disabled" : ""}>Next</button></div>`;
  $("#results").focus({ preventScroll: true });
}

function applySearchHashToForm() {
  const hash = readSearchHash();
  const form = $("#corpus-search");
  if (hash.has("q")) form.elements.q.value = hash.get("q");
  if (hash.has("collection")) form.elements.collection.value = hash.get("collection");
  if (hash.has("mode")) form.elements.mode.value = hash.get("mode");
  return Number.parseInt(hash.get("page") || "1", 10) || 1;
}

try {
  meta = await getJson("/api/corpus/meta"); renderMetrics();
  const initialPage = applySearchHashToForm();
  await search(initialPage);
  $("#corpus-search").addEventListener("submit", (event) => { event.preventDefault(); search(1).catch(showError); });
  addEventListener("hashchange", () => { search(applySearchHashToForm()).catch(showError); });
  $("#results").addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-page]"); if (pageButton && !pageButton.disabled) { search(Number(pageButton.dataset.page)).catch(showError); return; }
    const parallelButton = event.target.closest("[data-find-parallels]"); if (parallelButton) { loadParallels(parallelButton.closest("[data-report-id]")).catch(showError); return; }
    const reviewButton = event.target.closest("[data-parallel-decision]"); if (reviewButton) {
      const candidate = reviewButton.closest("[data-parallel-candidate]");
      parallelReview[candidate.dataset.parallelCandidate] = { decision: reviewButton.dataset.parallelDecision, decidedAt: new Date().toISOString(), sourceCorpusSha256: parallelSourceCorpusSha256 };
      localStorage.setItem(PARALLEL_REVIEW_KEY, JSON.stringify(parallelReview));
      candidate.querySelector("[data-review-state]").textContent = reviewButton.dataset.parallelDecision;
    }
  });
  $("#export-parallel-review").addEventListener("click", exportParallelReview);
} catch (error) { showError(error); }
function showError(error) { $("#results").innerHTML = `<div class="fatal"><h2>The corpus could not load</h2><p>${escapeHtml(error.message)}</p><button onclick="location.reload()">Retry</button></div>`; }

async function loadParallels(card) {
  const target = card.querySelector("[data-parallel-results]");
  target.innerHTML = "<p>Finding explainable candidates…</p>";
  const data = await getJson(`/api/parallels?report=${encodeURIComponent(card.dataset.reportId)}&limit=10`);
  parallelSourceCorpusSha256 = data.sourceCorpusSha256;
  target.innerHTML = data.candidates.length ? `<div class="parallel-list"><p class="warning">Machine suggestions only. Shared wording does not prove a common report or authenticity.</p>${data.candidates.map((candidate) => `<article class="parallel-candidate" data-parallel-candidate="${escapeHtml(candidate.id)}"><div>${candidate.counterpart ? `<strong>${escapeHtml(candidate.counterpart.collectionLabel)} ${candidate.counterpart.reportNumber}</strong>` : "Unknown record"} <span class="badge machine-suggested">${escapeHtml(candidate.confidence)}</span> <span class="badge" data-review-state>${escapeHtml(parallelReview[candidate.id]?.decision || "pending")}</span></div><p>Shared wording:</p><ul>${candidate.sharedFourWordSequences.slice(0, 4).map((sequence) => `<li lang="ar" dir="rtl">${escapeHtml(sequence)}</li>`).join("")}</ul><p class="id">Jaccard ${candidate.measures.tokenJaccard} · shorter-text containment ${candidate.measures.shorterTextContainment}<br>${escapeHtml(candidate.id)}</p><div class="review-actions"><button data-parallel-decision="accept-candidate">Accept candidate</button><button data-parallel-decision="reject">Reject</button><button data-parallel-decision="needs-evidence">Needs evidence</button></div></article>`).join("")}</div>` : '<p class="empty">No candidates passed the current explainable threshold.</p>';
}

function exportParallelReview() {
  const payload = { format: "unified-hadith-parallel-review-0.1", exportedAt: new Date().toISOString(), sourceCorpusSha256: parallelSourceCorpusSha256, decisions: parallelReview };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: "unified-hadith-parallel-review.json" });
  link.click(); URL.revokeObjectURL(url);
}
