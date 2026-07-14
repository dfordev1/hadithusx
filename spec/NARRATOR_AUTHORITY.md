# Narrator Authority Model 0.1

The narrator authority layer records historical-person records separately from narrator mentions found in hadith witnesses. It is designed to preserve disagreement between sources rather than manufacture a single composite biography.

## Mandatory evidence rule

No biographical name, date, relationship, location, generation, or evaluation may enter a reviewed authority record without a citation containing an identified source, locator, and short evidentiary quotation. Dataset provenance and licensing are mandatory.

## Person records

A person record is a stable identity container. Each name form has its own citation. Kunya, nasab, nisba, laqab, variants, and transliterations retain their type instead of being flattened into aliases.

## Assertions

Biographical information is represented as attributed assertions. Two sources may provide different death dates or evaluations; both remain independently citable, and `supports` or `contradicts` can describe their relationship.

Teacher and student relationships are directional assertions. Chronology and network analysis may flag possible inconsistencies, but may not silently reject a source statement or grade a chain.

## Mention resolution

Links from witness mentions to authority persons are reviewable identity assertions. Surface similarity, chain position, chronology, geography, and teacher/student relationships may contribute to a candidate score. No score performs an automatic merge.

## Publication gate

`scholar-verified` requires a named, qualified reviewer under a documented review policy. Software may produce only `machine-suggested` records.

## Interface

Authority review uses the permanent white scholarly interface in `docs/THEME.md`, with source evidence and uncertainty visible beside every decision.

