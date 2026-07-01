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
  "layout": [
    {
      "id": "header",
      "role": "navigation",
      "bounds": { "x": 0, "y": 0, "width": 1440, "height": 72 },
      "children": ["brand", "nav", "actions"],
      "notes": "fixed-height top bar"
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
      "name": "primary button",
      "htmlRole": "button/link",
      "states": ["default", "hover", "focus"],
      "visualNotes": "8px radius, solid fill"
    }
  ],
  "assets": [
    {
      "name": "product image",
      "type": "raster",
      "bounds": { "x": 760, "y": 160, "width": 520, "height": 420 },
      "extraction": "crop or recreate"
    }
  ],
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
2. Segment the image into major regions before naming components.
3. Inventory every visible text string that can be read.
4. Estimate typography by relative hierarchy first, then pixel values.
5. Sample colors from visible surfaces, text, borders, shadows, and accents.
6. Record spacing using a consistent grid where possible.
7. Distinguish code-native UI from raster assets.
8. Log uncertainty instead of silently inventing details.

## Quality Rules

- Preserve exact visible copy when legible.
- Do not invent extra headings, pills, badges, stats, or explanatory copy.
- Prefer semantic component names tied to the image, not generic names.
- Treat unreadable text as a risk that needs manual verification.
