#!/usr/bin/env node
// Builds a licensed, non-biographical narrator-authority document from
// attested OpenITI surface forms already present in the corpus mention index.
//
// Honest scope:
// - Persons here are controlled vocabulary entries for attested name surfaces.
// - They are NOT encyclopedia biographies and do NOT claim birth/death/teachers
//   unless optionally enriched from Wikidata (CC0) below.
// - License inherits OpenITI CC BY-NC-SA 4.0 for corpus-derived surfaces.

import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { matchNarratorAuthorityCandidates, detectChronologyWarnings } from "../sdk/lib/narrator-authority.mjs";

const root = new URL("../", import.meta.url);
const minOccurrences = Number(process.argv[2] || 10);
const maxPersons = Number(process.argv[3] || 400);

const narratorBytes = await readFile(new URL("data/staging/openiti-narrator-mentions.json.gz", root));
const narrators = JSON.parse(gunzipSync(narratorBytes).toString("utf8"));
const clusters = [...narrators.clusters]
  .filter((cluster) => cluster.occurrenceCount >= minOccurrences)
  .sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.normalizedSurface.localeCompare(b.normalizedSurface))
  .slice(0, maxPersons);

const sourceId = "uh:source:openiti-attested-surfaces";
const persons = clusters.map((cluster, index) => {
  const n = String(index + 1).padStart(4, "0");
  const preferred = cluster.surfaceExamples?.[0] || cluster.normalizedSurface;
  return {
    id: `uh:person:attested-${n}`,
    preferredName: preferred,
    nameForms: [
      {
        text: preferred,
        type: "preferred",
        language: "ar",
        citation: {
          source: sourceId,
          locator: `cluster ${cluster.id}; occurrences=${cluster.occurrenceCount}`,
          quotation: preferred
        }
      },
      ...(preferred === cluster.normalizedSurface
        ? []
        : [
            {
              text: cluster.normalizedSurface,
              type: "variant",
              language: "ar",
              citation: {
                source: sourceId,
                locator: `cluster ${cluster.id} normalized`,
                quotation: cluster.normalizedSurface
              }
            }
          ])
    ],
    reviewState: "imported"
  };
});

// Optional CC0 Wikidata enrichment for a small curated Arabic label set.
const wikidataSeed = [
  { qid: "Q188831", arabic: "مالك بن أنس" },
  { qid: "Q193970", arabic: "أبو هريرة" },
  { qid: "Q188915", arabic: "عبد الله بن عمر" },
  { qid: "Q185356", arabic: "أنس بن مالك" },
  { qid: "Q297065", arabic: "سفيان الثوري" }
];

const assertions = [];
let wikidataAdded = 0;
try {
  const values = wikidataSeed.map((row) => `wd:${row.qid}`).join(" ");
  const query = `
SELECT ?person ?personLabel ?death WHERE {
  VALUES ?person { ${values} }
  OPTIONAL { ?person wdt:P570 ?death. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ar,en". }
}`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Accept: "application/sparql-results+json", "User-Agent": "UnifiedHadith/2.0 (research; CC0 Wikidata import)" } });
  if (response.ok) {
    const payload = await response.json();
    const byQid = new Map();
    for (const binding of payload.results?.bindings || []) {
      const qid = String(binding.person.value).split("/").pop();
      byQid.set(qid, binding);
    }
    const wdSourceId = "uh:source:wikidata-cc0";
    for (const seed of wikidataSeed) {
      const binding = byQid.get(seed.qid);
      if (!binding) continue;
      const label = binding.personLabel?.value || seed.arabic;
      const n = String(persons.length + 1).padStart(4, "0");
      const personId = `uh:person:wikidata-${seed.qid.toLowerCase()}`;
      persons.push({
        id: personId,
        preferredName: label,
        nameForms: [
          {
            text: label,
            type: "preferred",
            language: "ar",
            citation: {
              source: wdSourceId,
              locator: seed.qid,
              quotation: label
            }
          },
          {
            text: seed.arabic,
            type: "variant",
            language: "ar",
            citation: {
              source: wdSourceId,
              locator: `${seed.qid} seed Arabic`,
              quotation: seed.arabic
            }
          }
        ],
        reviewState: "imported"
      });
      if (binding.death?.value) {
        const year = binding.death.value.slice(0, 4);
        assertions.push({
          id: `uh:assertion:wikidata-${seed.qid.toLowerCase()}-death`,
          subject: personId,
          predicate: "death",
          value: year,
          assertedBy: "Wikidata CC0 import",
          citation: { source: wdSourceId, locator: `${seed.qid} P570`, quotation: binding.death.value },
          confidence: "possible",
          reviewState: "imported"
        });
      }
      wikidataAdded += 1;
      void n;
    }
  }
} catch {
  // Network optional: attested OpenITI surfaces still ship.
}

