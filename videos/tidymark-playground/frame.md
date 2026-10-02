---
version: alpha
name: Daisy Days — Frame (video / frame layer)
description: >
  Video-first companion to Daisy Days' design.md. The unit is the frame (1920×1080). Atoms are
  identical and sacred — the sunny-garden pastel palette (cream + turquoise/pink/butter/mint/
  lavender/peach/sky + coral accent), charcoal 3px outlines, hard offset shadows (6/4px, no blur),
  the Fredoka + Bricolage Grotesque pairing, generous radii, headline text-shadow on color, dot bullets, and
  the hand-drawn SVG ornament layer. Composition + frame scale rewritten. Motion out of scope.
unit: the frame — 1920×1080 primary; 9:16 and 1:1 documented
principle: atoms are sacred · composition is free · numbers come from the script

colors:
  cream: "#F3F0E7"
  turquoise: "#A9D8FF"
  soft-pink: "#ECFAC5"
  butter: "#F5C451"
  mint: "#C8F25A"
  lavender: "#CBB6FF"
  peach: "#FAE2A9"
  sky: "#A9D8FF"
  coral: "#C8F25A"
  text-dark: "#18181A"
  text-muted: "#6B6B6B"
  white: "#FFFFFF"

borders: { primary: "3px solid text-dark", thin: "2px solid text-dark" }
shadows: { default: "6px 6px 0 text-dark", small: "4px 4px 0 text-dark", text-headline: "3px 3px 0 text-dark", text-headline-soft: "3px 3px 0 rgba(0,0,0,0.2)" }

typography:
  # — reading ramp (Bricolage Grotesque) —
  body:    { fontFamily: "Bricolage Grotesque", cqw: 0.95, weight: 500, lineHeight: 1.6 }
  body-strong:{ fontFamily: "Bricolage Grotesque", cqw: 0.95, weight: 600, lineHeight: 1.5 }
  meta:    { fontFamily: "Bricolage Grotesque", cqw: 0.78, weight: 600, lineHeight: 1.45 }
  # — display ramp (Bricolage Grotesque / Fredoka 600 — single weight, never italic) —
  badge:   { fontFamily: "Bricolage Grotesque", cqw: 0.9, tracking: "0.02em" }
  label-display:{ fontFamily: "Bricolage Grotesque", cqw: 1.3, lineHeight: 1.3, tracking: "0.02em" }
  subtitle:{ fontFamily: "Bricolage Grotesque", cqw: 1.8, lineHeight: 1.2, tracking: "0.02em" }
  quote:   { fontFamily: "Bricolage Grotesque", cqw: 2.6, lineHeight: 1.35 }
  title:   { fontFamily: "Bricolage Grotesque", cqw: 3.0, lineHeight: 1.15, tracking: "0.02em" }
  headline:{ fontFamily: "Bricolage Grotesque", cqw: 4.5, lineHeight: 1.1, tracking: "0.02em" }
  display: { fontFamily: "Bricolage Grotesque", cqw: 6.5, lineHeight: 1.1, tracking: "0.02em" }

spacing:
  pad-slide: "3cqw"
  radius: "20px"
  radius-lg: "28px"
  radius-pill: "50px"
  radius-round: "50%"

