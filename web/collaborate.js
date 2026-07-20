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

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
  const body = {
    format: "unified-hadith-collaboration-snapshot-0.1",
    projectName: state.projectName,
    reviewer: state.reviewer,
    tradition: state.tradition,
    exportedAt: new Date().toISOString(),
    history: state.history,
    note: "Local snapshot only. Signature is a content hash, not a cryptographic identity proof."
  };
  const json = `${JSON.stringify(body, null, 2)}\n`;
  body.contentSha256 = await sha256Hex(json);
  const signed = `${JSON.stringify(body, null, 2)}\n`;
  const blob = new Blob([signed], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "unified-hadith-collaboration-snapshot.json";
  a.click();
  URL.revokeObjectURL(url);
});

render();
