// Tests for the signed-snapshot exchange protocol in
// web/collaborate-crypto.mjs: Ed25519 keygen/sign/verify round-trip, and
// attributed-disagreement detection on a synthetic two-reviewer fixture.
// Uses the same plain check()/accumulator pattern as the other test files.
import {
  canonicalJson,
  generateSigningKeypair,
  signSnapshotPayload,
  verifySnapshotSignature,
  findAttributedDisagreements
} from "../web/collaborate-crypto.mjs";

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

// --- canonicalization ---
check(
  "canonical JSON is stable under key reordering",
  canonicalJson({ b: 1, a: 2 }) === canonicalJson({ a: 2, b: 1 })
);
check(
  "canonical JSON preserves array order",
  canonicalJson({ list: [3, 1, 2] }) === JSON.stringify({ list: [3, 1, 2] })
);

// --- keypair generation ---
const keypairA = await generateSigningKeypair();
const keypairB = await generateSigningKeypair();
check("generated keypair has a public JWK", keypairA.publicKeyJwk?.kty === "OKP" && keypairA.publicKeyJwk?.crv === "Ed25519");
check("generated keypair has a private JWK with the signing component", typeof keypairA.privateKeyJwk?.d === "string");
check("two generated keypairs are distinct", keypairA.publicKeyJwk.x !== keypairB.publicKeyJwk.x);

// --- sign / verify round-trip ---
const payload = {
  format: "unified-hadith-collaboration-snapshot-0.2",
  projectName: "Bukhari intentions review",
  reviewer: "editor A",
  history: [{ subjectId: "uh:authority-candidate:1", decision: "accepted", reviewState: "editor-reviewed", at: "2026-01-01T00:00:00.000Z" }]
};
const { canonical, signature } = await signSnapshotPayload(payload, keypairA.privateKeyJwk);
check("signing returns a base64 signature", typeof signature === "string" && signature.length > 0);
check("signing returns the exact canonical bytes that were signed", canonical === canonicalJson(payload));

const validVerify = await verifySnapshotSignature(payload, signature, keypairA.publicKeyJwk);
check("signature verifies against the matching public key", validVerify === true);

const wrongKeyVerify = await verifySnapshotSignature(payload, signature, keypairB.publicKeyJwk);
check("signature fails verification against a different reviewer's public key", wrongKeyVerify === false);

const tamperedPayload = { ...payload, history: [{ ...payload.history[0], decision: "rejected" }] };
const tamperedVerify = await verifySnapshotSignature(tamperedPayload, signature, keypairA.publicKeyJwk);
check("signature fails verification if the payload was tampered with after signing", tamperedVerify === false);

const garbageVerify = await verifySnapshotSignature(payload, "not-base64-!!!", keypairA.publicKeyJwk);
check("verification of a malformed signature returns false instead of throwing", garbageVerify === false);

// --- synthetic two-reviewer fixture for conflict detection ---
const localHistory = [
  { subjectId: "uh:authority-candidate:1", decision: "accepted", reviewState: "editor-reviewed", reviewer: "editor A", at: "2026-01-05T00:00:00.000Z" },
  { subjectId: "uh:authority-candidate:2", decision: "rejected", reviewState: "editor-reviewed", reviewer: "editor A", at: "2026-01-05T00:00:00.000Z" },
  { subjectId: "uh:authority-candidate:3", decision: "needs-evidence", reviewState: "disputed", reviewer: "editor A", at: "2026-01-05T00:00:00.000Z", confidence: "low" }
];
const importedHistory = [
  // agrees with local -> no disagreement expected
  { subjectId: "uh:authority-candidate:1", decision: "accepted", reviewState: "editor-reviewed", reviewer: "editor B", at: "2026-01-06T00:00:00.000Z" },
  // disagrees on decision -> expected disagreement
  { subjectId: "uh:authority-candidate:2", decision: "accepted", reviewState: "editor-reviewed", reviewer: "editor B", at: "2026-01-06T00:00:00.000Z" },
  // disagrees on confidence only -> expected disagreement
  { subjectId: "uh:authority-candidate:3", decision: "needs-evidence", reviewState: "disputed", reviewer: "editor B", at: "2026-01-06T00:00:00.000Z", confidence: "high" },
  // no local judgment exists for this subject -> not a disagreement, just new info
  { subjectId: "uh:authority-candidate:4", decision: "accepted", reviewState: "editor-reviewed", reviewer: "editor B", at: "2026-01-06T00:00:00.000Z" }
];

const disagreements = findAttributedDisagreements(localHistory, importedHistory, { reviewer: "editor B" });
check("conflict detection finds exactly the two genuinely disagreeing subjects", disagreements.length === 2);
check(
  "conflict detection does not flag a subject the imported reviewer never addressed",
  !disagreements.some((d) => d.subjectId === "uh:authority-candidate:4")
);
check(
  "conflict detection does not flag a subject both reviewers agree on",
  !disagreements.some((d) => d.subjectId === "uh:authority-candidate:1")
);
const decisionConflict = disagreements.find((d) => d.subjectId === "uh:authority-candidate:2");
check(
  "decision disagreement is attributed to both reviewers by name",
  decisionConflict?.local.reviewer === "editor A" && decisionConflict?.imported.reviewer === "editor B"
);
check("decision disagreement flags the decision field specifically", decisionConflict?.differs.decision === true && decisionConflict?.differs.reviewState === false);
const confidenceConflict = disagreements.find((d) => d.subjectId === "uh:authority-candidate:3");
check(
  "confidence-only disagreement is detected even when decision and reviewState match",
  confidenceConflict?.differs.confidence === true && confidenceConflict?.differs.decision === false && confidenceConflict?.differs.reviewState === false
);

// --- newest-local-entry wins when a subject has multiple local decisions ---
const localHistoryWithRevision = [
  { subjectId: "uh:authority-candidate:5", decision: "rejected", reviewState: "editor-reviewed", reviewer: "editor A", at: "2026-01-01T00:00:00.000Z" },
  { subjectId: "uh:authority-candidate:5", decision: "accepted", reviewState: "editor-reviewed", reviewer: "editor A", at: "2026-01-10T00:00:00.000Z" }
];
const importedAgreesWithLatest = [
  { subjectId: "uh:authority-candidate:5", decision: "accepted", reviewState: "editor-reviewed", reviewer: "editor B", at: "2026-01-06T00:00:00.000Z" }
];
const revisionDisagreements = findAttributedDisagreements(localHistoryWithRevision, importedAgreesWithLatest, { reviewer: "editor B" });
check(
  "disagreement comparison uses the most recent local decision, not an earlier superseded one",
  revisionDisagreements.length === 0
);

// --- never silently merges: the function is pure and returns data only ---
check(
  "disagreement detection never mutates the local history it was given",
  JSON.stringify(localHistory) === JSON.stringify([
    { subjectId: "uh:authority-candidate:1", decision: "accepted", reviewState: "editor-reviewed", reviewer: "editor A", at: "2026-01-05T00:00:00.000Z" },
    { subjectId: "uh:authority-candidate:2", decision: "rejected", reviewState: "editor-reviewed", reviewer: "editor A", at: "2026-01-05T00:00:00.000Z" },
    { subjectId: "uh:authority-candidate:3", decision: "needs-evidence", reviewState: "disputed", reviewer: "editor A", at: "2026-01-05T00:00:00.000Z", confidence: "low" }
  ])
);

let failures = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) failures += 1;
}
if (failures) process.exit(1);
console.log(`${checks.length}/${checks.length} collaborate-crypto tests passed.`);