components:
  card:
    backgroundColor: "{colors.white}"
    border: "3px solid {colors.text-dark}"
    rounded: "{spacing.radius} (28px featured)"
    shadow: "6px 6px 0 {colors.text-dark}"
    description: "The universal container; white-on-pastel is standard."
  framed-header:
    backgroundColor: "pastel cap + {colors.white} body"
    border: "3px solid {colors.text-dark} (one continuous)"
    rounded: "{spacing.radius-lg}"
    shadow: "6px 6px 0 {colors.text-dark}"
    description: "Pastel header strip flush above a white body — one unit, one shadow."
  badge-pill:
    backgroundColor: "{colors.butter}"
    border: "3px solid {colors.text-dark}"
    rounded: "{spacing.radius-pill}"
    typography: "{typography.badge}"
    shadow: "4px 4px 0 {colors.text-dark}"
    description: "Section tag. white-space:nowrap."
  circle-marker:
    backgroundColor: "any pastel"
    textColor: "{colors.white} (dark on butter)"
    border: "3px solid {colors.text-dark}"
    rounded: "50%"
    size: "bullet 20 / icon 44 / dot 48 / step 90"
    typography: "Fredoka numeral"
    description: "Steps carry a small shadow."
  bullet-dot:
    backgroundColor: "{colors.butter}"
    border: "2px solid {colors.text-dark}"
    rounded: "50%"
    size: "20px (::before, 4px from line top)"
    description: "Lists never use glyph bullets."
  ornament:
    type: "hand-drawn SVG (daisy, star, sun, cloud, rainbow)"
    stroke: "2.1px {colors.text-dark}"
    placement: "z-index:1 behind content (z-index:2), cropping past the frame edge"
    description: "3–7 per frame, clustered at corners/edges."
  quote-mark:
    typography: "oversized Fredoka quote glyph"
    color: "{colors.soft-pink} (charcoal stroke)"
    description: "Above a quote body."
  text-headline-shadow:
    shadow: "3px 3px 0 {colors.text-dark} (soft 20% variant on pink/mint)"
    appliesTo: "Fredoka headlines on saturated surfaces (cream headlines sit flat)"
    description: "Makes the headline read 'outlined' like the shapes."
---

# Daisy Days — Frame (video / frame layer)

## Brand adaptation (READ FIRST — the frontmatter is the source of truth)

This is the **daisy-days** preset remixed onto the captured brand. The YAML frontmatter above (colors · typography · components) is **normative and already correct — use it verbatim.** The prose below is the ORIGINAL preset's intent; read it THROUGH the frontmatter:

- **Fonts** — already set to **Bricolage Grotesque** (display) / **Instrument Sans** (body); ignore any preset font name lingering in prose.
- **Weights** — the brand font ships `{400, 500, 600, 700, 800}` only; every weight is clamped to these — ignore higher preset weights (e.g. 600/700) in prose.
- **Colors** — use the frontmatter hex; preset color NAMES in prose (e.g. "cobalt", "cream") mean the remapped brand values.


## Overview

Daisy Days at frame scale is a **cheerful, childlike system** — picture-book illustration meets
sticker-sheet kawaii. Every shape carries a **3px charcoal outline**, every elevated element a
**solid hard offset shadow** (no blur), every surface a sunny-garden pastel. The voice is one
pairing: **Bricolage Grotesque** (chunky rounded, single weight) for every headline, **Bricolage Grotesque** for
every body and meta line. The signature is the **hand-drawn SVG ornament layer** — daisies, stars,
suns, clouds, rainbows clustering at corners and cropping past the edge.

The palette is **multi-pastel with one warm pop**: cream canvas, seven pastel surfaces, and
`{colors.coral}` reserved for small high-attention markers only. Headlines on a saturated surface
get a 3px charcoal text-shadow (so they read "outlined" like the shapes) and switch to white;
headlines on cream sit flat in charcoal. Depth is 2D and graphic — thick outline + hard offset =
sticker-on-paper.

**Key characteristics at frame scale:**

- **Cream default + rotating pastel surfaces**; `{colors.coral}` is a marker accent, never a surface.
- **Bricolage Grotesque** headlines + **Bricolage Grotesque 500/600** body — strict by role, never crossed.
- **3px charcoal outline + hard offset shadow** (6/4px, zero blur) on every elevated shape.
- **Generous radii** — 20px cards, 28px featured, pill badges, full-circle markers; no square corners.
- **Headline text-shadow on saturated surfaces** (white text); flat charcoal on cream.
- **Dot bullets** (outlined butter discs, never glyphs) + a **3–7 ornament wreath** per frame.

