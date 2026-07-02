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
  "renderViewport": {
    "width": 1440,
    "height": 900,
    "reason": "actual browser viewport to render, independent from source image pixel size"
  },
  "referenceTarget": "renderViewport",
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
  "nestedComponents": [
    {
      "id": "primary-button-label",
      "parentId": "primary-button",
      "bounds": { "x": 128, "y": 304, "width": 78, "height": 16 },
      "tolerance": 8,
      "notes": "nested child must stay inside the parent component"
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
3. Decide the actual browser `renderViewport`; do not default to source image size when the image is a framed export or scaled mockup.
4. Use `referenceTarget: "renderViewport"` when the cropped reference should be resized to the actual browser viewport before comparison.
5. Segment the content image into major regions before naming components.
6. Add `bounds` for every major region, repeated component family, nested child component, and icon that must be validated.
7. Inventory every visible text string that can be read.
8. Estimate typography by relative hierarchy first, then pixel values.
9. Sample colors from visible surfaces, text, borders, shadows, and accents.
10. Record spacing using a consistent grid where possible.
11. Distinguish code-native UI from asset slots.
12. Log uncertainty instead of silently inventing details.

## Multi-Image Site Manifest

When the user provides multiple screenshots that belong to one site or app, create a site manifest in addition to any per-page analysis. The manifest is the contract for building and validating one cohesive product.

```json
{
  "html": "index.html",
  "renderViewport": { "width": 1440, "height": 1080 },
  "contentBounds": {
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 1080,
    "reason": "shared crop for all reference exports"
  },
  "referenceTarget": "renderViewport",
  "minSimilarity": 0.86,
  "regionMinSimilarity": 0.9,
  "elementTolerance": 10,
  "componentTolerance": 10,
  "assetSlotTolerance": 8,
  "antiSlop": {
    "forbiddenCssIncludes": [
      "radial-gradient(",
      "backdrop-filter",
      "translateY(-3px)"
    ],
    "forbiddenVisibleText": ["lorem ipsum", "placeholder"],
    "computedRules": [
      {
        "id": "no-glass-header",
        "selector": "[data-i2h-id='shared-header']",
        "property": "backdrop-filter",
        "equals": "none"
      }
    ]
  },
  "viewportFit": false,
  "maxScrollHeightRatio": 1.03,
  "viewports": [
    { "width": 1440, "height": 1080 },
    { "width": 1024, "height": 900 },
    { "width": 390, "height": 844 }
  ],
  "responsiveRoutes": ["#/", "#/portfolio", "#/contact"],
  "pages": [
    {
      "id": "home",
      "route": "#/",
      "reference": "reference/home.png",
      "expectedText": ["Visible heading", "Primary CTA"],
      "viewportFit": true,
      "maxScrollHeightRatio": 1.03,
      "regions": [
        {
          "id": "home-hero",
          "bounds": { "x": 0, "y": 72, "width": 1440, "height": 420 },
          "minSimilarity": 0.88
        }
      ],
      "elements": [
        {
          "id": "shared-header",
          "selector": "[data-i2h-id='shared-header']",
          "bounds": { "x": 0, "y": 0, "width": 1440, "height": 72 },
          "tolerance": 8
        },
        {
          "id": "header-search",
          "selector": "[data-i2h-id='header-search']",
          "bounds": { "x": 920, "y": 20, "width": 300, "height": 40 },
          "tolerance": 10
        }
      ],
      "components": [
        {
          "id": "primary-card-media",
          "selector": "[data-i2h-id='primary-card-media']",
          "bounds": { "x": 96, "y": 520, "width": 240, "height": 140 },
          "tolerance": 8
        },
        {
          "id": "primary-card-body",
          "selector": "[data-i2h-id='primary-card-body']",
          "bounds": { "x": 96, "y": 660, "width": 240, "height": 72 },
          "tolerance": 8
        }
      ],
      "assetSlots": [
        {
          "id": "hero-product-media",
          "selector": "[data-i2h-id='hero-product-media']",
          "bounds": { "x": 700, "y": 96, "width": 620, "height": 360 },
          "fillMode": "cover",
          "expectedSrcIncludes": "hero-product",
          "tolerance": 8
        }
      ]
    }
  ],
  "interactions": [
    {
      "id": "contact-form-success",
      "route": "#/contact",
      "steps": [
        { "action": "fill", "selector": "#email", "value": "hello@example.com" },
        { "action": "click", "selector": "button[type='submit']" },
        { "action": "expectText", "text": "Message sent" }
      ]
    },
    {
      "id": "product-tab-state",
      "route": "#/product/example",
      "steps": [
        { "action": "click", "selector": "[data-product-inc]" },
        { "action": "expectText", "selector": "[data-product-qty-output]", "text": "2" },
        { "action": "click", "selector": "[data-tab='배송 안내']" },
        { "action": "expectText", "selector": "[data-product-tab-panel]", "text": "배송 일정" },
        { "action": "expectNotText", "selector": "[data-recommend-row]", "text": "현재 상품명" }
      ]
    }
  ]
}
```

### Multi-Image Required Passes

1. Cluster screenshots by shared site chrome and identify common components before implementing page-specific content.
2. Map every screenshot to a route or UI state in one app.
3. Identify interactions implied by the static images: navigation, active states, accordions, tabs, filters, forms, modals, pricing actions, newsletter signup, mobile menu, and 404 recovery.
4. Implement shared components once. Do not copy header/footer markup separately per page unless the target is a static artifact.
5. Include responsive routes that cover the most complex layouts, not only the homepage.
6. Add interaction checks that prove the converted result feels like a working site rather than a screenshot gallery.
   Use scoped `expectText` for stateful controls and `expectNotText` for self-exclusion or placeholder/AI-slop absence checks.
7. Add `regions` for high-signal areas whose failures should not be hidden by the page average: hero, app shell/header, product media, pricing cards, checkout forms, summaries, tables, and repeated card grids.
8. Add `elements` for bbox-critical DOM nodes: shared headers, nav active underline, search input, cart badge, main CTAs, form panels, and nested component containers.
9. Add `components` for detail-level implementation rate: card media/body/action parts, icon slots, button icon/label groups, form field rows, table rows, state cards, and repeated component family samples.
10. For clipped or partially hidden but semantically obvious sections, declare expected in-page structures and component gates. Product detail tabs, FAQ bodies, pricing details, checkout summaries, and account panels should not be empty just because only their header is visible.
11. Add `assetSlots` for photos/product renders/artwork. Use `expectedSrcIncludes` only when the supplied or extracted asset identity should be enforced; otherwise use geometry plus `fillMode`.
12. Add `antiSlop` when the output must reject generic AI decorations, invented copy, dramatic shadows, glass blur, page entrance animation, hover lift, alert/modal substitutes for in-page state, or other effects not visible in the reference.
13. Set `viewportFit: true` or `maxScrollHeightRatio` for screenshots that represent one fixed viewport rather than a long page capture.

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
- Use bounds relative to `renderViewport` when `referenceTarget` is `renderViewport`.
- Record nested UI pieces such as button labels, card body blocks, card media, inner icons, tab labels, and input adornments in `nestedComponents` with `parentId` so containment can be verified.
- `nestedComponents` are bbox/containment checks by default; set `regionCompare: true` only when pixel-level comparison is useful for a larger nested block.
- Include at least one desktop, one tablet or narrow desktop, and one mobile viewport in `viewports` for web pages.
- For multi-image sites, route-level screenshot similarity is necessary but insufficient; interaction pass/fail and responsive route checks are part of the quality gate.
- For high-fidelity site outputs, declare route-level `regions`, `elements`, `components`, `assetSlots`, `antiSlop`, and `viewportFit` constraints before calling the site harness. These constraints turn subjective QA issues such as wrong hero crop, oversized cards, wrong product image identity, loose form density, component-detail loss, AI slop, and accidental extra page height into reproducible failures.
- Compact controls such as quantity steppers, dropdowns with visible affordances, carousel arrows, icon buttons, and tab bodies should be listed as `components` when their width or placement affects prototype believability.
- `regions` compare cropped reference/rendered areas and should be used for visual fidelity. `elements` inspect DOM boxes and should be used for layout geometry. `assetSlots` inspect image-like slot geometry and optional media identity/object-fit.
- `components` inspect bbox and uniqueness for fine-grained parts inside a page or component family. `antiSlop` scans forbidden CSS/text/computed styles that should never appear when absent from the reference.
