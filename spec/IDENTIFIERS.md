# Identifier Policy

Identifiers are lowercase ASCII strings beginning with `uh:` and a type.

```text
uh:work:bukhari-sahih
uh:edition:demo-source-1
uh:witness:demo-intentions-1
uh:isnad:demo-intentions-1:a
uh:mention:demo-intentions-1:a:01
uh:person:demo-al-humaydi
uh:claim:demo-identity-001
uh:alignment:demo-intentions-family-001
```

Rules:

1. IDs identify records, not mutable labels.
2. IDs are never recycled.
3. Merged records retain redirects and provenance.
4. A witness ID is local to a source occurrence, not a universal hadith number.
5. Person IDs do not encode disputed dates, grades, or lineage.
6. Token IDs are formed from the witness ID plus a stable token position.

