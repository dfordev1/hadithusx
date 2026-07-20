// Pure, dependency-free functions for narrator-authority candidate matching
// and chronology/broken-link warning detection (docs/NEXT.md Phase 1).
//
// Design constraints these functions must uphold, per
// spec/NARRATOR_AUTHORITY.md and docs/GOAL.md:
//   - No score performs an automatic merge. Every candidate is
//     `reviewState: "machine-suggested"` with `acceptedIdentity: null`.
//   - Chronology and broken-link checks may only produce warnings. They
//     never reject a source statement, grade a chain, or mutate an
//     assertion's reviewState.

export const normalizeArabicSurface = (value) =>
  value
    .normalize("NFC")
    .replace(/[ًٌٍَُِّْـ]/gu, "")
    .replace(/[إأآٱ]/gu, "ا")
    .replace(/[ىی]/gu, "ي")
    .replace(/[ؤئ]/gu, "ء")
    .replace(/ة/gu, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const NAME_FORM_TYPES = new Set(["preferred", "ism", "kunya", "nasab", "nisba", "laqab", "variant", "transliteration"]);

/**
 * Score candidate identity links between narrator-mention surface clusters
 * (data/staging/openiti-narrator-mentions.json.gz `clusters`) and authority
 * persons (a narrator-authority document's `persons`). Every name form on
 * every person is compared against every cluster's normalized surface.
 *
 * Returns an array of candidates, sorted by descending score. Nothing here
 * writes to `cluster.identity` or resolves anything automatically.
 */
export function matchNarratorAuthorityCandidates(persons, clusters) {
  const candidates = [];
  for (const person of persons) {
    for (const nameForm of person.nameForms) {
      if (!NAME_FORM_TYPES.has(nameForm.type)) continue;
      const normalizedName = normalizeArabicSurface(nameForm.text);
      if (!normalizedName) continue;
      const nameTokens = normalizedName.split(" ");
      for (const cluster of clusters) {
        const clusterTokens = cluster.normalizedSurface.split(" ");
        let score = 0;
        let reason = "";
        if (cluster.normalizedSurface === normalizedName) {
          score = 1;
          reason = "exact normalized surface match";
        } else {
          const [shortTokens, longTokens] =
            nameTokens.length <= clusterTokens.length ? [nameTokens, clusterTokens] : [clusterTokens, nameTokens];
          const contained = shortTokens.every((token) => longTokens.includes(token));
          if (contained && shortTokens.length >= 2) {
            score = 0.85;
            reason = "multi-token name contained in the other form";
          } else if (contained && shortTokens.length === 1) {
            score = 0.4;
            reason = "single-token name match; highly ambiguous without chain context";
          }
        }
        if (!score) continue;
        // Content-derived id: stable across regenerations as long as the
        // (person, nameForm type, cluster) triple stays the same, unlike a
        // sort-position index which shifts whenever persons/clusters data
        // changes and would silently reattach a stored human review
        // decision (keyed by this id in web/narrators.js localStorage) to
        // an unrelated candidate. See docs/DONE.md for the fix history.
        candidates.push({
          id: `uh:authority-candidate:${person.id}:${nameForm.type}:${cluster.id}`,
          person: person.id,
          personNameForm: nameForm.type,
          cluster: cluster.id,
          clusterOccurrenceCount: cluster.occurrenceCount,
          score,
          confidence: score === 1 ? "probable" : score >= 0.85 ? "possible" : "uncertain",
          reason,
          method: "deterministic normalized Arabic surface comparison 0.1",
          reviewState: "machine-suggested",
          acceptedIdentity: null
        });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.person.localeCompare(b.person) || a.cluster.localeCompare(b.cluster));
  return candidates;
}

const parseFixtureYear = (value) => {
  const match = /-?\d+/.exec(value ?? "");
  return match ? Number.parseInt(match[0], 10) : null;
};

/**
 * Detect impossible chronology (a claimed teacher/student relationship
 * where the student's recorded birth postdates the teacher's recorded
 * death) and broken links (a teacher/student assertion whose value does
 * not resolve to any known person id). Every result is a warning: it
 * carries no automatic ruling and does not touch reviewState on the
 * underlying assertion.
 */
export function detectChronologyWarnings(persons, assertions) {
  const personIds = new Set(persons.map((person) => person.id));
  const deathYear = new Map();
  const birthYear = new Map();
  for (const assertion of assertions) {
    if (assertion.predicate === "death") {
      const year = parseFixtureYear(assertion.value);
      if (year !== null) deathYear.set(assertion.subject, year);
    }
    if (assertion.predicate === "birth") {
      const year = parseFixtureYear(assertion.value);
      if (year !== null) birthYear.set(assertion.subject, year);
    }
  }

  const warnings = [];
  for (const assertion of assertions) {
    if (assertion.predicate !== "teacher" && assertion.predicate !== "student") continue;
    const relatedId = assertion.value;
    if (!personIds.has(relatedId)) {
      warnings.push({
        type: "broken-link",
        assertion: assertion.id,
        subject: assertion.subject,
        detail: `${assertion.predicate} assertion references unresolved person "${relatedId}"`
      });
      continue;
    }
    // Normalize direction: teacherId taught studentId.
    const teacherId = assertion.predicate === "teacher" ? relatedId : assertion.subject;
    const studentId = assertion.predicate === "teacher" ? assertion.subject : relatedId;
    const teacherDeath = deathYear.get(teacherId);
    const studentBirth = birthYear.get(studentId);
    if (teacherDeath !== undefined && studentBirth !== undefined && studentBirth > teacherDeath) {
      warnings.push({
        type: "impossible-chronology",
        assertion: assertion.id,
        subject: assertion.subject,
        teacher: teacherId,
        student: studentId,
        detail: `claimed teacher ${teacherId} (death year ${teacherDeath}) predates student ${studentId}'s recorded birth year ${studentBirth}`
      });
    }
  }
  return warnings;
}
