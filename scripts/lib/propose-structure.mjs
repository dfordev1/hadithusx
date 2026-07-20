// Turns raw, cleaned OpenITI report text into a proposed isnad/matn segmentation
// and a list of machine-suggested narrator mentions. Everything this function
// produces is `reviewState: "machine-suggested"` — nothing here is a fact until
// a human (or a downstream review workflow) confirms it. See
// tests/structural-conformance-tests.mjs for the accuracy harness that checks
// this function's output against hand-verified expectations.

const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

export const parseArabicNumber = (value) =>
  Number(value.replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit))));

export const cleanOpenitiText = (value) => value.split(/\r?\n/)
  .filter((line) => !/^###/.test(line) && !/^# PageV/.test(line))
  .map((line) => line.replace(/^~~/, "").replace(/^# /, "").replace(/\bms\d+\b/g, "").replace(/PageV\d+P\d+/g, "").trim())
  .filter(Boolean).join(" ").replace(/\s+/g, " ").normalize("NFC").trim();

export function proposeStructure(text) {
  const explicitMarker = text.indexOf("@MATN@");
  const quotationIndexes = [text.indexOf("«"), text.indexOf('"')].filter((index) => index >= 0);
  const quotationStart = quotationIndexes.length ? Math.min(...quotationIndexes) : -1;
  let boundary = -1, matnStart = -1, method = "unsegmented";
  if (explicitMarker >= 0) { boundary = explicitMarker; matnStart = explicitMarker + "@MATN@".length; method = "openiti-matn-marker"; }
  else if (quotationStart >= 0) { boundary = quotationStart; matnStart = quotationStart + 1; method = "arabic-quotation-boundary"; }
  while (matnStart >= 0 && /\s/u.test(text[matnStart])) matnStart++;
  const chainEnd = boundary >= 0 ? boundary : text.length;
  const chainText = text.slice(0, chainEnd);
  const termMatches = [...chainText.matchAll(/(?<![\p{L}\p{M}])(حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا|أنبأني|سمعت|عن|قال)(?![\p{L}\p{M}])/gu)];
  const transmissionTerms = termMatches.map((match) => ({ term: match[0], start: match.index, end: match.index + match[0].length }));
  const branchMarkers = [...chainText.matchAll(/(?<![\p{L}\p{M}])ح(?=\s+و?(?:حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا|أنبأني))/gu)].map((match, index) => ({ marker: match[0], start: match.index, end: match.index + match[0].length, beforeBranch: index + 1, afterBranch: index + 2 }));
  // Strips trailing honorific formulas so they don't get captured as part of
  // a narrator's surface name. Previously only handled "رضي الله عنه(ما)"
  // (companions); a 27-agent content review found the Prophet's own
  // salutation "صلى الله عليه وسلم" (and the "عليه الصلاة والسلام" variant)
  // was left attached to surfaces like "النبي"/"رسول الله", inconsistent
  // with the companion case right next to it in this same regex.
  const normalizeName = (value) => value.normalize("NFC").replace(/^[\s،:؛و]+|[\s،:؛.]+$/gu, "").replace(/\s+(?:صلى الله عليه وسلم|عليه الصلاة والسلام|رضي الله عنه(?:ما)?|رحمه الله|عليه السلام)(?:\s.*)?$/u, "").replace(/\s+/g, " ").trim();
  const narratorMentions = [];
  for (let index = 0; index < termMatches.length; index++) {
    const term = termMatches[index][0], start = termMatches[index].index, termEnd = start + term.length;
    const nextTermStart = termMatches[index + 1]?.index ?? chainText.length;
    const interveningMarker = branchMarkers.find((marker) => marker.start > termEnd && marker.start < nextTermStart);
    const end = interveningMarker?.start ?? nextTermStart;
    const rawSurface = chainText.slice(termEnd, end);
    const surface = normalizeName(rawSurface);
    // The overlength check intentionally uses rawSurface (before honorific
    // stripping), not the normalized surface: an implausibly long captured
    // span is itself the signal that this is matn/commentary bleed-through
    // rather than a real narrator name (see the known narratorMentions
    // bleed limitation in docs/NEXT.md), and that signal shouldn't
    // disappear just because a trailing honorific happened to get trimmed
    // off the end of an otherwise-still-too-long span.
    if (!surface || rawSurface.length > 220 || !/[\p{L}]/u.test(surface)) continue;
    narratorMentions.push({
      position: narratorMentions.length + 1,
      branch: 1 + branchMarkers.filter((marker) => marker.start < start).length,
      transmissionTerm: term,
      transmissionTermSpan: { start, end: termEnd, text: term },
      sourceSpan: { start, end, text: chainText.slice(start, end) },
      surface,
      identity: null,
      reviewState: "machine-suggested"
    });
  }
  // The matn portion (everything after `chainEnd`) can still contain
  // artifacts that `cleanOpenitiText()`'s line-based stripping missed:
  //   - leftover "@MATN@" boundary markers: proposeStructure only needs
  //     the *first* occurrence to detect the chain/matn boundary; a
  //     report can contain more than one (e.g. Tirmidhi reports quoting a
  //     second narration), and later occurrences were previously left in
  //     the displayed text verbatim.
  //   - a stray digit glued directly onto a closing quotation mark at the
  //     very end of the matn (an OpenITI footnote/reference marker that
  //     survived `cleanOpenitiText()`'s line-based stripping because it
  //     wasn't on its own recognized line). Scoped narrowly to
  //     end-of-string immediately after a closing quote, since legitimate
  //     Arabic prose essentially never ends with a bare digit touching
  //     the quote mark with no separating space — this avoids stripping
  //     real numerals that appear elsewhere in the text.
  // `chainText` (0..chainEnd) is never affected by either artifact — the
  // first "@MATN@"/quote occurrence IS the boundary, so nothing before it
  // needs cleaning. To keep the corpus's surface-preservation guarantee
  // (offsets are always exact code-point positions into the *returned*
  // text) intact, the cleaned matn text is used to rebuild a canonical
  // `text` alongside consistently recomputed spans, rather than cleaning
  // matnSpan.text while leaving the original (still-dirty) text/offsets
  // as the record's normalizedText.
  const cleanMatnText = (value) => value
    .replace(/@MATN@/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/([»"])\s*\d+\s*$/u, "$1");
  const matnText = matnStart >= 0 ? cleanMatnText(text.slice(matnStart)) : "";
  const canonicalText = matnStart >= 0 ? (matnText ? `${chainText} ${matnText}` : chainText) : chainText;
  const matnSpanStart = chainText.length + 1;
  return {
    text: canonicalText,
    boundaryMethod: method,
    chainSpan: { start: 0, end: chainEnd, text: chainText },
    matnSpan: matnStart >= 0 && matnText ? { start: matnSpanStart, end: matnSpanStart + matnText.length, text: matnText } : null,
    transmissionTerms,
    branchMarkers,
    branchCount: branchMarkers.length + 1,
    narratorMentions,
    reviewState: "machine-suggested"
  };
}