## The Frame

### Frame Craft Bar

Three eyeball tests gate every frame before any structural check:

- **Squint** — one Fredoka headline or content card dominates at 3–6× its neighbor.
- **Silence** — **one content container per frame** surrounded by an ornament wreath; the **info-card grid is the one dense exception**. Empty corners read as broken.
- **Restraint** — cream or **one** pastel surface; coral is a small-marker accent (never a surface); charcoal borders + hard offset shadows only; no ninth color.
- **Reference** — aim at a **children's picture-book / sticker-sheet kawaii zine**; failure looks like a **flat, square-cornered, blurred-shadow corporate slide**.

- **Primary:** 1920×1080 (16:9). Display authored in **`cqw`** (`px ÷ 1920 × 100 = cqw`).
- **Vertical:** 1080×1920 (9:16). **Square:** 1080×1080 (1:1).
- **Safe area:** `pad-slide` ~3cqw; ornaments deliberately bleed past the edge.

**The container law (load-bearing).** Every frame ground sets `container-type: size`; ALL
frame-relative units are `cqw`/`cqh` against it — never `vw`. Borders stay 3px/2px; radii stay
20/28/50px; shadow offsets scale in `cqw` so the sticker offset holds proportionally.

## Colors

Tokens identical to the source. Default ground `{colors.cream}`; rotate saturated pastels
(turquoise / soft-pink / butter / mint / lavender / peach / sky) for tonal mood. **Cards are white**
on any surface. **Borders + shadows are always `{colors.text-dark}` charcoal** — never colored,
never blurred, never `rgba` (save the soft text-shadow variant). `{colors.coral}` is the lone
high-saturation accent — small markers (step circles, dots, headers) **only**, never a surface.
Body is charcoal/muted; pastels carry **no semantic meaning**. No ninth color.

## Typography

Two ramps. The **reading ramp** (Bricolage Grotesque 500 body 0.95cqw, 600 emphasis, meta) carries copy; the
**display ramp** (Bricolage Grotesque `label-display` 1.3cqw → `display` 6.5cqw, single weight) carries
every headline, title, quote, and marker numeral.

- **Legibility floor:** any load-bearing line ≥ **1.4cqw**; meta is chrome only.
- **Fit-to-measure:** size the headline to its length. Cap the block at **≤ 78cqw**; ≤3 words → `display`; 4–6 → `headline`; 7+ → `title`.
- **Bricolage Grotesque for all display, Bricolage Grotesque for all body — never crossed.** Fredoka is single-weight (no italic, no underline, no alt weights); Bricolage Grotesque stays 500/600/700. Fredoka tracking 0.02em; Bricolage Grotesque body never uppercase.

## Depth & Surface

2D graphic depth — hard offset shadow, solid charcoal, zero blur, bottom-right:

- **`shadows.default` 6px** cards, frames, badges, chart containers.
- **`shadows.small` 4px** small cards, step circles, avatars.
- **Text-headline shadow** — 3px charcoal on Fredoka headlines over saturated surfaces (20% soft variant on pink/mint); cream headlines flat.
- **Outline + offset** together are the sticker-on-paper signature.

**Ceiling:** no blurred shadow, no `rgba` (except the soft text-shadow), no gradient, no glow; an element either casts a hard charcoal offset or none.

## Shapes

- **20px** cards, **28px** featured, **50px** pill (badges, counter), **50%** all circles, **4px** legend swatch. Zero square corners — every region is rounded.

## Components

- **card / framed-header** — the white-fill bordered containers (one shadow). **badge-pill** — butter section tag.
- **circle-marker** family (bullet 20 / icon 44 / dot 48 / step 90) + **bullet-dot** — outlined pastel discs, Fredoka numerals.
- **ornament** — the hand-drawn SVG sticker layer (3–7 per frame). **quote-mark** — soft-pink Fredoka anchor. **text-headline-shadow** — the on-color headline treatment.

