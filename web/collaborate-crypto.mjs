// Pure logic for the signed-snapshot exchange protocol described in
// docs/NEXT.md / docs/DONE.md. No DOM access here so this module can be
// imported unchanged from the browser (web/collaborate.js) and from plain
// Node tests (tests/collaborate-crypto-tests.mjs). Relies only on the
// WebCrypto API (globalThis.crypto.subtle), which both environments provide.
//
// Design note: a name/identity in an imported snapshot is never merged into
// local state automatically. verifySignedSnapshot only tells you the bytes
// were signed by the holder of a given (unauthenticated, self-asserted)
// keypair -- it is proof of authorship-continuity between exports from the
// same browser, not proof of a real-world scholarly identity. That caveat is
// carried into the UI copy in web/collaborate.html/js.

const SNAPSHOT_ALG = { name: "Ed25519" };

function base64FromBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
}

function bytesFromBase64(b64) {
  if (typeof atob === "function") {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

// Deterministic JSON: sorts object keys recursively so the exact same
// logical payload always signs/hashes to the exact same bytes, independent
// of property insertion order. Mirrors the canonicalization used for the
// XML round-trip tests elsewhere in this repo.
export function canonicalJson(value) {
  const canonical = (v) => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.keys(v).sort().map((key) => [key, canonical(v[key])]));
    }
    return v;
  };
  return JSON.stringify(canonical(value));
}

// Generates a new Ed25519 keypair for this browser/reviewer. The private
// key never leaves collaborate.js's localStorage-backed state; only the
// public key JWK is embedded in exported snapshots.
export async function generateSigningKeypair() {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(SNAPSHOT_ALG, true, ["sign", "verify"]);
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", privateKey);
  return { publicKeyJwk, privateKeyJwk };
}

async function importPrivateKey(privateKeyJwk) {
  return crypto.subtle.importKey("jwk", privateKeyJwk, SNAPSHOT_ALG, false, ["sign"]);
}

async function importPublicKey(publicKeyJwk) {
  return crypto.subtle.importKey("jwk", { ...publicKeyJwk, key_ops: ["verify"] }, SNAPSHOT_ALG, true, ["verify"]);
}

// Signs `payload` (a plain JSON-serializable object) with the given private
// key JWK. Returns the exact canonical JSON string that was signed plus a
// base64 detached signature, so the caller can bundle both into the export
// file without the signature covering itself.
export async function signSnapshotPayload(payload, privateKeyJwk) {
  const canonical = canonicalJson(payload);
  const key = await importPrivateKey(privateKeyJwk);
  const signatureBytes = await crypto.subtle.sign(SNAPSHOT_ALG, key, new TextEncoder().encode(canonical));
  return { canonical, signature: base64FromBytes(new Uint8Array(signatureBytes)) };
}

// Verifies a detached Ed25519 signature over `payload` against `publicKeyJwk`.
// Returns false (never throws) on any malformed input so callers can safely
// surface "signature invalid" instead of crashing on a hostile/garbled file.
export async function verifySnapshotSignature(payload, signatureBase64, publicKeyJwk) {
  try {
    const canonical = canonicalJson(payload);
    const key = await importPublicKey(publicKeyJwk);
    const signatureBytes = bytesFromBase64(signatureBase64);
    return await crypto.subtle.verify(SNAPSHOT_ALG, key, signatureBytes, new TextEncoder().encode(canonical));
  } catch {
    return false;
  }
}

// Compares an imported snapshot's history against the local project's own
// history for the same subjectId and reports every case where the imported
// reviewer's decision/reviewState/confidence disagrees with the local
// judgment. Never merges anything -- this only produces a labeled,
// attributed list for a human to look at. `localHistory` and
// `importedHistory` are arrays of the same shape collaborate.js stores
// (subjectId, decision, reviewState, confidence?, reviewer, at, ...).
//
// Only the most recent local decision per subjectId is compared, since that
// is the local project's current judgment; every imported decision for a
// subject already covered locally is checked against it.
export function findAttributedDisagreements(localHistory, importedHistory, importedMeta = {}) {
  const latestLocalBySubject = new Map();
  for (const entry of localHistory) {
    if (!entry || typeof entry.subjectId !== "string") continue;
    const existing = latestLocalBySubject.get(entry.subjectId);
    if (!existing || new Date(entry.at) > new Date(existing.at)) {
      latestLocalBySubject.set(entry.subjectId, entry);
    }
  }

  const disagreements = [];
  for (const imported of importedHistory || []) {
    if (!imported || typeof imported.subjectId !== "string") continue;
    const local = latestLocalBySubject.get(imported.subjectId);
    if (!local) continue; // no local judgment to disagree with
    const decisionDiffers = local.decision !== imported.decision;
    const reviewStateDiffers = (local.reviewState || null) !== (imported.reviewState || null);
    const confidenceDiffers =
      "confidence" in local || "confidence" in imported
        ? (local.confidence ?? null) !== (imported.confidence ?? null)
        : false;
    if (!decisionDiffers && !reviewStateDiffers && !confidenceDiffers) continue;
    disagreements.push({
      subjectId: imported.subjectId,
      local: {
        reviewer: local.reviewer || "anonymous",
        decision: local.decision,
        reviewState: local.reviewState || null,
        confidence: local.confidence ?? null,
        at: local.at
      },
      imported: {
        reviewer: imported.reviewer || importedMeta.reviewer || "anonymous",
        decision: imported.decision,
        reviewState: imported.reviewState || null,
        confidence: imported.confidence ?? null,
        at: imported.at
      },
      differs: { decision: decisionDiffers, reviewState: reviewStateDiffers, confidence: confidenceDiffers }
    });
  }
  return disagreements;
}
