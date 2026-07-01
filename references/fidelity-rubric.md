# Fidelity Rubric

Use this rubric to decide whether an image-to-HTML output is ready.

## Target

Default target quality is `0.90`. Passing the automated harness does not replace manual inspection; it only proves the rendered HTML is close under the configured viewport and accessibility checks.

## Composite Rubric

| Dimension | Weight | Evidence |
| --- | ---: | --- |
| Visual fidelity | 45 | Screenshot comparison, manual side-by-side review |
| Layout and spacing fidelity | 20 | Region positions, dimensions, alignment, whitespace |
| Text/content fidelity | 15 | Exact visible copy, ordering, labels, numbers |
| Color and typography fidelity | 10 | Sampled colors, font scale, weight, line height |
| Semantic HTML and accessibility | 5 | Landmarks, controls, labels, axe checks |
| Responsive/code quality sanity | 5 | Stable layout, no overflow, maintainable CSS |

## Automated Harness Score

The harness computes an automated score from:

- pixel similarity between the reference and rendered screenshot
- viewport/dimension agreement
- accessibility violations by impact

This score is intentionally conservative and does not fully measure text correctness, font personality, or semantic quality. Use it to find regressions and obvious drift.

## Hard Failures

Any item below fails the result even if the numeric score is high:

- The page is blank or a framework/browser error is visible.
- Major layout regions are missing or in the wrong order.
- Primary visible text is missing, wrong, or unreadable.
- Elements overlap, clip, overflow, or cover important content.
- Interactive controls are not represented as semantic controls.
- Critical accessibility violations are present.
- A full-page screenshot is used as the implementation instead of code-native UI.

## Review Checklist

- Compare the reference and rendered screenshots at the same viewport.
- Check at least five specific points: layout, text, typography, colors, spacing, and asset treatment.
- Verify all visible text that matters.
- Verify no unintended scrollbars, clipping, or overlap.
- Record remaining mismatch as either fixed, acceptable deviation, or blocker.