## Frame Treatments

> Recipe: ground · container · composes · focal · chrome · accent · silence · Fixed/Free · density.
> One content container per frame + a 3–7 ornament wreath; empty corners read as broken.

### 1 · Cover (identity · move: ornament wreath · saturated · centered)

**Ground** a saturated pastel (e.g. `{colors.turquoise}`). **Composes** badge-pill, display, body sub, 3–7 ornaments, counter. **Focal** a 1–2 line Fredoka `display` in **white with the 3px charcoal text-shadow**, centered, under a butter badge-pill. **Chrome** counter pill. **Accent** the ornament wreath (daisies + stars at corners, cropping past edges). **Silence** content centered; ornaments fill the edges. **Fixed** text-shadow on color, 3px outlines, charcoal shadows. **Free** surface color, ornament mix/positions, copy. **Density** full-but-not-crowded.

### 2 · Info Cards (catalog · move: 3-up white cards · cream · the dense frame)

**Ground** `{colors.cream}`, `pad-slide`. **Composes** headline (flat charcoal), 3× card (circle-icon + Fredoka title + Bricolage Grotesque body), a couple ornaments. **Focal** three white 3px-bordered cards with 6px shadows. **Chrome** flat headline. **Accent** the pastel circle-icons (rotate turquoise/coral/lavender). **Silence** tight — the density exception (fewer ornaments here). **Fixed** white cards, 3px + 6px, 20px radius. **Free** card content, icon hues. **Density** dense-exception.

### 3 · Process Steps (sequence · move: rotating circle markers · peach · centered)

**Ground** `{colors.peach}` (or another pastel). **Composes** headline (white + text-shadow), 3–4 step circles + `→` arrows, ornaments. **Focal** a row of 90px outlined step circles, fills **rotating coral → mint → sky → lavender**, Fredoka white numerals, linked by Fredoka arrows. **Chrome** white headline with text-shadow. **Accent** the rotating circle fills. **Silence** moderate. **Fixed** 3px circles + small shadow, rotating fills, arrow glyphs. **Free** step count, labels. **Density** standard.

### 4 · Quote (quote · move: quote-mark anchor · soft-pink · centered)

**Ground** `{colors.soft-pink}`. **Composes** a white quote card (28px radius, 6px shadow), quote-mark, Fredoka quote, Bricolage Grotesque attribution, ornaments. **Focal** a Fredoka `quote` in charcoal inside the white card, under an oversized soft-pink quote-mark. **Chrome** Bricolage Grotesque 700 attribution. **Accent** the quote-mark + a star or two. **Silence** card centered, ornaments at corners. **Fixed** quote-mark anchor, white card. **Free** quote, attribution. **Density** moderate.

### 5 · Framed Section (feature · move: cap+body card · cream)

**Ground** `{colors.cream}`. **Composes** framed-header (pastel cap + white body), bullet-dot list, ornaments. **Focal** a framed-header — a pastel cap strip (Fredoka title, optional text-shadow) above a white body with a butter-dot bullet list. **Accent** the cap color + bullet dots. **Silence** moderate. **Fixed** one continuous 3px border + one shadow, butter dot bullets. **Free** cap color, list. **Density** standard.

### 6 · Closing (closer · move: ornament wreath · saturated · centered)

**Ground** a saturated pastel (e.g. `{colors.lavender}`). **Composes** badge-pill, display (white + text-shadow), 3–7 ornaments. **Focal** a Fredoka `display` sign-off in white with the charcoal text-shadow, centered. **Accent** the ornament wreath. **Silence** content centered. **Fixed** text-shadow on color, ornaments fill corners. **Free** sign-off, surface, ornaments. **Density** full.

## Composition Rules

### Do

