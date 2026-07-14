import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateCorpus } from "./lib/validate-corpus.mjs";

const corpus = JSON.parse(await readFile(new URL("../data/corpus.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/unified-hadith.schema.json", import.meta.url), "utf8"));
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
