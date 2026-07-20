# Compatibility policy

This document defines how the Unified Hadith interchange model (`standardVersion`
in `schema/unified-hadith.schema.json` and `schema/unified-hadith.xsd`) is allowed
to change, and what conformance implementers can rely on between releases. It
covers the *standard*, not the workbench application version in `package.json`
(the two version numbers are independent; the workbench can ship new features at
any release while the standard version stays fixed).

## Versioning

`standardVersion` follows a two-part scheme: `MAJOR.MINOR`, currently `0.1`.

- **MINOR** version increases (`0.1` -> `0.2`) may add new optional fields,
  new enum values, or new record types, but must not remove or repurpose any
  existing required field, attribute, or enum value. A document valid under
  `0.1` remains structurally readable — though not necessarily complete — under
  a later `0.x` minor version.
- **MAJOR** version increases (`0.x` -> `1.0`, etc.) may make breaking changes:
  removing fields, changing a field's meaning, or changing an id pattern. A
  major version bump must ship with a documented migration path and, where
  feasible, a conversion script.
- While the standard is at `0.x`, it should be treated as pre-stable: the
  `0.1` -> `1.0` transition is expected to include breaking changes as the
  model is exercised against real data (see `docs/NEXT.md`). After `1.0`,
  breaking changes require a major version bump, not a silent `1.x` change.

## What "lossless" means here

`sdk/lib/xml-interchange.mjs` converts a corpus document between the JSON
and XML representations of the *same* `standardVersion` losslessly: every
field round-trips through `JSON -> XML -> JSON` unchanged, verified by
`tests/interchange-tests.mjs` against real corpus data and validated against
`schema/unified-hadith.xsd` with `xmllint`. This guarantee is about format
equivalence, not about converting between different standard versions —
there is no promise (yet) that an `0.1` document converts losslessly to some
future `0.2` shape without information loss or manual migration.

## Conformance fixtures

`data/corpus.json` and `data/narrator-authority.fixture.json` serve as the
project's conformance fixtures: deliberately small, explicitly non-historical
documents that exercise every required field, several optional fields, and
(via `tests/run-tests.mjs`) nine specific invalid-document cases that a
conforming validator must reject. An external implementation can use these
same fixtures to check its own validator's behavior against
`sdk/lib/validate-corpus.mjs`'s documented pass/fail cases.

## Command-line tools for external integration

- `node scripts/validate.mjs` — validates `data/corpus.json` and
  `data/narrator-authority.fixture.json` against their JSON Schemas plus the
  semantic rules in `sdk/lib/validate-corpus.mjs`. Exits non-zero on any
  failure, with each error printed as `path: message`.
- `node scripts/convert-corpus.mjs to-xml <input.json> <output.xml>` and
  `node scripts/convert-corpus.mjs to-json <input.xml> <output.json>` — convert
  a corpus document between the JSON and XML representations of the current
  `standardVersion`.

Both are plain Node scripts with no network access required at runtime, so
they can be run in CI or invoked from another tool via a subprocess without
depending on the workbench web application.

## Deprecation policy

Once a field, record type, or endpoint ships in a minor release, it will not
be removed without: (1) at least one minor release where it is marked
deprecated in this document and in the relevant `spec/*.md` file, and (2) a
documented replacement or migration path. Deprecation notices will be added
here as they occur; none exist yet.