- Pair **Bricolage Grotesque headlines + Bricolage Grotesque body** strictly by role.
- Outline every shape **3px charcoal + a hard offset shadow** (6/4px, no blur); white card fills on any surface.
- Give Fredoka headlines on **saturated surfaces a 3px charcoal text-shadow + white text**; flat charcoal on cream.
- Use **outlined butter-disc bullets** (never glyphs); cluster **3–7 hand-drawn ornaments** per frame (corners, cropping past edges).
- Keep **one content container per frame**; rotate marker colors (coral → mint → sky → lavender → butter); reserve coral for small markers.
- Center most frames; lean cream for content-dense frames, saturated for cover/closer/quote.

### Don't

- No square corners; no blurred or `rgba` shadows (save the soft text-shadow).
- No colored borders (charcoal only); no coral surface; no ninth color.
- No third font; no Bricolage Grotesque headline or Fredoka body; no italic/underline Fredoka; no uppercase Bricolage Grotesque body.
- No glyph bullets; no empty corners (ornaments fill them); no two competing content panels.
- Don't blow a headline edge-to-edge — fit to measure.

## Aspect-Ratio Behavior

| Treatment      | 16:9                       | 9:16                             | 1:1        |
| -------------- | -------------------------- | -------------------------------- | ---------- |
| Cover          | centered, corner ornaments | centered, taller, more ornaments | centered   |
| Info Cards     | 3 across                   | stacked                          | 2+1        |
| Process Steps  | horizontal + arrows        | vertical, arrows rotate down     | 2×2        |
| Quote          | centered card              | centered, taller                 | centered   |
| Framed Section | cap + body                 | cap + body taller                | cap + body |
| Closing        | centered, wreath           | centered, wreath                 | centered   |

`pad-slide` holds on the short edge; re-step display above the 1.4cqw floor. On tighter ratios keep
the ornament count toward the upper end (5–7) so corners never read empty.

## Approved Real Entities

No real customers, logos, or vendors are defined in the source — render any such mark as a
placeholder. Ornaments and pastels are content-agnostic; counters/badges carry per-deck text.

## Numerals & Claims (hard rule)

Never invent figures, dates, or counts at frame scale. Render slots as `— figure —`, `{metric}`,
`N`. Step numbers and any chart values carry placeholders until the script supplies them; the slide
counter is decorative chrome.

## Pre-Render Self-Audit

- **Squint** — one Fredoka headline or content card dominates per frame.
- **Silence** — one container per frame surrounded by an ornament wreath; only the info-card grid runs dense.
- **Color** — cream or one pastel surface; coral markers only; charcoal borders/shadows; no ninth hue.
- **Type** — Fredoka headlines (text-shadow + white on saturated, flat charcoal on cream), Bricolage Grotesque body; ≥1.4cqw floor.
- **Depth** — 3px outline + hard offset (no blur, no rgba save soft text-shadow); rounded corners only.
- **Ornaments** — 3–7 per frame, cropping past edges; no empty corners. **Bullets** — outlined discs, never glyphs.
- **Fabrication** — every numeral traces to the script, else placeholder.

## Known Gaps

- **Motion intentionally out of scope.** frame.md specifies composition only; the source uses scroll-snap nav, no transition spec.
- **Fonts:** the source names _Fredoka One_; Google now serves the **Fredoka** variable family — request `Fredoka:wght@500;600;700` and set display weight 600 (visually equal to Bricolage Grotesque), with `Bricolage Grotesque` kept first in the stack for environments that still serve it. Bricolage Grotesque loads normally. CJK: ZCOOL XiaoWei (display) / Yozai (body).
- **9:16 / 1:1 are guidance**; keep ornament count high so corners stay filled per ratio.
- Ornaments (daisy/star/sun/cloud/rainbow), markers, and framed headers are CSS/SVG-only; recoloring SVG ornaments requires editing their stroke values.
- **Contrast:** keep `{colors.text-muted}` off pastel surfaces (cream/white cards only); small text on saturated grounds should be charcoal or white.


