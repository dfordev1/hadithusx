// Lossless JSON <-> XML conversion for the Unified Hadith corpus model.
//
// The mapping is field-for-field with schema/unified-hadith.schema.json
// (JSON) and schema/unified-hadith.xsd (XML): every property in the JSON
// Schema has exactly one corresponding XML attribute or element, so a
// corpus can be serialized to XML and parsed back to JSON without losing
// or inventing any field. tests/interchange-tests.mjs verifies this by
// round-tripping every real witness in data/corpus.json.
//
// This module has no dependency on the shape of any specific corpus file;
// it only depends on the schema. It is intentionally strict: converting an
// object missing a required field will produce XML that fails schema
// validation rather than silently dropping the field.

import { DOMParser } from "@xmldom/xmldom";

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const attr = (name, value) => (value === undefined || value === null ? "" : ` ${name}="${escapeXml(value)}"`);

function mentionToXml(mention) {
  const assertions = mention.identityAssertions
    .map(
      (a) =>
        `<identityAssertion${attr("id", a.id)}${attr("person", a.person)}${attr("assertedBy", a.assertedBy)}${attr("confidence", a.confidence)}${attr("reviewState", a.reviewState)}${attr("evidence", a.evidence)}/>`
    )
    .join("");
  return `<mention${attr("id", mention.id)}${attr("position", mention.position)}${attr("transmissionTerm", mention.transmissionTerm)}><surface>${escapeXml(mention.surface)}</surface><identityAssertions>${assertions}</identityAssertions></mention>`;
}

function isnadToXml(isnad) {
  return `<isnad${attr("id", isnad.id)}${attr("reviewState", isnad.reviewState)}>${isnad.route.map(mentionToXml).join("")}</isnad>`;
}

function witnessToXml(witness) {
  const structuredLocator = witness.structuredLocator
    ? `<structuredLocator${attr("collectionLabel", witness.structuredLocator.collectionLabel)}${attr("book", witness.structuredLocator.book)}${attr("chapter", witness.structuredLocator.chapter)}${attr("reportNumber", witness.structuredLocator.reportNumber)}/>`
    : "";
  const isnads = witness.isnads.map(isnadToXml).join("");
  const tokens = witness.matn.tokens.map((t) => `<token${attr("id", t.id)}${attr("position", t.position)}>${escapeXml(t.text)}</token>`).join("");
  const provenance = witness.provenance;
  return `<witness${attr("id", witness.id)}${attr("edition", witness.edition)}${attr("locator", witness.locator)}${attr("language", witness.language)}${attr("reviewState", witness.reviewState)}>${structuredLocator}<isnads>${isnads}</isnads><matn${attr("diplomatic", witness.matn.diplomatic)}>${tokens}</matn><provenance${attr("createdBy", provenance.createdBy)}${attr("method", provenance.method)}${attr("createdAt", provenance.createdAt)}${attr("derivedFrom", provenance.derivedFrom)}/></witness>`;
}

