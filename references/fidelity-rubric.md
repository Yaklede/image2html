# Fidelity Rubric

Use this rubric to decide whether an image-to-HTML output is ready.

## Target

Default target quality is `0.90`. Passing the automated harness does not replace manual inspection; it only proves the rendered HTML is close under the configured viewport and accessibility checks.

## Composite Rubric

| Dimension | Weight | Evidence |
| --- | ---: | --- |
| Visual fidelity | 45 | Screenshot comparison, manual side-by-side review |
| Layout and spacing fidelity | 20 | Region positions, DOM bbox checks, dimensions, alignment, whitespace |
| Text/content fidelity | 15 | Exact visible copy, ordering, labels, numbers |
| Color and typography fidelity | 10 | Sampled colors, font scale, weight, line height, edge diagnostics |
| Semantic HTML and accessibility | 5 | Landmarks, controls, labels, axe checks |
| Responsive/code quality sanity | 5 | Stable layout, no overflow, maintainable CSS |

## Automated Harness Score

The harness computes an automated score from:

- pixel similarity between the reference and rendered screenshot
- viewport/dimension agreement
- region-level similarity for important sections/components
- DOM bbox agreement for `data-i2h-id` elements listed in the spec
- asset-slot bbox agreement for image-like regions that intentionally remain empty
- masked global pixel similarity when asset slots are declared
- edge and shadow diagnostic similarity after the same asset-slot masks are applied
- responsive overflow checks for web pages
- accessibility violations by impact

This score is intentionally conservative and does not fully measure text correctness, font personality, or semantic quality. If a spec is provided, bbox, region, and responsive failures should block pass even when the global pixel score is high.

## Hard Failures

Any item below fails the result even if the numeric score is high:

- The page is blank or a framework/browser error is visible.
- Major layout regions are missing or in the wrong order.
- Primary visible text is missing, wrong, or unreadable.
- Elements overlap, clip, overflow, or cover important content.
- The reference includes browser/OS chrome and the implementation recreates it as page content.
- A web page is implemented as a fixed-size static canvas unless explicitly requested.
- Required `data-i2h-id` elements are missing or outside bbox tolerance.
- Icons are materially wrong in size, position, stroke/fill style, or visual center.
- Component shadows are visibly larger or blurrier than the reference.
- Image-like regions are represented by low-quality approximations instead of empty fillable asset slots.
- Asset slots are missing, mis-sized, or positioned incorrectly.
- Interactive controls are not represented as semantic controls.
- Critical accessibility violations are present.
- A full-page screenshot is used as the implementation instead of code-native UI.

## Review Checklist

- Compare the reference and rendered screenshots at the same viewport.
- Compare the cropped content area, not browser chrome.
- Check at least five specific points: layout, text, typography, colors, spacing, and asset treatment.
- Inspect `layout.json`, region diffs, `edge-diff.png`, and `shadow-diff.png` when available.
- Inspect asset slots separately: they should fail only on missing/wrong geometry unless the actual asset has been supplied. The global, edge, and shadow diffs should show those slot areas masked.
- Verify all visible text that matters.
- Verify no unintended scrollbars, clipping, or overlap.
- Verify responsive sanity for at least one desktop and one mobile viewport for web-page outputs.
- Record remaining mismatch as either fixed, acceptable deviation, or blocker.
