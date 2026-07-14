# Interface theme contract

This document must be reviewed before every user-interface change.

## Direction

The product uses a calm, white, scholarly workbench appearance. It should feel trustworthy, spacious, readable, and suitable for long research sessions. It must not drift into a dark dashboard, neon developer tool, decorative religious poster, or generic corporate analytics product.

## Required rules

- Use a light color scheme only.
- Keep the page background near white and cards white.
- Use dark, high-contrast body text.
- Use restrained green as the primary action and navigation color.
- Use restrained gold only as a small accent, not as a dominant background.
- Preserve generous spacing, clear hierarchy, and readable line lengths.
- Give Arabic source text ample size and line height, with correct right-to-left behavior.
- Prefer borders and subtle tonal separation over heavy shadows.
- Keep controls understandable without technical knowledge.
- Preserve visible keyboard focus, a skip link, responsive behavior, and sufficient contrast.
- Use plain-language labels and always show provenance and review state near scholarly data.

## Current design tokens

The source of truth is `web/styles.css`. Existing values should be reused unless a deliberate, tested theme revision is documented.

- Page background: `#f7f9f8`
- Primary green: use the existing `--green` token
- Accent gold: use the existing `--gold` token
- Muted text and borders: use the existing `--muted` and `--line` tokens
- Browser declaration: `color-scheme: light`

## Review checklist

Before marking UI work complete, verify:

1. The screen is unmistakably light and white.
2. Arabic and English text are readable at common desktop and mobile widths.
3. Keyboard focus and navigation remain visible.
4. Loading, empty, and failure states follow the same theme.
5. New components reuse existing colors, spacing, radii, and typography.
6. Automated theme checks still pass.

## Related documents

- [GOAL.md](GOAL.md) defines the product direction.
- [DONE.md](DONE.md) records verified work.
- [NEXT.md](NEXT.md) defines upcoming work.

