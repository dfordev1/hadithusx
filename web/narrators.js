const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
async function getJson(url) { const response = await fetch(url, { cache: "no-store" }); if (!response.ok) throw new Error(`${url} returned ${response.status}`); return response.json(); }
let page = 1, meta;

const AUTHORITY_REVIEW_KEY = "unified-hadith-narrator-authority-review-v1";
// Decisions are keyed by candidate id and never deleted on rejection, so a
// previously rejected alternative stays visible with its decision instead
// of silently disappearing (docs/NEXT.md Phase 1: "retain rejected
// alternatives").
let authorityReview = JSON.parse(localStorage.getItem(AUTHORITY_REVIEW_KEY) || "{}");
let authoritySourceAuthoritySha256 = null;
let authoritySourceNarratorIndexSha256 = null;

async function loadAuthorityCandidates(card) {
  const target = card.querySelector("[data-authority-results]");
  target.innerHTML = "<p>Loading identity candidates…</p>";
  const data = await getJson(`/api/narrator-authority-candidates?cluster=${encodeURIComponent(card.dataset.clusterId)}`);
  authoritySourceAuthoritySha256 = data.sourceAuthoritySha256;
  authoritySourceNarratorIndexSha256 = data.sourceNarratorIndexSha256;
  target.innerHTML = data.candidates.length
    ? `<div class="authority-list"><p class="warning">Machine-suggested identity candidates only. No score performs an automatic merge; every link requires human review.</p>${data.candidates
        .map(
          (candidate) =>
            `<article class="authority-candidate" data-authority-candidate="${escapeHtml(candidate.id)}"><div><strong lang="ar" dir="rtl">${escapeHtml(candidate.personPreferredName)}</strong> <span class="badge machine-suggested">${escapeHtml(candidate.confidence)}</span> <span class="badge" data-review-state>${escapeHtml(authorityReview[candidate.id]?.decision || "pending")}</span></div><p>${escapeHtml(candidate.reason)} (score ${candidate.score})</p><p class="id">${escapeHtml(candidate.id)} · name form: ${escapeHtml(candidate.personNameForm)}</p><div class="review-actions"><button data-authority-decision="accept-candidate">Accept candidate</button><button data-authority-decision="reject">Reject</button><button data-authority-decision="needs-evidence">Needs evidence</button></div></article>`
        )
        .join("")}</div>`
    : '<p class="empty">No candidate identity links passed the current matching method for this cluster.</p>';
}

function exportAuthorityReview() {
  const payload = { format: "unified-hadith-narrator-authority-review-0.1", exportedAt: new Date().toISOString(), sourceAuthoritySha256: authoritySourceAuthoritySha256, sourceNarratorIndexSha256: authoritySourceNarratorIndexSha256, decisions: authorityReview };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: "unified-hadith-narrator-authority-review.json" });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function search(targetPage = 1) {
  page = targetPage;
  const q = new FormData($("#narrator-search")).get("q");
  $("#narrator-results").innerHTML = "<p>Searching occurrence evidence…</p>";
  const data = await getJson(`/api/narrators?q=${encodeURIComponent(q)}&page=${page}&limit=20`);
  const cards = data.results.map((cluster) => `<article class="card narrator-cluster" data-cluster-id="${escapeHtml(cluster.id)}"><div><span class="badge machine-suggested">machine-suggested</span> <span class="badge">not a person</span></div><h2 lang="ar" dir="rtl">${escapeHtml(cluster.surfaceForms[0] || cluster.normalizedSurface)}</h2><p>${cluster.occurrenceCount.toLocaleString()} occurrences in ${cluster.reportCount.toLocaleString()} reports</p><p>${Object.entries(cluster.collections).map(([name, count]) => `${escapeHtml(name)}: ${count}`).join(" · ")}</p><p class="id">${escapeHtml(cluster.id)}</p><button type="button" data-show-evidence>Show source evidence</button><button type="button" data-show-authority>Show identity candidates</button><div data-cluster-evidence></div><div data-authority-results></div></article>`).join("");
  $("#narrator-results").innerHTML = `<div class="section-heading"><div><p class="eyebrow">SURFACE-FORM CLUSTERS</p><h2>${data.total.toLocaleString()} clusters</h2></div><p>Page ${data.pages ? data.page : 0} of ${data.pages}</p></div><p class="warning">Clusters group normalized text only. They do not represent resolved narrator identities.</p><div class="grid">${cards}</div><div class="pagination"><button data-page="${Math.max(1, data.page - 1)}" ${data.page <= 1 ? "disabled" : ""}>Previous</button><button data-page="${data.page + 1}" ${data.page >= data.pages ? "disabled" : ""}>Next</button></div>`;
}

async function showEvidence(card) {
  const target = card.querySelector("[data-cluster-evidence]"); target.innerHTML = "<p>Loading source occurrences…</p>";
  const data = await getJson(`/api/narrator-cluster?id=${encodeURIComponent(card.dataset.clusterId)}`);
  target.innerHTML = `<div class="mention-evidence">${data.examples.map((mention) => `<article><strong>${escapeHtml(mention.collectionLabel)} ${mention.reportNumber}</strong> · branch ${mention.branch}, position ${mention.position}<p lang="ar" dir="rtl">${escapeHtml(mention.surface)}</p><p class="id">${escapeHtml(mention.transmissionTerm)} · source ${mention.sourceSpan.start}–${mention.sourceSpan.end}<br>${escapeHtml(mention.id)}</p></article>`).join("")}</div>`;
}

try {
  meta = await getJson("/api/narrators/meta");
  $("#narrator-metrics").innerHTML = [[meta.mentionCount, "mention occurrences"], [meta.clusterCount, "repeated surface clusters"], [0, "automatic person identities"], ["exact", "source spans"]].map(([value, label]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("");
  await search();
  $("#narrator-search").addEventListener("submit", (event) => { event.preventDefault(); search(1).catch(showError); });
  $("#narrator-results").addEventListener("click", (event) => {
    const pageButton = event.target.closest("[data-page]"); if (pageButton && !pageButton.disabled) { search(Number(pageButton.dataset.page)).catch(showError); return; }
    const evidence = event.target.closest("[data-show-evidence]"); if (evidence) { showEvidence(evidence.closest("[data-cluster-id]")).catch(showError); return; }
    const authority = event.target.closest("[data-show-authority]"); if (authority) { loadAuthorityCandidates(authority.closest("[data-cluster-id]")).catch(showError); return; }
    const decisionButton = event.target.closest("[data-authority-decision]");
    if (decisionButton) {
      const candidate = decisionButton.closest("[data-authority-candidate]");
      authorityReview[candidate.dataset.authorityCandidate] = { decision: decisionButton.dataset.authorityDecision, decidedAt: new Date().toISOString(), sourceAuthoritySha256: authoritySourceAuthoritySha256, sourceNarratorIndexSha256: authoritySourceNarratorIndexSha256 };
      localStorage.setItem(AUTHORITY_REVIEW_KEY, JSON.stringify(authorityReview));
      candidate.querySelector("[data-review-state]").textContent = decisionButton.dataset.authorityDecision;
    }
  });
  $("#export-authority-review")?.addEventListener("click", exportAuthorityReview);
} catch (error) { showError(error); }
function showError(error) { $("#narrator-results").innerHTML = `<div class="fatal"><h2>Narrator evidence could not load</h2><p>${escapeHtml(error.message)}</p><button onclick="location.reload()">Retry</button></div>`; }
