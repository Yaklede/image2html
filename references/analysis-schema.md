# Image Analysis Schema

Use this reference before writing HTML. Produce a compact structured inventory from the image so implementation decisions are traceable.

## Analysis JSON

```json
{
  "canvas": {
    "width": 1440,
    "height": 900,
    "background": "#ffffff",
    "viewportAssumption": "source image dimensions"
  },
  "contentBounds": {
    "x": 0,
    "y": 88,
    "width": 1440,
    "height": 812,
    "reason": "exclude browser chrome and address bar"
  },
  "excludedRegions": [
    {
      "id": "browser-chrome",
      "bounds": { "x": 0, "y": 0, "width": 1440, "height": 88 },
      "reason": "not part of the delivered web page"
    }
  ],
  "responsiveMode": "web-page",
  "viewports": [
    { "width": 1440, "height": 812 },
    { "width": 1280, "height": 900 },
    { "width": 390, "height": 844 }
  ],
  "layout": [
    {
      "id": "header",
      "role": "navigation",
      "bounds": { "x": 0, "y": 0, "width": 1440, "height": 72 },
      "children": ["brand", "nav", "actions"],
      "notes": "fixed-height top bar"
    }
  ],
  "regions": [
    {
      "id": "hero",
      "bounds": { "x": 96, "y": 48, "width": 1248, "height": 320 },
      "minSimilarity": 0.88
    }
  ],
  "assetSlots": [
    {
      "id": "hero-illustration-slot",
      "kind": "illustration",
      "bounds": { "x": 760, "y": 64, "width": 520, "height": 320 },
      "regionCompare": false,
      "fillMode": "cover",
      "expectedAsset": "assets/hero-illustration.svg",
      "maskFill": "#ffffff",
      "notes": "leave empty until a real asset is provided or generated"
    }
  ],
  "textInventory": [
    {
      "text": "Exact visible text",
      "bounds": { "x": 96, "y": 120, "width": 420, "height": 56 },
      "role": "heading",
      "confidence": 0.95
    }
  ],
  "typography": [
    {
      "target": "hero heading",
      "familyGuess": "sans-serif",
      "sizePx": 48,
      "weight": 700,
      "lineHeightPx": 56,
      "color": "#111827"
    }
  ],
  "colors": [
    { "name": "page background", "hex": "#ffffff", "usage": "body" },
    { "name": "primary text", "hex": "#111827", "usage": "headings" }
  ],
  "spacing": {
    "outerMargins": [96, 96],
    "grid": "8px",
    "sectionGaps": [24, 48, 80]
  },
  "components": [
    {
      "id": "primary-button",
      "name": "primary button",
      "htmlRole": "button/link",
      "bounds": { "x": 96, "y": 292, "width": 166, "height": 40 },
      "states": ["default", "hover", "focus"],
      "visualNotes": "8px radius, solid fill"
    }
  ],
  "icons": [
    {
      "id": "icon-backend",
      "bounds": { "x": 112, "y": 420, "width": 42, "height": 42 },
      "style": "outline",
      "strokeWidth": 2.2
    }
  ],
  "shadows": [
    {
      "id": "feature-card-1",
      "target": "card",
      "bounds": { "x": 96, "y": 404, "width": 280, "height": 88 },
      "maxSpreadPx": 16,
      "notes": "subtle card shadow, no large glow"
    }
  ],
  "assets": [],
  "uncertainties": [
    {
      "item": "small footer text",
      "risk": "unreadable at source resolution",
      "decision": "transcribe best effort and report"
    }
  ]
}
```

## Required Analysis Passes

1. Identify the canvas size, safe area, and background treatment.
2. If browser chrome, OS chrome, canvas padding, or presentation framing appears, record it as `excludedRegions` and set `contentBounds`.
3. Segment the content image into major regions before naming components.
4. Add `bounds` for every major region, repeated component family, and icon that must be validated.
5. Inventory every visible text string that can be read.
6. Estimate typography by relative hierarchy first, then pixel values.
7. Sample colors from visible surfaces, text, borders, shadows, and accents.
8. Record spacing using a consistent grid where possible.
9. Distinguish code-native UI from asset slots.
10. Log uncertainty instead of silently inventing details.

## Quality Rules

- Preserve exact visible copy when legible.
- Do not invent extra headings, pills, badges, stats, or explanatory copy.
- Prefer semantic component names tied to the image, not generic names.
- Treat unreadable text as a risk that needs manual verification.
- If a region looks like a photo, generated illustration, product render, screenshot, portrait, or artwork, record it as `assetSlots` instead of approximating it with CSS.
- Asset slots should keep exact bounds, aspect ratio, corner radius, background color, and optional placeholder treatment, but should not be pixel-compared until the real asset is supplied.
- Asset slots are masked in global pixel, edge, and shadow diagnostics by default. Set `maskCompare: false` only when the placeholder itself must be compared.
- Use `maskFill` to choose the neutral fill color used for both reference and rendered screenshots during masked comparison.
- For web pages, default `responsiveMode` to `web-page`; use `fixed-artifact` only for posters, static mockups, or explicit fixed-canvas requests.
- Use bounds relative to `contentBounds` for `regions`, `components`, and `icons`.
