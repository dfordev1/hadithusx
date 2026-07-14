const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const badge = (state) => `<span class="badge ${escapeHtml(state)}">${escapeHtml(state)}</span>`;
const REVIEW_KEY = "unified-hadith-review-v1";

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

async function start() {
  const [imported, graph, identities, manifest] = await Promise.all([
    loadJson("imported-witnesses.json"), loadJson("imported-graph.json"),
    loadJson("identity-suggestions.json"), loadJson("build-manifest.json")
  ]);
  let query = "";
  let currentView = location.hash.slice(1) || "dashboard";
  let review = JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}");
  const reports = imported.reports;
  const mentionCount = reports.reduce((sum, report) => sum + report.segmentation.narratorMentionCandidates.length, 0);
  const decisionCount = () => Object.keys(review).length;
  const reportMatches = (report) => !query || [report.sourceReportNumber, report.normalizedReading, ...report.segmentation.narratorMentionCandidates.map((item) => item.surface)].join(" ").toLowerCase().includes(query);
  const suggestionMatches = (item) => !query || [item.leftSurface, item.rightSurface, item.reason, item.confidence].join(" ").toLowerCase().includes(query);

  function saveReview() {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(review));
  }

  function renderMetrics() {
    $("#metrics").innerHTML = [
      [reports.length, "source witnesses"], [reports.length, "isnad routes"], [mentionCount, "mention candidates"],
      [graph.edges.length, "evidence edges"], [identities.suggestions.length, "identity suggestions"], [decisionCount(), "review decisions"]
    ].map(([value, label]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join("");
  }

  function dashboard() {
    const reviewed = decisionCount();
    const percent = identities.suggestions.length ? Math.round(reviewed / identities.suggestions.length * 100) : 0;
    return `<div class="hero-grid"><article class="card overview-card"><p class="eyebrow">CURRENT DATASET</p><h2>Hadith of intentions: six Bukhari witnesses</h2><p class="large-copy">The application preserves each occurrence separately, compares its wording, and keeps narrator identity proposals reversible.</p><div class="progress" aria-label="Identity review ${percent}% complete"><span style="width:${percent}%"></span></div><p>${reviewed} of ${identities.suggestions.length} identity suggestions reviewed.</p><button class="primary-action" data-go="witnesses">Explore witnesses</button></article><article class="card"><h2>Safety model</h2><ul class="check-list"><li>Source commit and checksum locked</li><li>Raw and normalized readings separated</li><li>Machine boundaries visibly labelled</li><li>No automatic person merging</li><li>No automated authenticity grading</li></ul></article></div><div class="grid"><article class="card"><h3>Source</h3><p>${escapeHtml(imported.source.version)}</p><div class="id">${escapeHtml(imported.source.commit)}</div></article><article class="card"><h3>Build</h3><p>Standard ${escapeHtml(manifest.standardVersion)}</p><p>${manifest.generatedFiles.length} generated release assets</p></article><article class="card"><h3>Next review task</h3><p>Resolve narrator mentions using cited biographical evidence, beginning with high-confidence surface matches.</p><button data-go="narrators">Open review queue</button></article></div>`;
  }

  function renderCandidateRoute(report) {
    return `<div class="candidate-chain" aria-label="Narrator mention candidates">${report.segmentation.narratorMentionCandidates.map((mention, index) => `${index ? '<span class="candidate-arrow" aria-hidden="true">←</span>' : ""}<div class="candidate-node"><span class="term">${escapeHtml(mention.transmissionTerm)}</span><strong lang="ar" dir="rtl">${escapeHtml(mention.surface)}</strong>${badge(mention.reviewState)}</div>`).join("")}</div>`;
  }

  function witnesses() {
    const visible = reports.filter(reportMatches);
    return `<div class="section-heading"><div><p class="eyebrow">SOURCE READER</p><h2>Independent witnesses</h2></div><p>${visible.length} of ${reports.length} shown</p></div>${visible.length ? `<div class="grid">${visible.map((report) => `<article class="card witness-card"><div>${badge(report.reviewState)} ${badge(report.segmentation.reviewState)}</div><h3>Bukhari ${report.sourceReportNumber}</h3><div class="id">${escapeHtml(report.stagingId)}</div><h4>Isnad</h4>${renderCandidateRoute(report)}<h4>Matn</h4><p class="arabic" lang="ar">${escapeHtml(report.segmentation.matnCandidate)}</p><details><summary>Source and transcription evidence</summary><p class="arabic source-block" lang="ar">${escapeHtml(report.rawOpenITI)}</p><p class="id">Boundary method: ${escapeHtml(report.segmentation.method)}</p></details></article>`).join("")}</div>` : emptyState()}`;
  }

  function variants() {
    const visible = reports.filter(reportMatches);
    return `<article class="card"><div class="section-heading"><div><p class="eyebrow">PARALLEL TEXT</p><h2>Matn variants</h2></div><p>${visible.length} witnesses</p></div><p>Wording remains attached to its source occurrence; this view does not create a synthetic master text.</p>${visible.map((report) => `<div class="variant-row"><div><strong>Bukhari ${report.sourceReportNumber}</strong><div class="id">${escapeHtml(report.stagingId)}</div>${badge(report.segmentation.reviewState)}</div><p class="arabic" lang="ar">${escapeHtml(report.segmentation.matnCandidate)}</p></div>`).join("")}</article>`;
  }

  function graphView() {
    const width = 1320, rowHeight = 112, height = 90 + reports.length * rowHeight;
    const grouped = reports.map((report) => ({ report, nodes: graph.nodes.filter((node) => node.witness === report.stagingId).sort((a,b) => a.position - b.position) }));
    const positions = new Map();
    grouped.forEach(({ nodes }, row) => nodes.forEach((node, column) => positions.set(node.id, { x: 190 + column * 165, y: 70 + row * rowHeight })));
    const lines = graph.edges.map((edge) => { const a = positions.get(edge.from), b = positions.get(edge.to); return `<line x1="${a.x + 62}" y1="${a.y}" x2="${b.x - 62}" y2="${b.y}"><title>${escapeHtml(edge.witness)} — evidence retained</title></line>`; }).join("");
    const labels = grouped.map(({ report }, row) => `<text class="route-label" x="15" y="${75 + row * rowHeight}">Bukhari ${report.sourceReportNumber}</text>`).join("");
    const nodes = graph.nodes.map((node) => { const point = positions.get(node.id); const short = node.label.length > 20 ? `${node.label.slice(0,20)}…` : node.label; return `<g><rect x="${point.x - 62}" y="${point.y - 29}" width="124" height="58" rx="9"><title>${escapeHtml(node.label)} — ${escapeHtml(node.term)} — identity unresolved</title></rect><text x="${point.x}" y="${point.y - 3}" direction="rtl">${escapeHtml(short)}</text><text class="term-label" x="${point.x}" y="${point.y + 16}">${escapeHtml(node.term)}</text></g>`; }).join("");
    return `<article class="card"><div class="section-heading"><div><p class="eyebrow">TRANSMISSION</p><h2>Evidence-linked routes</h2></div>${badge("identity-unresolved")}</div><p>Each box is an occurrence-specific mention. Similar names are not merged.</p><div class="graph-scroll"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Six Bukhari transmission routes">${lines}${labels}${nodes}</svg></div><p class="warning">The graph represents encoded source statements, not an independent authenticity judgment.</p></article>`;
  }

  function narrators() {
    const visible = identities.suggestions.filter(suggestionMatches);
    return `<div class="section-heading"><div><p class="eyebrow">REVIEW QUEUE</p><h2>Narrator identity candidates</h2></div><p>${visible.length} of ${identities.suggestions.length} shown</p></div><div class="review-filters"><button data-confidence="all">All</button><button data-confidence="probable">Probable</button><button data-confidence="possible">Possible</button><button data-confidence="uncertain">Uncertain</button><button data-confidence="pending">Pending only</button></div><div id="identity-list" class="grid">${visible.map(identityCard).join("")}</div>`;
  }

  function identityCard(item) {
    const decision = review[item.id];
    return `<article class="card identity-suggestion" data-confidence-card="${escapeHtml(item.confidence)}" data-reviewed="${decision ? "yes" : "no"}"><div>${badge(item.confidence)} ${decision ? badge(decision.decision) : badge("pending")}</div><div class="identity-pair"><strong lang="ar" dir="rtl">${escapeHtml(item.leftSurface)}</strong><span>⇄</span><strong lang="ar" dir="rtl">${escapeHtml(item.rightSurface)}</strong></div><p>${escapeHtml(item.reason)}</p><div class="review-actions" data-suggestion="${escapeHtml(item.id)}"><button data-decision="accept">Accept candidate</button><button data-decision="reject">Reject</button><button data-decision="needs-evidence">Needs evidence</button></div><div class="id">Score ${item.score} · ${escapeHtml(item.method)}<br>${escapeHtml(item.id)}</div></article>`;
  }

  function provenance() {
    return `<div class="grid"><article class="card"><p class="eyebrow">SOURCE LOCK</p><h2>${escapeHtml(imported.source.work)}</h2><dl><dt>Version</dt><dd>${escapeHtml(imported.source.version)}</dd><dt>Repository</dt><dd><a href="${escapeHtml(imported.source.repository)}">${escapeHtml(imported.source.repository)}</a></dd><dt>Commit</dt><dd class="id">${escapeHtml(imported.source.commit)}</dd><dt>Source SHA-256</dt><dd class="id">${escapeHtml(imported.source.sourceSha256)}</dd><dt>Acquisition</dt><dd>${escapeHtml(imported.source.acquisition)}</dd></dl></article><article class="card"><p class="eyebrow">REPRODUCIBILITY</p><h2>Build manifest</h2><dl><dt>Standard</dt><dd>${escapeHtml(manifest.standardVersion)}</dd><dt>Corpus SHA-256</dt><dd class="id">${escapeHtml(manifest.sourceSha256)}</dd><dt>Generated assets</dt><dd>${manifest.generatedFiles.map(escapeHtml).join("<br>")}</dd></dl></article><article class="card"><p class="eyebrow">BOUNDARIES</p><h2>What this release does not claim</h2><ul class="check-list caution"><li>No narrator identity has been scholar-verified</li><li>No jarh wa-ta‘dil judgment has been imported</li><li>No chain has been graded automatically</li><li>No authenticity conclusion is produced</li></ul></article></div>`;
  }

  function emptyState() { return `<div class="empty"><h3>No matching records</h3><p>Change or clear the search query.</p></div>`; }
  const views = { dashboard, witnesses, graph: graphView, variants, narrators, provenance };

  function render() {
    if (!views[currentView]) currentView = "dashboard";
    renderMetrics();
    $("#content").innerHTML = views[currentView]();
    document.querySelectorAll("nav button").forEach((button) => {
      const active = button.dataset.view === currentView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  document.querySelector("nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]"); if (!button) return;
    currentView = button.dataset.view; location.hash = currentView; render();
  });
  $("#content").addEventListener("click", (event) => {
    const go = event.target.closest("[data-go]");
    if (go) { currentView = go.dataset.go; location.hash = currentView; render(); return; }
    const decisionButton = event.target.closest("[data-decision]");
    if (decisionButton) {
      const id = decisionButton.closest("[data-suggestion]").dataset.suggestion;
      review[id] = { decision: decisionButton.dataset.decision, decidedAt: new Date().toISOString(), sourceCommit: imported.source.commit };
      saveReview(); render(); return;
    }
    const filter = event.target.closest("[data-confidence]");
    if (filter) {
      const value = filter.dataset.confidence;
      document.querySelectorAll("[data-confidence-card]").forEach((card) => card.hidden = value !== "all" && (value === "pending" ? card.dataset.reviewed === "yes" : card.dataset.confidenceCard !== value));
    }
  });
  $("#global-search").addEventListener("input", (event) => { query = event.target.value.trim().toLowerCase(); render(); });
  $("#export-review").addEventListener("click", () => {
    const payload = { format: "unified-hadith-review-0.1", exportedAt: new Date().toISOString(), sourceCommit: imported.source.commit, decisions: review };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "unified-hadith-review.json" });
    link.click(); URL.revokeObjectURL(url);
  });
  addEventListener("hashchange", () => { currentView = location.hash.slice(1) || "dashboard"; render(); });
  render();
}

start().catch((error) => {
  console.error(error);
  $("#content").innerHTML = `<div class="fatal"><h2>The workbench could not load</h2><p>${escapeHtml(error.message)}</p><button onclick="location.reload()">Retry</button></div>`;
});
