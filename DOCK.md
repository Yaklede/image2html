# image2html

`image2html` installs a Codex skill and Playwright-based harness for turning supplied UI screenshots, mockups, or page images into high-fidelity HTML.

## What It Adds

- A Codex skill at `.codex/skills/image2html/SKILL.md`
- Image analysis, implementation, fidelity, and report reference docs
- Single-image and multi-image site harness scripts
- A standalone HTML starter template
- A package manifest for optional local harness dependencies

## When To Use It

Use this dock when a project needs repeatable image-to-HTML conversion with measurable quality gates:

- Convert one screenshot into semantic, code-native HTML/CSS
- Convert multiple screenshots into one routed, interactive site
- Verify output with Playwright screenshots and pixel comparison
- Check responsive overflow, route states, interactions, and accessibility
- Keep image-like regions as fillable asset slots instead of rough low-quality approximations

## Quality Target

The default target is `0.90` similarity. Automated checks cover pixel similarity, viewport agreement, region-level diffs, DOM bounding boxes, nested component containment, edge/shadow diagnostics, responsive sanity, and accessibility.

Manual review is still expected for text correctness, typography nuance, icon meaning, and animation feel.

## Example Result

The public repository includes a committed example that converts 10 supplied website screenshots into one functional HTML site with shared navigation, modals, accordions, filters, form feedback, a mobile drawer, and 404 recovery.

Final sample harness result:

- Average similarity: `0.9315`
- Pages: `10/10`
- Responsive checks: `12/12`
- Interactions: `6/6`

See the GitHub README for the before/after image table and generated HTML render screenshots.

## After Install

Ask Codex to use the installed `image2html` skill with a supplied image. OpenDock only applies the skill and harness files; it does not install npm packages during dock install.

When verification artifacts are available, install the harness dependencies manually once:

```bash
npm install --prefix .codex/skills/image2html
```

Then run the single-image harness:

```bash
npm --prefix .codex/skills/image2html run harness -- --reference path/to/reference.png --html path/to/output.html --out .image2html-report
```

For multiple screenshots that form one site:

```bash
npm --prefix .codex/skills/image2html run site-harness -- --manifest path/to/site-manifest.json --out .image2html-site-report
```
