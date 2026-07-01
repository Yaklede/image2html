# Implementation Rules

Use these rules when converting the structured image analysis into HTML/CSS.

## HTML Contract

- Build visible UI with semantic, code-native HTML.
- Use the screenshot as a reference, not as a full-page background.
- Exclude browser chrome, OS chrome, address bars, app window controls, and surrounding presentation unless the user explicitly asks to recreate them.
- Render the page at the intended browser viewport, not at the raw source image dimensions when those differ.
- Use `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<button>`, `<a>`, `<form>`, `<label>`, `<input>`, `<table>`, and list elements where they match the content.
- Use asset slots for artwork, photos, screenshots inside the design, product renders, portraits, generated illustrations, logos, and other visual assets that are not practical as native HTML.
- Recreate icons and small schematic UI glyphs as inline SVG with explicit `viewBox`, rendered dimensions, and `data-i2h-id`.
- Add accessible names for controls and landmarks.
- Keep the document usable without JavaScript unless the target interaction requires JavaScript.
- Add `data-i2h-id` to regions, components, and icons listed in the analysis spec so the harness can inspect positions.
- Add `data-i2h-id` to nested component parts listed in `nestedComponents`; keep nested children structurally inside their parent element when semantic HTML allows it.
- For multi-image site references, implement one cohesive site/app with shared header, footer, navigation, reusable components, and route/state handling.
- Map each screenshot to a route or state; do not produce separate disconnected HTML files unless the user explicitly asks for static exports.
- Implement interactions implied by the screenshots as real local UI state: active nav, mobile menu, filters/tabs, accordions, forms, modals, pricing actions, newsletter signup, and 404 recovery.

## CSS Contract

- Define stable dimensions for fixed-format areas using explicit width, height, aspect ratio, grid tracks, or min/max constraints.
- Use CSS custom properties for repeated colors, spacing, radius, and typography.
- Match the source image first. Do not "improve" colors, rounded corners, shadows, or spacing unless the user asks.
- Avoid layout drift from dynamic content. Long text must wrap deliberately or have constrained overflow behavior.
- For web pages and app screens, avoid fixed `body` width/height and `overflow: hidden`; use responsive containers and breakpoints.
- Use responsive rules by default for web-page outputs. Fixed layouts are allowed only when `responsiveMode` is `fixed-artifact`.
- Build from fluid containers (`width: min(...)`, grid/flex, breakpoints) instead of scaling a fixed desktop canvas down.
- When a component contains other components, style the parent as the layout context and let children participate in its grid/flex/flow instead of absolutely positioning unrelated siblings over it.
- For multi-page outputs, centralize tokens and component styles so repeated cards, buttons, forms, headers, footers, and nav states stay visually consistent across pages.

## Image Fidelity Rules

- Match first viewport composition before implementing downstream sections.
- Match nested component hierarchy: buttons must contain labels/icons, cards must contain media/body/action regions, and feature tiles must contain their icon/title/body blocks.
- Recreate hierarchy and density before polishing decorative details.
- Keep component families consistent. Similar buttons, cards, rows, and labels should share styles.
- If an image region is ambiguous, implement the most visually faithful simple structure and report the uncertainty.
- Match icon size, visual center, stroke/fill style, and spacing from the source.
- Match shadows conservatively. Oversized glows or blur radii should fail manual review even if the pixel score is high.
- Do not approximate complex image-like UI art with rough CSS or hand-drawn SVG. Create a fillable asset slot and report the asset needed.
- Asset slots should be empty fill targets, not partially recreated artwork. Preserve the containing box geometry and let the harness mask that box for global pixel, edge, and shadow diagnostics.

## Prohibited Shortcuts

- Do not set the full screenshot as the body background and call it complete.
- Do not hide native text by embedding it only in a raster image when the source text is legible.
- Do not add generic AI UI decorations that do not appear in the image.
- Do not use placeholder boxes in the final output.
- Do not rely on browser-default button, input, or table typography.
- Do not ship a fixed full-screen canvas for a web page just because the reference was a full screenshot.
- Do not make the screenshot pixel dimensions the CSS page dimensions unless `responsiveMode` is `fixed-artifact`.
- Do not approximate icons with text glyphs when SVG geometry is practical.
- Do not approximate image-like regions so poorly that they look blurred, smeared, or misleading. Leave them empty as slots instead.
- Do not convert multiple site screenshots into an inert gallery of page-looking sections with no working routes or state.
- Do not duplicate shared site chrome with divergent measurements across pages when the screenshots show the same component system.

## Deliverable Defaults

For a standalone deliverable:

- Start from `assets/templates/single-file.html`.
- Keep CSS in the `<style>` tag unless the user asks for separate files.
- Set `<html lang>` to the content language when known.
- Match the source viewport dimensions during verification.
- Prefer `renderViewport` from the analysis spec over raw image dimensions during verification.
- Run the harness with `--spec analysis.json` whenever the analysis includes bounds.
- Run `npm run site-harness -- --manifest site-manifest.json --out report-dir` for multi-image site outputs.
- For asset slots, set `data-i2h-id`, preserve position/size/radius, set `regionCompare: false`, and let the harness mask the slot until a real asset is present.