const authority = {
  authorityVersion: "0.1",
  status: "draft",
  sources: [
    {
      id: sourceId,
      title: "OpenITI attested narrator surfaces (five-collection index)",
      citation: "Derived from Unified Hadith openiti-narrator-mentions index built from pinned OpenITI editions.",
      license: "CC-BY-NC-SA-4.0",
      provenance: `Surfaces attested in OpenITI corpus mentions; minOccurrences=${minOccurrences}; maxPersons=${maxPersons}; sourceNarratorIndexSha256=${createHash("sha256").update(narratorBytes).digest("hex")}. Not a biographical encyclopedia.`
    },
    {
      id: "uh:source:wikidata-cc0",
      title: "Wikidata (selected death dates / labels)",
      citation: "Wikidata Query Service; selected items only.",
      license: "CC0-1.0",
      provenance: "Optional enrichment. Values remain reviewState=imported and must not be treated as scholar-verified."
    }
  ],
  persons,
  assertions
};

const authorityText = `${JSON.stringify(authority, null, 2)}\n`;
await writeFile(new URL("data/narrator-authority.openiti-attested.json", root), authorityText);

const candidates = matchNarratorAuthorityCandidates(authority.persons, narrators.clusters);
const chronologyWarnings = detectChronologyWarnings(authority.persons, authority.assertions);
const candidateDoc = {
  format: "unified-hadith-narrator-authority-candidates-0.1",
  sourceAuthoritySha256: createHash("sha256").update(authorityText).digest("hex"),
  sourceNarratorIndexSha256: createHash("sha256").update(narratorBytes).digest("hex"),
  candidateCount: candidates.length,
  candidates,
  chronologyWarningCount: chronologyWarnings.length,
  chronologyWarnings,
  method: {
    matching: "deterministic normalized Arabic surface comparison 0.1",
    automaticIdentityResolution: false,
    chronologyChecks: "teacher/student assertions compared against birth/death years when both are recorded; broken links flagged when the related person id does not resolve",
    warningsAreNotRulings: true,
    authorityKind: "openiti-attested-plus-optional-wikidata"
  }
};
const json = `${JSON.stringify(candidateDoc)}\n`;
const compressed = gzipSync(Buffer.from(json), { level: 9, mtime: 0 });
await mkdir(new URL("data/staging/", root), { recursive: true });
await writeFile(new URL("data/staging/openiti-attested-authority-candidates.json.gz", root), compressed);
await writeFile(
  new URL("data/staging/openiti-attested-authority-candidates.manifest.json", root),
  `${JSON.stringify(
    {
      format: candidateDoc.format,
      sourceAuthoritySha256: candidateDoc.sourceAuthoritySha256,
      sourceNarratorIndexSha256: candidateDoc.sourceNarratorIndexSha256,
      candidateCount: candidates.length,
      chronologyWarningCount: chronologyWarnings.length,
      personCount: persons.length,
      wikidataPersonsAdded: wikidataAdded,
      uncompressedSha256: createHash("sha256").update(json).digest("hex"),
      compressedSha256: createHash("sha256").update(compressed).digest("hex"),
      compressedBytes: compressed.length,
      method: candidateDoc.method
    },
    null,
    2
  )}\n`
);

console.log(
  `Wrote attested authority with ${persons.length} persons (${wikidataAdded} Wikidata-enriched) and ${candidates.length} matcher candidates.`
);
