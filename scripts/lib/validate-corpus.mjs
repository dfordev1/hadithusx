const ID = /^uh:[a-z]+:[a-z0-9][a-z0-9:.-]*$/;
const REVIEWS = new Set(["imported", "machine-suggested", "editor-reviewed", "scholar-verified", "disputed", "rejected"]);
const CONFIDENCE = new Set(["certain", "probable", "possible", "uncertain", "unknown"]);

export function validateCorpus(corpus) {
  const errors = [];
  const warn = (path, message) => errors.push(`${path}: ${message}`);
  if (corpus.standardVersion !== "0.1") warn("standardVersion", "must be 0.1");

  const collections = ["agents", "works", "editions", "persons", "witnesses", "claims", "alignments"];
  const optionalCollections = ["commentaries", "gradings", "crossReferences"];
  for (const key of collections) if (!Array.isArray(corpus[key])) warn(key, "must be an array");
  for (const key of optionalCollections) if (corpus[key] !== undefined && !Array.isArray(corpus[key])) warn(key, "must be an array when present");
  if (errors.length) return errors;

  const allRecords = [
    ...collections.flatMap((key) => corpus[key].map((value) => ({ key, value }))),
    ...optionalCollections.flatMap((key) => (Array.isArray(corpus[key]) ? corpus[key].map((value) => ({ key, value })) : []))
  ];
  const ids = new Map();
  for (const { key, value } of allRecords) {
    if (!ID.test(value.id ?? "")) warn(`${key}`, `invalid id ${value.id}`);
    else if (ids.has(value.id)) warn(`${key}`, `duplicate id ${value.id}`);
    else ids.set(value.id, key);
  }

  const requireRef = (path, id, expected) => {
    if (!ids.has(id)) warn(path, `unresolved reference ${id}`);
    else if (expected && ids.get(id) !== expected) warn(path, `${id} must reference ${expected}, found ${ids.get(id)}`);
  };
  const agents = new Set(corpus.agents.map((x) => x.id));
  const personIds = new Set(corpus.persons.map((x) => x.id));
  const witnessIds = new Set(corpus.witnesses.map((x) => x.id));
  const tokenIds = new Set();
  const nestedIds = new Set();

  for (const edition of corpus.editions) requireRef(`${edition.id}.work`, edition.work, "works");
  for (const person of corpus.persons) if (!REVIEWS.has(person.reviewState)) warn(`${person.id}.reviewState`, "invalid review state");

  for (const witness of corpus.witnesses) {
    requireRef(`${witness.id}.edition`, witness.edition, "editions");
    if (!REVIEWS.has(witness.reviewState)) warn(`${witness.id}.reviewState`, "invalid review state");
    if (witness.matn.diplomatic !== witness.matn.diplomatic.normalize("NFC")) warn(`${witness.id}.matn`, "must use Unicode NFC");
    const words = witness.matn.diplomatic.trim().split(/\s+/u);
    if (words.length !== witness.matn.tokens.length) warn(`${witness.id}.matn.tokens`, "token count does not match whitespace-tokenized diplomatic text");
    witness.matn.tokens.forEach((token, index) => {
      if (token.position !== index + 1) warn(`${witness.id}.tokens[${index}]`, "positions must be continuous from 1");
      if (tokenIds.has(token.id) || ids.has(token.id) || nestedIds.has(token.id)) warn(`${witness.id}.tokens`, `duplicate nested id ${token.id}`);
      tokenIds.add(token.id); nestedIds.add(token.id);
      if (token.text !== words[index]) warn(`${token.id}.text`, "token text does not reproduce diplomatic text");
    });
    const isnadIds = new Set();
    for (const isnad of witness.isnads) {
      if (isnadIds.has(isnad.id) || nestedIds.has(isnad.id) || ids.has(isnad.id)) warn(`${witness.id}.isnads`, `duplicate isnad id ${isnad.id}`);
      isnadIds.add(isnad.id); nestedIds.add(isnad.id);
      if (!REVIEWS.has(isnad.reviewState)) warn(`${isnad.id}.reviewState`, "invalid review state");
      isnad.route.forEach((mention, index) => {
        if (mention.position !== index + 1) warn(`${isnad.id}.route[${index}]`, "positions must be continuous from 1");
        if (nestedIds.has(mention.id) || ids.has(mention.id)) warn(`${isnad.id}.route`, `duplicate mention id ${mention.id}`);
        nestedIds.add(mention.id);
        for (const assertion of mention.identityAssertions) {
          if (nestedIds.has(assertion.id) || ids.has(assertion.id)) warn(`${mention.id}.identityAssertions`, `duplicate assertion id ${assertion.id}`);
          nestedIds.add(assertion.id);
          if (!personIds.has(assertion.person)) warn(`${assertion.id}.person`, `unresolved person ${assertion.person}`);
          if (!agents.has(assertion.assertedBy)) warn(`${assertion.id}.assertedBy`, `unresolved agent ${assertion.assertedBy}`);
          if (!CONFIDENCE.has(assertion.confidence)) warn(`${assertion.id}.confidence`, "invalid confidence");
          if (!REVIEWS.has(assertion.reviewState)) warn(`${assertion.id}.reviewState`, "invalid review state");
          if (assertion.reviewState === "machine-suggested" && corpus.agents.find((a) => a.id === assertion.assertedBy)?.type !== "software") warn(`${assertion.id}.assertedBy`, "machine suggestion must be attributed to software");
        }
      });
    }
    if (!agents.has(witness.provenance.createdBy)) warn(`${witness.id}.provenance.createdBy`, "unresolved agent");
  }

  for (const claim of corpus.claims) {
    if (!ids.has(claim.subject) && !nestedIds.has(claim.subject)) warn(`${claim.id}.subject`, `unresolved subject ${claim.subject}`);
    if (!agents.has(claim.assertedBy)) warn(`${claim.id}.assertedBy`, "unresolved agent");
    if (!claim.citation?.trim()) warn(`${claim.id}.citation`, "citation is required");
    if (!CONFIDENCE.has(claim.confidence)) warn(`${claim.id}.confidence`, "invalid confidence");
    if (!REVIEWS.has(claim.reviewState)) warn(`${claim.id}.reviewState`, "invalid review state");
    if (claim.contradicts) requireRef(`${claim.id}.contradicts`, claim.contradicts, "claims");
    if (claim.supports) requireRef(`${claim.id}.supports`, claim.supports, "claims");
  }

  for (const commentary of corpus.commentaries || []) {
    if (!ids.has(commentary.about) && !nestedIds.has(commentary.about) && !witnessIds.has(commentary.about) && !personIds.has(commentary.about)) {
      warn(`${commentary.id}.about`, `unresolved about ${commentary.about}`);
    }
    if (!agents.has(commentary.assertedBy)) warn(`${commentary.id}.assertedBy`, "unresolved agent");
    if (!CONFIDENCE.has(commentary.confidence)) warn(`${commentary.id}.confidence`, "invalid confidence");
    if (!REVIEWS.has(commentary.reviewState)) warn(`${commentary.id}.reviewState`, "invalid review state");
  }

  for (const grading of corpus.gradings || []) {
    if (!ids.has(grading.about) && !nestedIds.has(grading.about) && !witnessIds.has(grading.about)) {
      warn(`${grading.id}.about`, `unresolved about ${grading.about}`);
    }
    if (!agents.has(grading.assertedBy)) warn(`${grading.id}.assertedBy`, "unresolved agent");
    if (!CONFIDENCE.has(grading.confidence)) warn(`${grading.id}.confidence`, "invalid confidence");
    if (!REVIEWS.has(grading.reviewState)) warn(`${grading.id}.reviewState`, "invalid review state");
    if (grading.contradicts && !ids.has(grading.contradicts)) warn(`${grading.id}.contradicts`, `unresolved grading ${grading.contradicts}`);
  }

  for (const xref of corpus.crossReferences || []) {
    if (!witnessIds.has(xref.from) && !ids.has(xref.from)) warn(`${xref.id}.from`, `unresolved from ${xref.from}`);
    if (!witnessIds.has(xref.to) && !ids.has(xref.to)) warn(`${xref.id}.to`, `unresolved to ${xref.to}`);
    if (!agents.has(xref.assertedBy)) warn(`${xref.id}.assertedBy`, "unresolved agent");
    if (!CONFIDENCE.has(xref.confidence)) warn(`${xref.id}.confidence`, "invalid confidence");
    if (!REVIEWS.has(xref.reviewState)) warn(`${xref.id}.reviewState`, "invalid review state");
  }

  for (const alignment of corpus.alignments) {
    if (alignment.members.length < 2) warn(`${alignment.id}.members`, "requires at least two members");
    for (const member of alignment.members) {
      if (!witnessIds.has(member.witness)) warn(`${alignment.id}.members`, `unresolved witness ${member.witness}`);
      for (const token of member.tokens) if (!tokenIds.has(token)) warn(`${alignment.id}.members`, `unresolved token ${token}`);
    }
    if (!agents.has(alignment.assertedBy)) warn(`${alignment.id}.assertedBy`, "unresolved agent");
  }
  return errors;
}