## Font loading (auto-generated)

The brand font ships as local files in `assets/fonts/` — do NOT link Google Fonts for it. Paste this `<style>` into every frame's `<head>`/`<template>` (captions use the same files) so `font-family` resolves in preview, snapshot, and render alike:

```html
<style>
@font-face{
  font-family: 'Bricolage Grotesque';
  font-style: normal;
  font-weight: 500;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGHInHWVyNJtvI.woff2") format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
}
@font-face{
  font-family: 'Bricolage Grotesque';
  font-style: normal;
  font-weight: 500;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGGInHWVyNJtvI.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Bricolage Grotesque';
  font-style: normal;
  font-weight: 500;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGIInHWVyNJ.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'Bricolage Grotesque';
  font-style: normal;
  font-weight: 700;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGHInHWVyNJtvI.woff2") format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
}
@font-face{
  font-family: 'Bricolage Grotesque';
  font-style: normal;
  font-weight: 700;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGGInHWVyNJtvI.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Bricolage Grotesque';
  font-style: normal;
  font-weight: 700;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGIInHWVyNJ.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'Bricolage Grotesque';
  font-style: normal;
  font-weight: 800;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGHInHWVyNJtvI.woff2") format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
}
@font-face{
  font-family: 'Bricolage Grotesque';
  font-style: normal;
  font-weight: 800;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGGInHWVyNJtvI.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Bricolage Grotesque';
  font-style: normal;
  font-weight: 800;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGIInHWVyNJ.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'Instrument Sans';
  font-style: normal;
  font-weight: 400;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-pxiTypc9vsFDm051Uf6KVwgkfoSxQ0GsQv8ToedPibnr0She1ZuWi3hKpA.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Instrument Sans';
  font-style: normal;
  font-weight: 400;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-pxiTypc9vsFDm051Uf6KVwgkfoSxQ0GsQv8ToedPibnr0SZe1ZuWi3g.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'Instrument Sans';
  font-style: normal;
  font-weight: 500;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-pxiTypc9vsFDm051Uf6KVwgkfoSxQ0GsQv8ToedPibnr0She1ZuWi3hKpA.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Instrument Sans';
  font-style: normal;
  font-weight: 500;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-pxiTypc9vsFDm051Uf6KVwgkfoSxQ0GsQv8ToedPibnr0SZe1ZuWi3g.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'Instrument Sans';
  font-style: normal;
  font-weight: 600;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-pxiTypc9vsFDm051Uf6KVwgkfoSxQ0GsQv8ToedPibnr0She1ZuWi3hKpA.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Instrument Sans';
  font-style: normal;
  font-weight: 600;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-pxiTypc9vsFDm051Uf6KVwgkfoSxQ0GsQv8ToedPibnr0SZe1ZuWi3g.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'Instrument Sans';
  font-style: normal;
  font-weight: 700;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-pxiTypc9vsFDm051Uf6KVwgkfoSxQ0GsQv8ToedPibnr0She1ZuWi3hKpA.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'Instrument Sans';
  font-style: normal;
  font-weight: 700;
  font-stretch: 100%;
  font-display: swap;
  src: url("assets/fonts/captured-pxiTypc9vsFDm051Uf6KVwgkfoSxQ0GsQv8ToedPibnr0SZe1ZuWi3g.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx3cwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxTcwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxPcwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx_cwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx7cwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwgknk-4.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx3cwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxTcwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxPcwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx_cwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx7cwgknk-6nFg.woff2") format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
@font-face{
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("assets/fonts/captured-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwgknk-4.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
</style>
```

## Mapping correction
The automatic remixer mapped the blue and violet slots to yellow tints. Corrected sky/turquoise to the actual website sky #A9D8FF, lavender to #CBB6FF, mint to #C8F25A, and cream to the actual paper #F3F0E7. Exact captured brand colors take precedence.
