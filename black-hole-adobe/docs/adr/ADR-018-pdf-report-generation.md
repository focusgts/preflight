# ADR-018: PDF Report Generation with @react-pdf/renderer

## Status

Accepted

## Date

2026-03-22

## Context

Black Hole needs to generate professional, branded PDF assessment reports that serve as the primary sales deliverable after a free migration readiness assessment. These reports must:

- Render server-side (no browser required)
- Include charts, tables, and styled layouts
- Use consistent branding (Focus GTS / Black Hole)
- Generate quickly (under 5 seconds)
- Produce small, high-quality PDF files

### Options Considered

| Library | Approach | Pros | Cons |
|---------|----------|------|------|
| **@react-pdf/renderer** | React component tree to PDF | Same mental model as app, composable, server-side, no browser | Limited chart support (custom only), no CSS grid |
| **Puppeteer/Playwright** | Headless browser screenshot | Full HTML/CSS support, exact visual parity | Heavy dependency (~300MB), slow, requires Chrome binary |
| **jsPDF** | Imperative canvas-style API | Lightweight, mature | Tedious layout code, no component model, manual positioning |
| **pdfmake** | Declarative JSON layout | Good table support, server-side | Own DSL to learn, no React integration, limited styling |

## Decision

Use **@react-pdf/renderer** for PDF generation.

## Rationale

1. **Consistency** -- The rest of the application uses React. Building PDF layouts with the same component model reduces context switching and allows reuse of data transformation logic.

2. **Server-side rendering** -- `renderToBuffer()` runs in Node.js without a browser, making it suitable for API route generation with zero infrastructure overhead.

3. **Composability** -- Chart components (score bars, severity distributions, phase timelines) are built from primitive `View` and `Text` elements, making them testable and reusable.

4. **Performance** -- Generates a 9-page branded report in under 3 seconds. No headless browser startup cost.

5. **Bundle size** -- Adds ~2MB to server dependencies vs ~300MB for Puppeteer with Chromium.

## Trade-offs

- Charts must be hand-built from rectangles and text (no recharts/d3 in PDF context). This is acceptable because the chart types needed are simple (bars, stacked bars, gauges).
- Limited font support compared to browser rendering. Helvetica (built-in) provides adequate professional typography.
- No CSS flexbox `gap` in older versions -- spacing is handled with margins.

## Consequences

- All PDF chart components live in `src/lib/reports/charts.tsx` using @react-pdf/renderer primitives.
- Report data preparation is separated from rendering in `src/lib/reports/report-data.ts`.
- The PDF generator at `src/lib/reports/pdf-generator.tsx` assembles pages from composable components.
- API endpoint at `/api/reports/[id]/pdf` streams the generated PDF.
- Future report types (migration progress, compliance audit) can reuse the same component library.