export function corpusToXml(corpus) {
  const agents = corpus.agents.map((a) => `<agent${attr("id", a.id)}${attr("type", a.type)}${attr("name", a.name)}${attr("version", a.version)}/>`).join("");
  const works = corpus.works.map((w) => `<work${attr("id", w.id)}><title${attr("ar", w.title.ar)}${attr("en", w.title.en)}/></work>`).join("");
  const editions = corpus.editions.map((e) => `<edition${attr("id", e.id)}${attr("work", e.work)}${attr("label", e.label)}${attr("sourceType", e.sourceType)}${attr("citation", e.citation)}${attr("license", e.license)}/>`).join("");
  const persons = corpus.persons
    .map((p) => `<person${attr("id", p.id)}${attr("preferredName", p.preferredName)}${attr("reviewState", p.reviewState)}${attr("notes", p.notes)}>${p.nameForms.map((n) => `<nameForm>${escapeXml(n)}</nameForm>`).join("")}</person>`)
    .join("");
  const witnesses = corpus.witnesses.map(witnessToXml).join("");
  const claims = corpus.claims
    .map((c) => `<claim${attr("id", c.id)}${attr("subject", c.subject)}${attr("predicate", c.predicate)}${attr("object", c.object)}${attr("assertedBy", c.assertedBy)}${attr("citation", c.citation)}${attr("confidence", c.confidence)}${attr("reviewState", c.reviewState)}${attr("supports", c.supports)}${attr("contradicts", c.contradicts)}/>`)
    .join("");
  const alignments = corpus.alignments
    .map(
      (a) =>
        `<alignment${attr("id", a.id)}${attr("type", a.type)}${attr("assertedBy", a.assertedBy)}${attr("confidence", a.confidence)}${attr("reviewState", a.reviewState)}>${a.members
          .map((m) => `<member${attr("witness", m.witness)}>${m.tokens.map((t) => `<token>${escapeXml(t)}</token>`).join("")}</member>`)
          .join("")}</alignment>`
    )
    .join("");
  const commentaries = Array.isArray(corpus.commentaries)
    ? `<commentaries>${corpus.commentaries
        .map(
          (c) =>
            `<commentary${attr("id", c.id)}${attr("about", c.about)}${attr("assertedBy", c.assertedBy)}${attr("citation", c.citation)}${attr("confidence", c.confidence)}${attr("reviewState", c.reviewState)}${attr("tradition", c.tradition)}><text>${escapeXml(c.text)}</text></commentary>`
        )
        .join("")}</commentaries>`
    : "";
  const gradings = Array.isArray(corpus.gradings)
    ? `<gradings>${corpus.gradings
        .map(
          (g) =>
            `<grading${attr("id", g.id)}${attr("about", g.about)}${attr("grade", g.grade)}${attr("gradeLabel", g.gradeLabel)}${attr("assertedBy", g.assertedBy)}${attr("citation", g.citation)}${attr("confidence", g.confidence)}${attr("reviewState", g.reviewState)}${attr("tradition", g.tradition)}${attr("contradicts", g.contradicts)}/>`
        )
        .join("")}</gradings>`
    : "";
  const crossReferences = Array.isArray(corpus.crossReferences)
    ? `<crossReferences>${corpus.crossReferences
        .map(
          (x) =>
            `<crossReference${attr("id", x.id)}${attr("from", x.from)}${attr("to", x.to)}${attr("relation", x.relation)}${attr("assertedBy", x.assertedBy)}${attr("citation", x.citation)}${attr("confidence", x.confidence)}${attr("reviewState", x.reviewState)}/>`
        )
        .join("")}</crossReferences>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>\n<corpus${attr("standardVersion", corpus.standardVersion)}${attr("status", corpus.status)}><agents>${agents}</agents><works>${works}</works><editions>${editions}</editions><persons>${persons}</persons><witnesses>${witnesses}</witnesses><claims>${claims}</claims><alignments>${alignments}</alignments>${commentaries}${gradings}${crossReferences}</corpus>\n`;
}

function childElements(el, tag) {
  const out = [];
  for (const child of Array.from(el.childNodes)) if (child.nodeType === 1 && child.tagName === tag) out.push(child);
  return out;
}
function firstChildElement(el, tag) {
  return childElements(el, tag)[0] ?? null;
}
const getAttr = (el, name) => {
  // A present-but-empty attribute (value === "") is a legitimate value,
  // distinct from an absent one. Using hasAttribute() to detect absence
  // (rather than collapsing "" and null together) keeps XML->JSON parsing
  // lossless for optional string fields explicitly set to "" — otherwise
  // corpusToXml()'s faithful `field=""` serialization gets silently
  // dropped back to undefined on the way in.
  return el.hasAttribute(name) ? el.getAttribute(name) : undefined;
};
const getRequiredAttr = (el, name) => el.getAttribute(name);
const textOf = (el) => (el ? el.textContent : "");

