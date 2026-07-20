// Thin browser-only wrapper around collaborate-crypto.mjs: adds the
// localStorage-backed keypair cache, which depends on a browser global and
// so is kept out of the pure logic module (that module is imported directly
// by the Node test suite, which has no localStorage).
import { generateSigningKeypair, signSnapshotPayload, verifySnapshotSignature, findAttributedDisagreements, canonicalJson } from "./collaborate-crypto.mjs";

const KEYPAIR_STORAGE_KEY = "unified-hadith-collaboration-keypair-v1";

// Ed25519 keypair used to sign this browser's exported snapshots. Generated
// once per browser and cached in localStorage; the private key never leaves
// this device. This is a self-asserted identity (there is no accounts
// server) -- a valid signature proves "the same key that signed export A
// also signed export B", not a verified real-world identity.
export async function loadOrCreateKeypair() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEYPAIR_STORAGE_KEY) || "null");
    if (stored?.publicKeyJwk && stored?.privateKeyJwk) return stored;
  } catch {
    // fall through to generating a fresh keypair
  }
  const keypair = await generateSigningKeypair();
  localStorage.setItem(KEYPAIR_STORAGE_KEY, JSON.stringify(keypair));
  return keypair;
}

export { signSnapshotPayload, verifySnapshotSignature, findAttributedDisagreements, canonicalJson };
