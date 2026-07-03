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
- For multiple screenshots that represent one product/site, treat them as one cohesive site with shared layout, routing, state, and components, not as unrelated standalone pages.
- Target viewport. If omitted, use the source image dimensions.
- Fidelity target. Default to `0.90`.
- `contentBounds` when the image includes browser chrome, OS chrome, whitespace, or surrounding presentation that should not be recreated.
- `renderViewport` when the actual browser viewport differs from the source image pixel dimensions.

If the image is low resolution, cropped, rotated, text-heavy, or contains unreadable text, record the risk before implementation and continue with best effort.

## Workflow

1. Read `references/analysis-schema.md` before analyzing the image.
2. Produce a structured analysis inventory before writing code:
   - canvas and viewport
   - excluded regions and content bounds
   - layout regions and hierarchy
   - render viewport and responsive viewport set
   - text inventory
   - typography
   - colors
   - spacing
   - components
   - nested components and parent-child containment
   - icon sizes and positions
   - shadow/border expectations
   - asset slots for image-like regions
   - uncertainty log
   - for multi-image sites: route map, shared components, per-page deltas, common footer/header, interactive states, and expected user flows
3. Read `references/implementation-rules.md` before creating HTML/CSS.
4. Implement visible UI as semantic, code-native HTML and CSS.
5. Add `data-i2h-id` to every major region, component, and icon listed in the analysis spec.
6. Use `assets/templates/single-file.html` as the starting template when creating a standalone HTML deliverable.
7. Run the harness when both a reference image and output HTML are available.
   When this skill is installed through OpenDock, run the harness from the installed skill folder. OpenDock installs dependencies for this folder through dependency mode:

```bash
npm --prefix .codex/skills/image2html run harness -- --reference path/to/reference.png --html path/to/output.html --spec path/to/analysis.json --out .image2html-report
```

   When using the npm package directly from another project, install it as a dev dependency or run through `npx`:

```bash
npm install -D @yaklede/image2html
npx image2html-harness --reference path/to/reference.png --html path/to/output.html --spec path/to/analysis.json --out .image2html-report
```

   When working from the skill repository itself, install dependencies in the repository root:

```bash
npm install
npm run harness -- --reference path/to/reference.png --html path/to/output.html --spec path/to/analysis.json --out .image2html-report
```

Use `--crop x,y,width,height` when no spec exists but the screenshot includes non-content chrome.

For multiple images that form one site, create a site manifest and run:

```bash
npm --prefix .codex/skills/image2html run site-harness -- --manifest path/to/site-manifest.json --out .image2html-site-report
```

When working from this repository, use:

```bash
npm run site-harness -- --manifest path/to/site-manifest.json --out .image2html-site-report
```

The site manifest must map each reference image to a route or state in the same HTML/app, declare shared `renderViewport` and crop rules, list responsive routes, and include interaction checks for menus, forms, filters, accordions, modals, or other stateful UI implied by the images.
For high-fidelity multi-image sites, also declare critical `regions`, `elements`, `components`, `assetSlots`, `antiSlop`, and `viewportFit` constraints so the harness fails routes whose average score hides hero, header, product image, form density, component-detail, AI-slop, or screen-fit mismatches.

8. Read `references/fidelity-rubric.md` when interpreting scores or deciding whether the implementation is ready.
9. Use `references/report-format.md` for the final report.

## Harness Contract

The harness is a quality gate, not the only judge. It crops the reference to content bounds when provided, optionally normalizes it to `renderViewport`, renders the HTML at the actual browser viewport, captures a screenshot, masks declared asset slots, computes global and region diffs, runs layout bbox and nested containment inspection, writes responsive screenshots plus sanity checks, runs edge/shadow diagnostics and accessibility checks, then writes JSON plus Markdown reports.

Treat these as hard failures:

- main layout differs from the image
- a critical region such as hero, header, product media, form panel, or checkout summary falls below its route-level region threshold
- major text is missing or wrong
- elements overlap, clip, or overflow
- a reference that represents one viewport renders substantially taller than that viewport when `viewportFit` or `maxScrollHeight` is declared
- the page is blank or not rendered at the requested viewport
- a web page is implemented as a fixed-size static canvas unless explicitly requested
- a web page is fitted to the source image dimensions instead of the intended `renderViewport`
- multiple images from one site are delivered as disconnected static pages with no shared navigation, state, or reusable components
- implied site interactions such as navigation, forms, filters, accordions, modals, pricing CTAs, or mobile menus are inert
- browser/OS chrome is recreated when it should be excluded from the delivered page
- `data-i2h-id` elements are missing or outside bbox tolerance
- declared `elements` or shared chrome such as headers, nav items, search inputs, CTAs, and icon buttons are missing or outside bbox tolerance
- declared `components` such as card media/body/action parts, button labels/icons, form fields, state cards, and nested UI pieces are missing or outside bbox tolerance
- nested child components escape or materially misalign inside their parent components
- icon size or position differs materially from the analysis spec
- declared `antiSlop` checks find forbidden CSS, invented visible copy, excessive generic effects, or reference-inconsistent decoration
- image-like regions are approximated with low-quality CSS/SVG instead of being represented as fillable asset slots
- declared image/product asset slots are missing, mis-sized, use the wrong object fit, or do not reference the expected asset when `expectedSrcIncludes` is declared
- primary controls are non-semantic when semantic HTML is available
- accessibility scan reports critical violations

## Script Map

- `scripts/normalize-image.mjs`: convert the reference image to PNG and report dimensions.
- `scripts/render-html.mjs`: render a local HTML file with Playwright and capture a screenshot.
- `scripts/compare-screenshots.mjs`: compare reference and rendered screenshots with a pixel diff.
- `scripts/check-accessibility.mjs`: run axe checks against the rendered HTML.
- `scripts/inspect-layout.mjs`: compare `data-i2h-id` DOM boxes against the analysis spec.
- `scripts/responsive-check.mjs`: check desktop/mobile overflow and fixed-canvas failures.
- `scripts/run-harness.mjs`: run the full verification pipeline and produce reports.
- `scripts/run-site-harness.mjs`: run multi-reference site verification across routes, responsive views, and interaction flows.

## Output Standard

Always report:

- source image and output HTML paths
- viewport used
- analysis assumptions and uncertainties
- harness score and pass/fail result when run
- content crop used, if any
- layout bbox, region diff, edge/shadow, responsive, and accessibility results
- component pass rate and anti-slop pass rate when declared
- render viewport used, plus whether the reference was resized to it
- asset slots left empty, masked comparison status, and the expected files/inputs needed to fill them
- material mismatches fixed or remaining
- manual checks that automated scoring could not prove, especially text correctness and typography nuance
- for multi-image sites, route-level scores, responsive screenshots, interaction pass/fail, and any intentional dynamic-state deviations from static screenshots