export function xmlToCorpus(xmlText) {
  let parseError = null;
  const doc = new DOMParser({
    onError: (level, msg) => {
      if (level === "warning") return;
      parseError = parseError || `${level}: ${msg}`;
    }
  }).parseFromString(xmlText, "text/xml");
  if (parseError) throw new Error(`XML parse error: ${parseError}`);
  const root = doc.documentElement;
  if (!root || root.tagName !== "corpus") throw new Error("Root element must be <corpus>");

  const agents = childElements(firstChildElement(root, "agents"), "agent").map((el) => {
    const agent = { id: getRequiredAttr(el, "id"), type: getRequiredAttr(el, "type"), name: getRequiredAttr(el, "name") };
    const version = getAttr(el, "version");
    if (version !== undefined) agent.version = version;
    return agent;
  });

  const works = childElements(firstChildElement(root, "works"), "work").map((el) => {
    const title = firstChildElement(el, "title");
    return { id: getRequiredAttr(el, "id"), title: { ar: getRequiredAttr(title, "ar"), en: getRequiredAttr(title, "en") } };
  });

  const editions = childElements(firstChildElement(root, "editions"), "edition").map((el) => {
    const edition = { id: getRequiredAttr(el, "id"), work: getRequiredAttr(el, "work"), label: getRequiredAttr(el, "label"), sourceType: getRequiredAttr(el, "sourceType"), citation: getRequiredAttr(el, "citation") };
    const license = getAttr(el, "license");
    if (license !== undefined) edition.license = license;
    return edition;
  });

  const persons = childElements(firstChildElement(root, "persons"), "person").map((el) => {
    const person = {
      id: getRequiredAttr(el, "id"),
      preferredName: getRequiredAttr(el, "preferredName"),
      nameForms: childElements(el, "nameForm").map((n) => textOf(n)),
      reviewState: getRequiredAttr(el, "reviewState")
    };
    const notes = getAttr(el, "notes");
    if (notes !== undefined) person.notes = notes;
    return person;
  });

  const witnesses = childElements(firstChildElement(root, "witnesses"), "witness").map((el) => {
    const isnads = childElements(firstChildElement(el, "isnads"), "isnad").map((isnadEl) => ({
      id: getRequiredAttr(isnadEl, "id"),
      reviewState: getRequiredAttr(isnadEl, "reviewState"),
      route: childElements(isnadEl, "mention").map((mentionEl) => {
        const identityAssertions = childElements(firstChildElement(mentionEl, "identityAssertions"), "identityAssertion").map((assertionEl) => {
          const assertion = {
            id: getRequiredAttr(assertionEl, "id"),
            person: getRequiredAttr(assertionEl, "person"),
            assertedBy: getRequiredAttr(assertionEl, "assertedBy"),
            confidence: getRequiredAttr(assertionEl, "confidence"),
            reviewState: getRequiredAttr(assertionEl, "reviewState")
          };
          const evidence = getAttr(assertionEl, "evidence");
          if (evidence !== undefined) assertion.evidence = evidence;
          return assertion;
        });
        return {
          id: getRequiredAttr(mentionEl, "id"),
          position: Number.parseInt(getRequiredAttr(mentionEl, "position"), 10),
          surface: textOf(firstChildElement(mentionEl, "surface")),
          transmissionTerm: getRequiredAttr(mentionEl, "transmissionTerm"),
          identityAssertions
        };
      })
    }));
    const matnEl = firstChildElement(el, "matn");
    const matn = {
      diplomatic: getRequiredAttr(matnEl, "diplomatic"),
      tokens: childElements(matnEl, "token").map((tokenEl) => ({ id: getRequiredAttr(tokenEl, "id"), position: Number.parseInt(getRequiredAttr(tokenEl, "position"), 10), text: textOf(tokenEl) }))
    };
    const provenanceEl = firstChildElement(el, "provenance");
    const provenance = { createdBy: getRequiredAttr(provenanceEl, "createdBy"), method: getRequiredAttr(provenanceEl, "method"), createdAt: getRequiredAttr(provenanceEl, "createdAt") };
    const derivedFrom = getAttr(provenanceEl, "derivedFrom");
    if (derivedFrom !== undefined) provenance.derivedFrom = derivedFrom;
    const witness = { id: getRequiredAttr(el, "id"), edition: getRequiredAttr(el, "edition"), locator: getRequiredAttr(el, "locator"), language: getRequiredAttr(el, "language"), isnads, matn, reviewState: getRequiredAttr(el, "reviewState"), provenance };
    const structuredLocatorEl = firstChildElement(el, "structuredLocator");
    if (structuredLocatorEl) {
      const structuredLocator = { collectionLabel: getRequiredAttr(structuredLocatorEl, "collectionLabel"), book: getRequiredAttr(structuredLocatorEl, "book") };
      const chapter = getAttr(structuredLocatorEl, "chapter");
      if (chapter !== undefined) structuredLocator.chapter = chapter;
      const reportNumber = getAttr(structuredLocatorEl, "reportNumber");
      if (reportNumber !== undefined) structuredLocator.reportNumber = Number.parseInt(reportNumber, 10);
      witness.structuredLocator = structuredLocator;
    }
    return witness;
  });

  const claims = childElements(firstChildElement(root, "claims"), "claim").map((el) => {
    const claim = {
      id: getRequiredAttr(el, "id"),
      subject: getRequiredAttr(el, "subject"),
      predicate: getRequiredAttr(el, "predicate"),
      object: getRequiredAttr(el, "object"),
      assertedBy: getRequiredAttr(el, "assertedBy"),
      citation: getRequiredAttr(el, "citation"),
      confidence: getRequiredAttr(el, "confidence"),
      reviewState: getRequiredAttr(el, "reviewState")
    };
    const supports = getAttr(el, "supports");
    if (supports !== undefined) claim.supports = supports;
    const contradicts = getAttr(el, "contradicts");
    if (contradicts !== undefined) claim.contradicts = contradicts;
    return claim;
  });

  const alignments = childElements(firstChildElement(root, "alignments"), "alignment").map((el) => ({
    id: getRequiredAttr(el, "id"),
    type: getRequiredAttr(el, "type"),
    members: childElements(el, "member").map((memberEl) => ({ witness: getRequiredAttr(memberEl, "witness"), tokens: childElements(memberEl, "token").map((t) => textOf(t)) })),
    assertedBy: getRequiredAttr(el, "assertedBy"),
    confidence: getRequiredAttr(el, "confidence"),
    reviewState: getRequiredAttr(el, "reviewState")
  }));

  const result = { standardVersion: getRequiredAttr(root, "standardVersion"), status: getRequiredAttr(root, "status"), agents, works, editions, persons, witnesses, claims, alignments };

  const commentariesEl = firstChildElement(root, "commentaries");
  if (commentariesEl) {
    result.commentaries = childElements(commentariesEl, "commentary").map((el) => {
      const item = {
        id: getRequiredAttr(el, "id"),
        about: getRequiredAttr(el, "about"),
        text: textOf(firstChildElement(el, "text")),
        assertedBy: getRequiredAttr(el, "assertedBy"),
        citation: getRequiredAttr(el, "citation"),
        confidence: getRequiredAttr(el, "confidence"),
        reviewState: getRequiredAttr(el, "reviewState")
      };
      const tradition = getAttr(el, "tradition");
      if (tradition !== undefined) item.tradition = tradition;
      return item;
    });
  }

  const gradingsEl = firstChildElement(root, "gradings");
  if (gradingsEl) {
    result.gradings = childElements(gradingsEl, "grading").map((el) => {
      const item = {
        id: getRequiredAttr(el, "id"),
        about: getRequiredAttr(el, "about"),
        grade: getRequiredAttr(el, "grade"),
        assertedBy: getRequiredAttr(el, "assertedBy"),
        citation: getRequiredAttr(el, "citation"),
        confidence: getRequiredAttr(el, "confidence"),
        reviewState: getRequiredAttr(el, "reviewState")
      };
      const gradeLabel = getAttr(el, "gradeLabel");
      if (gradeLabel !== undefined) item.gradeLabel = gradeLabel;
      const tradition = getAttr(el, "tradition");
      if (tradition !== undefined) item.tradition = tradition;
      const contradicts = getAttr(el, "contradicts");
      if (contradicts !== undefined) item.contradicts = contradicts;
      return item;
    });
  }

  const crossReferencesEl = firstChildElement(root, "crossReferences");
  if (crossReferencesEl) {
    result.crossReferences = childElements(crossReferencesEl, "crossReference").map((el) => ({
      id: getRequiredAttr(el, "id"),
      from: getRequiredAttr(el, "from"),
      to: getRequiredAttr(el, "to"),
      relation: getRequiredAttr(el, "relation"),
      assertedBy: getRequiredAttr(el, "assertedBy"),
      citation: getRequiredAttr(el, "citation"),
      confidence: getRequiredAttr(el, "confidence"),
      reviewState: getRequiredAttr(el, "reviewState")
    }));
  }

  return result;
}
