---
name: Heritage Ledger
colors:
  surface: '#fbf9f1'
  surface-dim: '#dcdad2'
  surface-bright: '#fbf9f1'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f4ec'
  surface-container: '#f0eee6'
  surface-container-high: '#eae8e0'
  surface-container-highest: '#e4e3db'
  on-surface: '#1b1c17'
  on-surface-variant: '#554240'
  inverse-surface: '#30312c'
  inverse-on-surface: '#f3f1e9'
  outline: '#88726f'
  outline-variant: '#dbc1bd'
  surface-tint: '#98453c'
  primary: '#410403'
  on-primary: '#ffffff'
  primary-container: '#5e1914'
  on-primary-container: '#e17e72'
  inverse-primary: '#ffb4aa'
  secondary: '#7d562d'
  on-secondary: '#ffffff'
  secondary-container: '#ffca98'
  on-secondary-container: '#7a532a'
  tertiary: '#0f2115'
  on-tertiary: '#ffffff'
  tertiary-container: '#243629'
  on-tertiary-container: '#8b9f8e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad5'
  primary-fixed-dim: '#ffb4aa'
  on-primary-fixed: '#3f0303'
  on-primary-fixed-variant: '#7a2e27'
  secondary-fixed: '#ffdcbd'
  secondary-fixed-dim: '#f0bd8b'
  on-secondary-fixed: '#2c1600'
  on-secondary-fixed-variant: '#623f18'
  tertiary-fixed: '#d3e8d5'
  tertiary-fixed-dim: '#b7ccb9'
  on-tertiary-fixed: '#0e1f13'
  on-tertiary-fixed-variant: '#394b3d'
  background: '#fbf9f1'
  on-background: '#1b1c17'
  surface-variant: '#e4e3db'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 42px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Libre Caslon Text
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  entry-text:
    fontFamily: Literata
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 30px
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Work Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  margin-page: 24px
  gutter-grid: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  safe-area-bottom: 40px
---

## Brand & Style

The design system is built on the concept of **Digital Heirlooms**. It seeks to evoke the tactile, emotional weight of a physical leather-bound journal. The target audience values reflection, slow-living, and the preservation of memories in a space that feels private and permanent.

The style is **Tactile Neoclassicism**. It blends the structural reliability of high-end editorial design with the warmth of physical materials. The UI should feel less like a software interface and more like a curated canvas, utilizing subtle paper textures, organic shadows, and a layout that prioritizes content "breathing room." The emotional response is one of safety, nostalgia, and quiet creativity.

## Colors

This design system utilizes a warm, low-contrast base to reduce eye strain and enhance the feeling of physical paper.

- **Primary (#5E1914):** A deep, oxblood burgundy. Used for key brand moments, primary buttons, and active states. It represents the "leather" of the diary.
- **Secondary (#D4A373):** A soft tan/brass. Used for decorative accents, dividers, and iconography that needs a metallic or organic feel.
- **Tertiary (#4A5D4E):** A muted hunter green. Used for secondary actions or specific category tags (e.g., "Nature" or "Growth").
- **Neutral (#FFFDF5):** The "Cream" base. This serves as the global background color, mimicking high-quality cardstock.
- **Neutral Dark (#3E2723):** Used for typography to ensure legibility while maintaining warmth; pure black is avoided.

## Typography

The typography system uses a tri-font strategy to balance utility and emotion.

- **Headlines (Libre Caslon Text):** Used for titles, dates, and screen headers. It provides the "published book" authority.
- **The Narrative (Literata):** Used for the actual diary entries. It is a "bookish" serif designed for long-form reading, offering a personal, thoughtful feel that bridges the gap between digital text and ink on paper.
- **Interface (Work Sans):** Used for navigation, buttons, labels, and settings. Its neutrality ensures the app remains functional and easy to navigate without competing with the user's content.

## Layout & Spacing

The layout philosophy follows a **Canvas Model**. Unlike rigid SaaS grids, this system uses generous margins to simulate the edges of a physical page.

- **Grid:** A simple 4-column layout for mobile, focusing on vertical stacking. 
- **The "Gutter" Margin:** Content should never touch the edge of the screen. A minimum 24px "safe margin" (the `margin-page` token) mimics the border of a scrapbook page.
- **Visual Rhythm:** Vertical spacing is intentionally loose. Use `stack-lg` between distinct journal entries or sections to allow the user's mind to rest.
- **Alignment:** Headlines are traditionally centered for a formal "title page" look, while body text remains left-aligned for readability.

## Elevation & Depth

Depth in the design system is achieved through **Soft Tactility**. We avoid harsh, artificial shadows in favor of ambient, multi-layered occlusion.

- **Paper Stacking:** Surfaces use subtle inner shadows and 1px borders in `paper_mid` to look like physical layers of paper resting on top of one another.
- **Object Shadows:** Elements like Floating Action Buttons (FABs) or "Pinned" items use a deep, diffused shadow (Blur: 20px, Y: 10px, Color: `primary_color` at 15% opacity) to feel heavy and significant.
- **Texture:** A global, low-opacity noise grain should be applied to all "Neutral" surfaces to break the digital flatness and simulate paper fibers.

## Shapes

The shape language is organic and approachable. 

- **Standard Elements:** Buttons and input fields use a medium radius (8px) to feel "well-handled" but not overly bubbly.
- **Cards & Sheets:** Large containers like journal covers or entry cards use `rounded-xl` (24px) to mimic the rounded corners of premium leather notebooks.
- **Interactive Accents:** Selection states or "highlighter" effects should have slightly irregular or hand-drawn radius qualities where possible to reinforce the scrapbook aesthetic.

## Components

- **Journal Covers:** Large cards using the `primary` or `tertiary` colors. They should feature a "spine" detail on the left edge (a 12px strip of a darker shade) and a centered label in `display-lg-mobile`.
- **The Floating Toolbar:** A bottom-anchored pill (`rounded-xl`) containing editor tools (image upload, ink, formatting). It should use a frosted glass effect (backdrop-blur) with a `neutral` tint.
- **Tactile Buttons:** Primary buttons use the `primary` color with a subtle 1px top-light highlight to create a "pressed" or "embossed" feel.
- **Memory Chips:** Small metadata tags (e.g., "Paris", "Rainy Day") using `secondary` backgrounds with `neutral` text, appearing like small strips of washi tape.
- **The Canvas Entry:** A full-width view where photos can be rotated slightly (2-3 degrees) to mimic physical placement, and text flows around them organically.
- **Input Fields:** Traditional "line" inputs (border-bottom only) are preferred over boxed inputs to mimic lined stationery.