---
name: image2html
description: Convert provided UI screenshots, mockups, or page images into high-fidelity HTML/CSS by forcing detailed visual analysis, structured implementation planning, and screenshot-based verification. Use when Codex needs to analyze an image and recreate it as HTML, produce a 90%-quality target implementation, or run an image-to-HTML fidelity harness with Playwright-based screenshot comparison and accessibility checks.
---

# Image2HTML

## Objective

Use this skill to turn a provided image into faithful, code-native HTML. The goal is not a rough visual approximation; the goal is a measured implementation that can approach 90% fidelity through detailed image analysis, constrained HTML/CSS generation, and repeatable harness verification.

## Required Inputs

- Source image path or attached image.
- Desired output format: default to one self-contained HTML file unless the user requests React or another stack.
- Target viewport. If omitted, use the source image dimensions.
- Fidelity target. Default to `0.90`.

If the image is low resolution, cropped, rotated, text-heavy, or contains unreadable text, record the risk before implementation and continue with best effort.

## Workflow

1. Read `references/analysis-schema.md` before analyzing the image.
2. Produce a structured analysis inventory before writing code:
   - canvas and viewport
   - layout regions and hierarchy
   - text inventory
   - typography
   - colors
   - spacing
   - components
   - raster assets
   - uncertainty log
3. Read `references/implementation-rules.md` before creating HTML/CSS.
4. Implement visible UI as semantic, code-native HTML and CSS.
5. Use `assets/templates/single-file.html` as the starting template when creating a standalone HTML deliverable.
6. Run the harness when both a reference image and output HTML are available:

```bash
npm install
npm run harness -- --reference path/to/reference.png --html path/to/output.html --out .image2html-report
```

7. Read `references/fidelity-rubric.md` when interpreting scores or deciding whether the implementation is ready.
8. Use `references/report-format.md` for the final report.

## Harness Contract

The harness is a quality gate, not the only judge. It renders the HTML at the reference viewport, captures a screenshot, computes a pixel diff, runs an accessibility scan, and writes a JSON plus Markdown report.

Treat these as hard failures:

- main layout differs from the image
- major text is missing or wrong
- elements overlap, clip, or overflow
- the page is blank or not rendered at the requested viewport
- primary controls are non-semantic when semantic HTML is available
- accessibility scan reports critical violations

## Script Map

- `scripts/normalize-image.mjs`: convert the reference image to PNG and report dimensions.
- `scripts/render-html.mjs`: render a local HTML file with Playwright and capture a screenshot.
- `scripts/compare-screenshots.mjs`: compare reference and rendered screenshots with a pixel diff.
- `scripts/check-accessibility.mjs`: run axe checks against the rendered HTML.
- `scripts/run-harness.mjs`: run the full verification pipeline and produce reports.

## Output Standard

Always report:

- source image and output HTML paths
- viewport used
- analysis assumptions and uncertainties
- harness score and pass/fail result when run
- material mismatches fixed or remaining
- manual checks that automated scoring could not prove, especially text correctness and typography nuance
