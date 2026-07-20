#!/usr/bin/env node
// CLI: convert a Unified Hadith corpus document between JSON and XML.
//
// Usage:
//   node scripts/convert-corpus.mjs to-xml <input.json> <output.xml>
//   node scripts/convert-corpus.mjs to-json <input.xml> <output.json>
//
// The conversion is lossless in both directions for any document that
// conforms to schema/unified-hadith.schema.json / schema/unified-hadith.xsd
// (see scripts/lib/xml-interchange.mjs and tests/interchange-tests.mjs).

import { readFile, writeFile } from "node:fs/promises";
import { corpusToXml, xmlToCorpus } from "./lib/xml-interchange.mjs";

const [, , mode, inputPath, outputPath] = process.argv;

function usage() {
  console.error("Usage: node scripts/convert-corpus.mjs <to-xml|to-json> <input> <output>");
  process.exit(1);
}

if (!["to-xml", "to-json"].includes(mode) || !inputPath || !outputPath) usage();

if (mode === "to-xml") {
  const corpus = JSON.parse(await readFile(inputPath, "utf8"));
  await writeFile(outputPath, corpusToXml(corpus), "utf8");
  console.log(`Wrote ${outputPath}`);
} else {
  const xmlText = await readFile(inputPath, "utf8");
  const corpus = xmlToCorpus(xmlText);
  await writeFile(outputPath, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
}
