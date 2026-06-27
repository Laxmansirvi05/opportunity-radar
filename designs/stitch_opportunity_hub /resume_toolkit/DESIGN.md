---
name: Opportunity Radar
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e5'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fe'
  surface-container: '#ededf9'
  surface-container-high: '#e7e7f3'
  surface-container-highest: '#e1e2ed'
  on-surface: '#191b23'
  on-surface-variant: '#434655'
  inverse-surface: '#2e3039'
  inverse-on-surface: '#f0f0fb'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006b5f'
  on-secondary: '#ffffff'
  secondary-container: '#6df5e1'
  on-secondary-container: '#006f64'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#71f8e4'
  secondary-fixed-dim: '#4fdbc8'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005048'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#faf8ff'
  on-background: '#191b23'
  surface-variant: '#e1e2ed'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: '0'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 16px
---

## Brand & Style
The design system is engineered for **Opportunity Radar**, a platform dedicated to student career advancement. The brand personality is rooted in precision, reliability, and speed—drawing inspiration from high-utility developer tools like Vercel and Linear.

The aesthetic follows a **Modern Minimalist** approach. It prioritizes functional clarity over decorative flair, utilizing generous whitespace to reduce cognitive load for students navigating complex information like internships, scholarships, and fellowships. The interface should feel "industrial-grade" yet accessible, evoking a sense of institutional trust and professional momentum.

## Colors
The palette is built on a foundation of high-contrast neutrals and purposeful accents. 

- **Primary Blue** is used for core actions and navigation, signaling stability.
- **Secondary Teal** and **Accent Indigo** provide subtle differentiation for categories and interactive states without overwhelming the visual hierarchy.
- **Surface and Background** colors use a very light grey (#FAFAFA) and pure white to create a distinct "layered" effect without relying on heavy drop shadows.
- **Borders** act as the primary structural element, using #E2E8F0 to define shapes with technical precision.

## Typography
This design system utilizes **Inter** exclusively to ensure a clean, systematic appearance. 

The hierarchy is strictly enforced. Large display styles use tight tracking (-0.02em) to appear cohesive and "architectural." Body text is optimized for readability with a 1.6 line-height ratio. Label styles are frequently used for metadata (e.g., "Deadline," "Location") to differentiate secondary information from primary content titles.

## Layout & Spacing
The layout follows a **4px baseline grid** to ensure mathematical precision in all element placements.

- **Desktop:** A 12-column fixed-width grid (1200px max) is used for the main dashboard to maintain focus. Gutters are set at 24px.
- **Mobile:** Transition to a fluid single-column layout with 16px side margins. 
- **Component Spacing:** Use the `md` (16px) unit as the standard padding for cards and input fields to maintain a spacious, breathable feel.

## Elevation & Depth
This design system avoids traditional skeuomorphism and heavy drop shadows in favor of **Tonal Layers** and **Low-Contrast Outlines**.

- **Level 0 (Background):** #FAFAFA.
- **Level 1 (Cards/Surface):** #FFFFFF with a 1px border (#E2E8F0).
- **Level 2 (Active/Hover):** A subtle 1px border color shift to Primary Blue or a very soft, diffused shadow (0px 4px 12px rgba(0,0,0,0.05)).
- **Level 3 (Modals):** Pure white with a 1px border and a medium-diffusion shadow to separate from the background.

Depth is communicated through "stacking" rather than "lifting."

## Shapes
The shape language is **Soft (0.25rem/4px)**. This choice strikes a balance between the clinical sharpness of high-finance tools and the friendly roundedness of consumer apps. 

- **Buttons & Inputs:** 4px radius.
- **Cards & Modals:** 8px (rounded-lg) to provide a clear container for content.
- **Status Badges:** 4px or fully pill-shaped (rounded-full) depending on the context of the metadata.

## Components
Consistent component behavior is vital for the "fast" feel of the design system:

- **Buttons:** Primary CTAs use high-contrast #2563EB backgrounds with white text. Secondary buttons use a white background with a 1px #E2E8F0 border. States should be immediate—0.1s transitions for hover.
- **Cards:** Flat containers with #FFFFFF fill and #E2E8F0 borders. No shadow by default. On hover, the border darkens slightly.
- **Input Fields:** Minimal 1px borders. Focus states use a 2px Primary Blue ring with an offset to ensure high visibility for accessibility.
- **Status Badges:** Use a "Soft Background" approach. For example, a "Success" badge uses #10B981 text on a 10% opacity Emerald background.
- **Lists:** Clean rows with subtle horizontal dividers. No zebra striping; use whitespace to separate items.
- **Icons:** Use 20px or 24px stroke-based icons (2px weight) to match the clean aesthetic of Inter.