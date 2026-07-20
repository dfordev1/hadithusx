// CLI: validate a Unified Hadith corpus document (and optionally a narrator
// authority document) against the JSON Schemas plus the semantic rules in
// scripts/lib/validate-corpus.mjs.
//
// Usage:
//   node scripts/validate.mjs                                   # data/corpus.json + data/narrator-authority.fixture.json (default, used by `npm run validate` and CI)
//   node scripts/validate.mjs <corpus.json>                     # validate a specific corpus file only; skips authority validation
//   node scripts/validate.mjs <corpus.json> <authority.json>    # validate both a specific corpus file and a specific authority file
//
// This is the documented external-integration entry point referenced in
// spec/COMPATIBILITY.md: any tool can invoke it as a subprocess with no
// network dependency and check its exit code.

import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateCorpus } from "./lib/validate-corpus.mjs";

const [, , corpusArg, authorityArg] = process.argv;
const corpusPath = corpusArg ?? new URL("../data/corpus.json", import.meta.url);
const authorityPath = corpusArg ? authorityArg : new URL("../data/narrator-authority.fixture.json", import.meta.url);

let corpus;
try {
  corpus = JSON.parse(await readFile(corpusPath, "utf8"));
} catch (error) {
  console.error(`Could not read or parse corpus file ${corpusPath}: ${error.message}`);
  process.exit(1);
}
const schema = JSON.parse(await readFile(new URL("../schema/unified-hadith.schema.json", import.meta.url), "utf8"));
const authoritySchema = JSON.parse(await readFile(new URL("../schema/narrator-authority.schema.json", import.meta.url), "utf8"));

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);

const schemaValid = ajv.validate(schema, corpus);
if (!schemaValid) {
  console.error("JSON Schema validation failed:");
  for (const error of ajv.errors ?? []) console.error(`- ${error.instancePath || "/"}: ${error.message}`);
  process.exit(1);
}
const errors = validateCorpus(corpus);
if (errors.length) {
  console.error(`Corpus validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
const routes = corpus.witnesses.reduce((sum, witness) => sum + witness.isnads.length, 0);
const mentions = corpus.witnesses.reduce((sum, witness) => sum + witness.isnads.reduce((n, isnad) => n + isnad.route.length, 0), 0);
console.log(`JSON Schema and semantic validation passed for ${corpus.witnesses.length} witnesses, ${routes} isnad routes, ${mentions} mentions, ${corpus.claims.length} claims, and ${corpus.alignments.length} alignment.`);

if (authorityPath) {
  const authority = JSON.parse(await readFile(authorityPath, "utf8"));
  const validateAuthority = ajv.compile(authoritySchema);
  if (!validateAuthority(authority)) {
    console.error("Narrator authority schema validation failed:");
    for (const error of validateAuthority.errors ?? []) console.error(`- ${error.instancePath || "/"}: ${error.message}`);
    process.exit(1);
  }
  const authoritySources = new Set(authority.sources.map((source) => source.id));
  const authorityPersons = new Set(authority.persons.map((person) => person.id));
  for (const person of authority.persons) for (const name of person.nameForms) if (!authoritySources.has(name.citation.source)) throw new Error(`${person.id} name citation has unresolved source ${name.citation.source}`);
  for (const assertion of authority.assertions) {
    if (!authorityPersons.has(assertion.subject)) throw new Error(`${assertion.id} has unresolved subject ${assertion.subject}`);
    if (!authoritySources.has(assertion.citation.source)) throw new Error(`${assertion.id} has unresolved citation source ${assertion.citation.source}`);
  }
  console.log(`Narrator authority validation passed for ${authority.persons.length} structural person fixture and ${authority.assertions.length} cited assertion.`);
} else {
  console.log("No authority document given; skipped narrator authority validation.");
}
