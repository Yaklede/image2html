# Implementation Rules

Use these rules when converting the structured image analysis into HTML/CSS.

## HTML Contract

- Build visible UI with semantic, code-native HTML.
- Use the screenshot as a reference, not as a full-page background.
- Use `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<button>`, `<a>`, `<form>`, `<label>`, `<input>`, `<table>`, and list elements where they match the content.
- Use raster images only for artwork, photos, screenshots inside the design, product renders, logos, and other visual assets that are not practical as native HTML.
- Add accessible names for controls and landmarks.
- Keep the document usable without JavaScript unless the target interaction requires JavaScript.

## CSS Contract

- Define stable dimensions for fixed-format areas using explicit width, height, aspect ratio, grid tracks, or min/max constraints.
- Use CSS custom properties for repeated colors, spacing, radius, and typography.
- Match the source image first. Do not "improve" colors, rounded corners, shadows, or spacing unless the user asks.
- Avoid layout drift from dynamic content. Long text must wrap deliberately or have constrained overflow behavior.
- Use responsive rules only when the user asks for responsive output or when the delivered HTML must survive a smaller viewport.

## Image Fidelity Rules

- Match first viewport composition before implementing downstream sections.
- Recreate hierarchy and density before polishing decorative details.
- Keep component families consistent. Similar buttons, cards, rows, and labels should share styles.
- If an image region is ambiguous, implement the most visually faithful simple structure and report the uncertainty.

## Prohibited Shortcuts

- Do not set the full screenshot as the body background and call it complete.
- Do not hide native text by embedding it only in a raster image when the source text is legible.
- Do not add generic AI UI decorations that do not appear in the image.
- Do not use placeholder boxes in the final output.
- Do not rely on browser-default button, input, or table typography.

## Deliverable Defaults

For a standalone deliverable:

- Start from `assets/templates/single-file.html`.
- Keep CSS in the `<style>` tag unless the user asks for separate files.
- Set `<html lang>` to the content language when known.
- Match the source viewport dimensions during verification.
