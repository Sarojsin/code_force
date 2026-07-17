# Compare: Global Design Prompt (Theme)

**Design Spec File:** `mobile/UI_UX/Global_Design_Prompt.md`
**Implemented File:** `mobile/src/theme/tokens.ts`, `mobile/src/theme/ThemeProvider.tsx`

## Major Differences

| Design Spec Token | Spec Value | Implemented Value | Status |
|-------------------|-----------|-------------------|--------|
| brand.primary (Soft Blush) | #FF6B8A | #FF5C8A (palette.primary500) | Different (tokens.ts line 11) |
| brand.primaryMuted (Blush Light) | #FFB3C6 | #FFD9E1 (palette.primary100) | Different (tokens.ts line 9) |
| brand.accent (Mauve) | #D4A5B5 | #9B7BFF (accent500) | Different (tokens.ts line 17) — spec calls for mauve/pink-beige, code uses soft purple |
| brand.success (Mint) | #D4F0E0 | #4CAF50 (success500) | Different (tokens.ts line 30) — spec calls for soft pastel mint, code uses Material green |
| brand.warning (Soft Peach) | #FFDAB9 | #F4A93C (warning500) | Different (tokens.ts line 31) — spec calls for peach, code uses amber |
| brand.danger (SOS Red) | #FF0000 | #D63B3B (danger500) | Different (tokens.ts line 32) |
| bg.primary (Off-White) | #FDF8F5 | #FFF8FB (background) | Different (tokens.ts line 43) — slight variation |
| bg.surface (Warm Cream) | #FFF8F0 | #FFFFFF (palette.white) | Different (tokens.ts line 44) |
| text.secondary (Warm Gray) | #8A8A8A | #3B4151 (gray700) | Different (tokens.ts line 46) — much darker than spec |
| text.muted (Warm Gray) | #8A8A8A | #7B8194 (gray500) | Different (tokens.ts line 47) — similar but not exact |

## Missing Theme Tokens

**Font Family** — Spec says use Playfair Display for headers (line 36). Code has NO font family configuration at all (typography object at tokens.ts:96-105 only sets fontSize/fontWeight/lineHeight, no fontFamily). Entirely missing.

**Shadow tokens** — Spec defines 5 semantic shadows (lines 64-68): shadow.soft, shadow.primary, shadow.secondary, shadow.sos, shadow.wellness. Code only has sm, md, lg (tokens.ts lines 107-130) with non-matching values. All 5 spec shadows are missing.

**Gradients** — Spec defines 4 gradients (lines 29-32): Onboarding Aurora, Primary Action, SOS Emergency, Wellness Pulse. Code has no gradient tokens at all. Gradients are inlined as SVG where used.

**Radius values** — Spec says radius.xl: 20px (line 58), code has radius.xl: 24 (tokens.ts line 92). Spec says radius.pill: 24px (line 59), code has radius.pill: 999 (line 93). Radius values differ.

**Spacing** — Spec says container-margin: 20 (line 51). Code does not define a container-margin token.

**Phase colors** — Spec defines phase colors as Soft Blush (#FF6B8A), Peach (#FFDAB9), Mint (#D4F0E0), Lavender (#E8D5F5). Code defines them at tokens.ts:35-38 as menstrual: '#FF5252', follicular: '#FFD54F', ovulation: '#4CAF50', luteal: '#42A5F5'. All 4 phase colors are completely different from the spec, using bright Material colors instead of soft pastels.

**Typographic scale** — Spec defines display.logo (28px/700), display.title (24px/600), display.countdown (48px/700), body (15px), bodySmall (12px), button (15px/600), tab (11px/500). Code defines display (32px/700), h1 (24px/700), h2 (20px/600), h3 (18px/600), body (16px), bodySmall (14px), button (16px/600). Many sizes differ by 1-2px. The display.countdown (48px) and tab (11px) tokens are entirely missing.

## Line-Specific Issues

- tokens.ts line 11: brand.primary uses #FF5C8A instead of spec #FF6B8A
- tokens.ts line 9: brand.primaryMuted uses #FFD9E1 instead of spec #FFB3C6
- tokens.ts line 17: brand.accent uses #9B7BFF instead of spec #D4A5B5
- tokens.ts line 30: brand.success uses #4CAF50 instead of spec #D4F0E0
- tokens.ts line 35-38: phase colors use bright Material palette instead of spec soft pastels
