#!/usr/bin/env node
// Export isnad routes from a corpus JSON document as GraphML and JSON-LD.
//
// Usage:
//   node scripts/export-graph.mjs [corpus.json] [out-prefix]
// Defaults: data/corpus.json -> dist/graph/corpus

import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const corpusPath = process.argv[2] ? new URL(process.argv[2], `file://${process.cwd()}/`) : new URL("data/corpus.json", root);
const outPrefix = process.argv[3] || "dist/graph/corpus";

const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
const nodes = new Map();
const edges = [];

for (const person of corpus.persons) {
  nodes.set(person.id, { id: person.id, label: person.preferredName, type: "person" });
}
for (const witness of corpus.witnesses) {
  nodes.set(witness.id, { id: witness.id, label: witness.locator, type: "witness" });
  for (const isnad of witness.isnads) {
    for (let i = 0; i < isnad.route.length; i += 1) {
      const mention = isnad.route[i];
      const mentionNodeId = mention.id;
      nodes.set(mentionNodeId, { id: mentionNodeId, label: mention.surface, type: "mention" });
      edges.push({ id: `${mention.id}:on`, source: witness.id, target: mentionNodeId, label: "hasMention" });
      for (const assertion of mention.identityAssertions || []) {
        edges.push({ id: `${assertion.id}:identity`, source: mentionNodeId, target: assertion.person, label: "identityCandidate" });
      }
      if (i > 0) {
        edges.push({
          id: `${isnad.id}:step-${i}`,
          source: isnad.route[i - 1].id,
          target: mention.id,
          label: mention.transmissionTerm || "transmits"
        });
      }
    }
  }
}

const graphml = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <key id="label" for="node" attr.name="label" attr.type="string"/>
  <key id="type" for="node" attr.name="type" attr.type="string"/>
  <key id="elabel" for="edge" attr.name="label" attr.type="string"/>
  <graph id="G" edgedefault="directed">
${[...nodes.values()]
  .map((n) => `    <node id="${n.id}"><data key="label">${escape(n.label)}</data><data key="type">${n.type}</data></node>`)
  .join("\n")}
${edges
  .map((e) => `    <edge id="${e.id}" source="${e.source}" target="${e.target}"><data key="elabel">${escape(e.label)}</data></edge>`)
  .join("\n")}
  </graph>
</graphml>
`;

const jsonld = {
  "@context": {
    label: "http://www.w3.org/2000/01/rdf-schema#label",
    type: "@type",
    source: { "@id": "http://unifiedhadith.org/from", "@type": "@id" },
    target: { "@id": "http://unifiedhadith.org/to", "@type": "@id" }
  },
  "@graph": [
    ...[...nodes.values()].map((n) => ({ "@id": n.id, label: n.label, type: n.type })),
    ...edges.map((e) => ({ "@id": e.id, source: e.source, target: e.target, label: e.label }))
  ]
};

function escape(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const outBase = new URL(`${outPrefix}`, root);
await mkdir(new URL(".", outBase), { recursive: true });
await writeFile(new URL(`${outPrefix}.graphml`, root), graphml);
await writeFile(new URL(`${outPrefix}.jsonld`, root), `${JSON.stringify(jsonld, null, 2)}\n`);
console.log(`Wrote ${outPrefix}.graphml and ${outPrefix}.jsonld (${nodes.size} nodes, ${edges.length} edges).`);
