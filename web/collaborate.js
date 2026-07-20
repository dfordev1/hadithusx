import { loadOrCreateKeypair, signSnapshotPayload, verifySnapshotSignature, findAttributedDisagreements } from "./collaborate-crypto-browser.mjs";

const STORAGE_KEY = "unified-hadith-collaboration-v1";

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {
      projectName: "",
      reviewer: "",
      tradition: "",
      history: []
    };
  } catch {
    return { projectName: "", reviewer: "", tradition: "", history: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  const state = loadState();
  document.getElementById("project-name").value = state.projectName;
  document.getElementById("reviewer").value = state.reviewer;
  document.getElementById("tradition").value = state.tradition;
  const root = document.getElementById("history");
  if (!state.history.length) {
    root.innerHTML = "<p class=\"muted\">No decisions yet.</p>";
    return;
  }
  root.innerHTML = state.history
    .map(
      (entry) => `<article class="card">
      <p><strong>${escapeHtml(entry.decision)}</strong> · <code>${escapeHtml(entry.subjectId)}</code></p>
      <p class="muted">${escapeHtml(entry.at)} · ${escapeHtml(entry.reviewer || "anonymous")}${entry.tradition ? ` · ${escapeHtml(entry.tradition)}` : ""}</p>
      <p>${escapeHtml(entry.note || "")}</p>
    </article>`
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderDisagreements(disagreements, importedMeta) {
  const root = document.getElementById("disagreements");
  if (!root) return;
  if (!disagreements.length) {
    root.innerHTML = `<p class="muted">Imported snapshot from ${escapeHtml(importedMeta.reviewer || "unknown reviewer")} signature-verified. No attributed disagreements found against this project's current judgments.</p>`;
    return;
  }
  root.innerHTML = `<p class="muted">Signature-verified import from ${escapeHtml(importedMeta.reviewer || "unknown reviewer")}. These are attributed disagreements only -- nothing was merged into local history.</p>` +
    disagreements
      .map(
        (d) => `<article class="card">
        <p><strong><code>${escapeHtml(d.subjectId)}</code></strong></p>
        <p class="muted">Local (${escapeHtml(d.local.reviewer)}, ${escapeHtml(d.local.at)}): ${escapeHtml(d.local.decision)} / ${escapeHtml(d.local.reviewState || "-")}${d.local.confidence != null ? ` / confidence ${escapeHtml(String(d.local.confidence))}` : ""}</p>
        <p class="muted">Imported (${escapeHtml(d.imported.reviewer)}, ${escapeHtml(d.imported.at)}): ${escapeHtml(d.imported.decision)} / ${escapeHtml(d.imported.reviewState || "-")}${d.imported.confidence != null ? ` / confidence ${escapeHtml(String(d.imported.confidence))}` : ""}</p>
      </article>`
      )
      .join("");
}

document.getElementById("save-project").addEventListener("click", () => {
  const state = loadState();
  state.projectName = document.getElementById("project-name").value.trim();
  state.reviewer = document.getElementById("reviewer").value.trim();
  state.tradition = document.getElementById("tradition").value.trim();
  saveState(state);
  render();
});

document.getElementById("add-decision").addEventListener("click", () => {
  const state = loadState();
  const subjectId = document.getElementById("subject-id").value.trim();
  if (!subjectId) return;
  state.history.unshift({
    id: `local-decision:${Date.now()}`,
    subjectId,
    decision: document.getElementById("decision").value,
    note: document.getElementById("note").value.trim(),
    reviewer: state.reviewer || document.getElementById("reviewer").value.trim(),
    tradition: state.tradition || document.getElementById("tradition").value.trim(),
    at: new Date().toISOString(),
    reviewState: document.getElementById("decision").value === "disputed" ? "disputed" : "editor-reviewed"
  });
  saveState(state);
  document.getElementById("note").value = "";
  render();
});

document.getElementById("clear-history").addEventListener("click", () => {
  if (!confirm("Clear local collaboration history on this browser?")) return;
  const state = loadState();
  state.history = [];
  saveState(state);
  render();
});

document.getElementById("export-snapshot").addEventListener("click", async () => {
  const state = loadState();
  const keypair = await loadOrCreateKeypair();
  const body = {
    format: "unified-hadith-collaboration-snapshot-0.2",
    projectName: state.projectName,
    reviewer: state.reviewer,
    tradition: state.tradition,
    exportedAt: new Date().toISOString(),
    history: state.history,
    publicKeyJwk: keypair.publicKeyJwk,
    note: "Local snapshot only. Signed with an Ed25519 keypair generated in this browser (WebCrypto). This proves the export came from the holder of that key across exports -- it is not a verified real-world identity proof; there is no accounts server."
  };
  const { signature } = await signSnapshotPayload(body, keypair.privateKeyJwk);
  const signed = { ...body, signatureAlgorithm: "Ed25519", signature };
  const blob = new Blob([`${JSON.stringify(signed, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "unified-hadith-collaboration-snapshot.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import-snapshot")?.addEventListener("change", async (event) => {
  const status = document.getElementById("import-status");
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  let imported;
  try {
    imported = JSON.parse(await file.text());
  } catch {
    if (status) status.textContent = "Import failed: file is not valid JSON.";
    return;
  }
  const { signature, ...payload } = imported;
  if (!signature || !imported.publicKeyJwk) {
    if (status) status.textContent = "Import failed: file has no signature or public key to verify.";
    return;
  }
  const verified = await verifySnapshotSignature(payload, signature, imported.publicKeyJwk);
  if (!verified) {
    if (status) status.textContent = "Import rejected: signature verification failed. This file may be corrupted or tampered with.";
    renderDisagreements([], {});
    return;
  }
  const state = loadState();
  const disagreements = findAttributedDisagreements(state.history, imported.history || [], { reviewer: imported.reviewer });
  if (status) {
    status.textContent = `Signature verified for import from ${imported.reviewer || "unknown reviewer"}. Found ${disagreements.length} attributed disagreement(s). Nothing was merged automatically.`;
  }
  renderDisagreements(disagreements, imported);
});

render();
