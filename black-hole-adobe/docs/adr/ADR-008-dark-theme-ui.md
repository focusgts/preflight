# ADR-008: Dark-Mode-First UI Design

## Status: Accepted

## Date: 2026-03-21

## Context

Black Hole is a developer and operations tool used primarily by technical teams during migration projects that can span weeks or months. Users include solution architects, developers, DevOps engineers, and technical project managers who spend extended periods reviewing assessment results, monitoring migration progress, and analysing code transformation outputs.

The product name and brand identity ("Black Hole") naturally lend themselves to a dark, space-themed visual language. The primary competitive landscape (Adobe Experience Cloud, DataDog, Vercel Dashboard) has established dark mode as the default for developer-facing tools.

## Decision

We adopt a dark-mode-first UI design with the following principles:

### Visual Design System

**Colour palette:**
- Background: Deep space black (#0a0a0f) with subtle blue undertones
- Surface: Dark slate (#111827, #1f2937) for cards, panels, and elevated surfaces
- Primary accent: Electric blue (#3b82f6) for interactive elements and data highlights
- Success: Emerald (#10b981) for completed states and positive metrics
- Warning: Amber (#f59e0b) for at-risk items and medium-severity findings
- Error: Red (#ef4444) for failures, blockers, and critical findings
- Text: White (#ffffff) for primary, gray-400 (#9ca3af) for secondary, gray-500 (#6b7280) for tertiary

**Typography:**
- Monospace for code snippets, paths, and technical identifiers
- Sans-serif (Inter/system font) for all other text
- Consistent size scale aligned with Tailwind CSS defaults

**Data visualisation:**
- Recharts with custom dark theme tokens
- Gradient fills on area charts (blue-to-transparent) for the "black hole" aesthetic
- Consistent colour coding across all charts: blue=progress, green=success, amber=warning, red=critical

### Space/Black Hole Theme

- Subtle particle/star background on the main dashboard (performance-optimised with CSS, not canvas)
- Gravitational pull metaphor: migration progress shown as objects moving toward the "event horizon" (completion)
- Radial score gauges that evoke planetary/orbital imagery
- Phase timeline visualised as a journey through space

### Light Mode Support

A light mode variant is available via system preference detection and manual toggle, but:
- Dark mode is the default
- All designs are created dark-first, then adapted to light
- Marketing materials and documentation screenshots use dark mode
- Light mode uses a neutral warm gray palette, not a simple colour inversion

### Accessibility

Despite the dark theme, we maintain WCAG 2.1 AA compliance:
- All text meets minimum contrast ratio of 4.5:1 against its background
- Interactive elements meet 3:1 contrast ratio against adjacent colours
- Focus indicators use a high-contrast ring (blue on dark, dark on light)
- Critical status information uses both colour and iconography (not colour alone)
- Reduced motion preference is respected for all animations

## Consequences

**Positive:**
- Reduced eye strain for users working extended hours during migration crunch periods
- Strong brand identity that differentiates from Adobe's own red-heavy UI
- Dark backgrounds make data visualisation colours more vibrant and readable
- Consistent with the tool ecosystem developers already use (VS Code, terminal, GitHub)
- Space theme provides a memorable product identity and natural metaphor for migration (things being pulled from one system to another)

**Negative:**
- Dark mode design requires careful attention to contrast ratios that are easier to achieve in light mode
- Some users in brightly lit office environments may prefer light mode
- Print styling requires a separate light-coloured theme (assessment reports exported to PDF)
- Screenshots in documentation require careful contrast management

**Mitigations:**
- Tailwind CSS dark mode classes (`dark:`) make maintaining both themes manageable
- PDF report generation uses a dedicated light theme optimised for print
- Accessibility audit included in the CI pipeline (automated contrast checking)
- System preference detection provides light mode automatically for users who prefer it

## Alternatives Considered

**Light-mode-first with dark mode toggle:** The traditional approach. However, developer tools have shifted strongly toward dark defaults. Starting with light and adapting to dark often produces a dark mode that feels like an afterthought.

**Adobe Spectrum design system:** Adobe's own design system provides dark and light modes. However, it would make Black Hole visually indistinguishable from Adobe's own tools, weakening the product's independent brand identity. We borrow Spectrum's accessibility standards but not its visual language.

**No theme support (dark only):** Simplest to implement but alienates users who need or prefer light mode. The 10-15% of users who prefer light mode in a corporate environment should not be excluded.
