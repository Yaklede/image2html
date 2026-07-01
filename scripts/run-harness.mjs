#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function requireArg(args, key) {
  if (!args[key]) {
    throw new Error(`Missing required argument --${key}`);
  }
  return args[key];
}

async function runNode(scriptName, args) {
  const scriptPath = path.join(scriptDir, scriptName);
  const { stdout } = await execFileAsync(process.execPath, [scriptPath, ...args], {
    maxBuffer: 1024 * 1024 * 20
  });
  return JSON.parse(stdout);
}

function round(value) {
  return Number(value.toFixed(4));
}

function accessibilityScore(counts) {
  const weighted =
    (counts.critical || 0) * 4 +
    (counts.serious || 0) * 2 +
    (counts.moderate || 0) * 1 +
    (counts.minor || 0) * 0.25 +
    (counts.unknown || 0) * 1;
  return round(Math.max(0, 1 - weighted / 10));
}

function parseCrop(value) {
  if (!value) return null;
  const [x, y, width, height] = String(value).split(",").map(Number);
  if ([x, y, width, height].some((part) => !Number.isFinite(part))) {
    throw new Error(`Invalid --crop "${value}", expected x,y,width,height`);
  }
  return { x, y, width, height };
}

function normalizeBox(box) {
  if (!box) return null;
  return {
    left: Math.round(Number(box.x)),
    top: Math.round(Number(box.y)),
    width: Math.round(Number(box.width)),
    height: Math.round(Number(box.height))
  };
}

function escapeSvg(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function readJson(file) {
  if (!file) return null;
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function assetMasks(spec) {
  if (!spec?.assetSlots) return [];
  return spec.assetSlots
    .filter((slot) => slot && slot.bounds && slot.required !== false && slot.maskCompare !== false)
    .map((slot) => ({
      id: slot.id,
      bounds: slot.bounds,
      fill: slot.maskFill || "#ffffff"
    }));
}

async function prepareReference({ input, output, jsonOut, crop, resizeTo }) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  if (jsonOut) await fs.mkdir(path.dirname(jsonOut), { recursive: true });

  let image = sharp(input, { limitInputPixels: false }).rotate();
  const sourceMeta = await image.metadata();
  const normalizedSource = {
    width: sourceMeta.width,
    height: sourceMeta.height,
    format: sourceMeta.format
  };

  if (crop) {
    image = image.extract(normalizeBox(crop));
  }

  if (resizeTo) {
    image = image.resize({
      width: Number(resizeTo.width),
      height: Number(resizeTo.height),
      fit: "fill"
    });
  }

  await image.png().toFile(output);
  const meta = await sharp(output).metadata();
  const report = {
    input,
    output,
    format: meta.format,
    width: meta.width,
    height: meta.height,
    channels: meta.channels,
    density: meta.density ?? null,
    crop: crop || null,
    resizeTo: resizeTo || null,
    source: normalizedSource
  };

  if (jsonOut) await fs.writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function writeMaskedImage({ input, output, masks }) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  const image = sharp(input, { limitInputPixels: false });
  const meta = await image.metadata();
  const rects = masks
    .map((mask) => {
      const box = normalizeBox(mask.bounds);
      return `<rect x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" fill="${escapeSvg(mask.fill)}" />`;
    })
    .join("");
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">${rects}</svg>`
  );
  await image.composite([{ input: overlay, left: 0, top: 0 }]).png().toFile(output);
}

async function extractImageRegion({ input, output, bounds }) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(input).extract(normalizeBox(bounds)).png().toFile(output);
}

async function writeEdgeMap(input, output) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  const { data, info } = await sharp(input, { limitInputPixels: false })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const edges = Buffer.alloc(info.width * info.height);
  const at = (x, y) => data[y * info.width + x];

  for (let y = 1; y < info.height - 1; y += 1) {
    for (let x = 1; x < info.width - 1; x += 1) {
      const gx =
        -at(x - 1, y - 1) +
        at(x + 1, y - 1) +
        -2 * at(x - 1, y) +
        2 * at(x + 1, y) +
        -at(x - 1, y + 1) +
        at(x + 1, y + 1);
      const gy =
        -at(x - 1, y - 1) +
        -2 * at(x, y - 1) +
        -at(x + 1, y - 1) +
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1);
      edges[y * info.width + x] = Math.min(255, Math.round(Math.hypot(gx, gy)));
    }
  }

  await sharp(edges, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 1
    }
  })
    .png()
    .toFile(output);
}

async function writeShadowMap(input, output) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(input)
    .greyscale()
    .blur(3)
    .linear(1.8, -90)
    .normalise()
    .png()
    .toFile(output);
}

function expectedItems(spec) {
  if (!spec) return [];
  return [
    ...(spec.regions || []),
    ...(spec.components || []),
    ...(spec.nestedComponents || []).map((item) => ({ regionCompare: false, ...item })),
    ...(spec.icons || []),
    ...(spec.assetSlots || []).map((slot) => ({ regionCompare: false, ...slot }))
  ].filter((item) => item && item.id && item.bounds && item.required !== false);
}

async function compareDiagnostics({ reference, rendered, outDir, threshold }) {
  const edgeReference = path.join(outDir, "edge-reference.png");
  const edgeRendered = path.join(outDir, "edge-rendered.png");
  const edgeDiff = path.join(outDir, "edge-diff.png");
  const edgeJson = path.join(outDir, "edge-compare.json");
  const shadowReference = path.join(outDir, "shadow-reference.png");
  const shadowRendered = path.join(outDir, "shadow-rendered.png");
  const shadowDiff = path.join(outDir, "shadow-diff.png");
  const shadowJson = path.join(outDir, "shadow-compare.json");

  await writeEdgeMap(reference, edgeReference);
  await writeEdgeMap(rendered, edgeRendered);
  const edge = await runNode("compare-screenshots.mjs", [
    "--reference",
    edgeReference,
    "--rendered",
    edgeRendered,
    "--diff",
    edgeDiff,
    "--json",
    edgeJson,
    "--threshold",
    threshold
  ]);

  await writeShadowMap(reference, shadowReference);
  await writeShadowMap(rendered, shadowRendered);
  const shadow = await runNode("compare-screenshots.mjs", [
    "--reference",
    shadowReference,
    "--rendered",
    shadowRendered,
    "--diff",
    shadowDiff,
    "--json",
    shadowJson,
    "--threshold",
    threshold
  ]);

  return {
    edge,
    shadow,
    outputs: {
      edgeReference,
      edgeRendered,
      edgeDiff,
      shadowReference,
      shadowRendered,
      shadowDiff
    }
  };
}

async function compareRegions({ spec, reference, rendered, outDir, threshold }) {
  const regions = expectedItems(spec).filter((item) => item.regionCompare !== false);
  const regionDir = path.join(outDir, "regions");
  const results = [];
  for (const region of regions) {
    const safeId = region.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const referenceCrop = path.join(regionDir, `${safeId}-reference.png`);
    const renderedCrop = path.join(regionDir, `${safeId}-rendered.png`);
    const diff = path.join(regionDir, `${safeId}-diff.png`);
    const json = path.join(regionDir, `${safeId}.json`);
    try {
      await extractImageRegion({ input: reference, output: referenceCrop, bounds: region.bounds });
      await extractImageRegion({ input: rendered, output: renderedCrop, bounds: region.bounds });
      const compare = await runNode("compare-screenshots.mjs", [
        "--reference",
        referenceCrop,
        "--rendered",
        renderedCrop,
        "--diff",
        diff,
        "--json",
        json,
        "--threshold",
        threshold
      ]);
      results.push({
        id: region.id,
        bounds: region.bounds,
        compare,
        pass: compare.similarity >= Number(region.minSimilarity ?? 0.86)
      });
    } catch (error) {
      results.push({
        id: region.id,
        bounds: region.bounds,
        pass: false,
        error: error.message
      });
    }
  }
  return {
    total: results.length,
    passed: results.filter((result) => result.pass).length,
    failed: results.filter((result) => !result.pass).length,
    results
  };
}

function buildMarkdown(report) {
  const layoutSection = report.layout
    ? `
## Layout BBox

- Checked: ${report.layout.total}
- Failed: ${report.layout.failed}
- Layout JSON: ${report.outputs.layout || "n/a"}
`
    : "";
  const responsiveSection = report.responsive
    ? `
## Responsive

- Checked: ${report.responsive.total}
- Failed: ${report.responsive.failed}
- Responsive JSON: ${report.outputs.responsive || "n/a"}
- Responsive screenshots: ${report.outputs.responsiveScreenshots || "n/a"}
`
    : "";
  const regionSection = report.regions
    ? `
## Region Comparison

- Checked: ${report.regions.total}
- Failed: ${report.regions.failed}
- Region crops: ${report.outputs.regions || "n/a"}
`
    : "";
  const assetSlotSection = report.assetSlots
    ? `
## Asset Slots

- Declared slots: ${report.assetSlots.total}
- Masked in global/diagnostic comparison: ${report.assetSlots.masked}
- Masked reference: ${report.assetSlots.outputs?.reference || "n/a"}
- Masked rendered: ${report.assetSlots.outputs?.rendered || "n/a"}
`
    : "";
  const diagnosticsSection = report.diagnostics
    ? `
## Edge And Shadow Diagnostics

- Edge similarity: ${report.diagnostics.edge.similarity}
- Shadow similarity: ${report.diagnostics.shadow.similarity}
- Edge diff: ${report.diagnostics.outputs.edgeDiff}
- Shadow diff: ${report.diagnostics.outputs.shadowDiff}
`
    : "";

  return `# Image2HTML Harness Report

## Summary

- Reference: ${report.reference.input}
- HTML: ${report.html.input}
- Viewport: ${report.viewport.width}x${report.viewport.height}
- Crop: ${report.reference.crop ? `${report.reference.crop.x},${report.reference.crop.y},${report.reference.crop.width},${report.reference.crop.height}` : "none"}
- Reference resized to viewport: ${report.reference.resizeTo ? `${report.reference.resizeTo.width}x${report.reference.resizeTo.height}` : "no"}
- Automated score: ${report.score.automated}
- Target score: ${report.score.target}
- Result: ${report.pass ? "PASS" : "FAIL"}

## Screenshot Comparison

- Pixel similarity: ${report.compare.similarity}
- Diff pixels: ${report.compare.diffPixels} / ${report.compare.totalPixels}
- Dimensions match: ${report.compare.dimensionsMatch}
- Diff image: ${report.compare.diff}
${assetSlotSection}

## Accessibility

- Violation count: ${report.accessibility.violationCount}
- Critical: ${report.accessibility.countsByImpact.critical}
- Serious: ${report.accessibility.countsByImpact.serious}
- Moderate: ${report.accessibility.countsByImpact.moderate}
- Minor: ${report.accessibility.countsByImpact.minor}

## Render Health

- Page blank: ${report.render.pageBlank}
- Horizontal overflow: ${report.render.page.hasHorizontalOverflow}
- Vertical overflow: ${report.render.page.hasVerticalOverflow}
- Console warnings/errors: ${report.render.consoleMessages.length}
${layoutSection}${responsiveSection}${regionSection}${diagnosticsSection}

## Manual Checks Still Required

- Verify exact visible text and small labels against the source image.
- Verify typography personality, icon metaphors, and subtle shadows manually.
- Inspect the reference, rendered screenshot, and diff side by side before final acceptance.
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("Usage: node scripts/run-harness.mjs --reference reference.png --html output.html [--spec analysis.json] [--crop x,y,width,height] [--viewports 1280x900,390x844] [--out .image2html-report] [--target 0.90] [--threshold 0.1] [--mask-assets false]\n");
    return;
  }
  const referenceInput = path.resolve(requireArg(args, "reference"));
  const htmlInput = path.resolve(requireArg(args, "html"));
  const specPath = args.spec ? path.resolve(args.spec) : null;
  const spec = await readJson(specPath);
  const outDir = path.resolve(args.out || ".image2html-report");
  const target = Number(args.target || 0.9);
  const threshold = String(args.threshold || 0.1);
  const crop = parseCrop(args.crop) || spec?.contentBounds || null;
  const responsiveMode = spec?.responsiveMode || "web-page";
  const renderViewport = spec?.renderViewport || spec?.viewport || null;
  const resizeReferenceToRenderViewport = Boolean(renderViewport && spec?.referenceTarget === "renderViewport");

  await fs.mkdir(outDir, { recursive: true });

  const normalizedPath = path.join(outDir, "reference.png");
  const normalizedJson = path.join(outDir, "reference.json");
  const renderedPath = path.join(outDir, "rendered.png");
  const renderedJson = path.join(outDir, "render.json");
  const maskedReferencePath = path.join(outDir, "masked-reference.png");
  const maskedRenderedPath = path.join(outDir, "masked-rendered.png");
  const diffPath = path.join(outDir, "diff.png");
  const compareJson = path.join(outDir, "compare.json");
  const accessibilityJson = path.join(outDir, "accessibility.json");
  const layoutJson = path.join(outDir, "layout.json");
  const responsiveJson = path.join(outDir, "responsive.json");
  const reportJson = path.join(outDir, "report.json");
  const reportMd = path.join(outDir, "report.md");

  const reference = await prepareReference({
    input: referenceInput,
    output: normalizedPath,
    jsonOut: normalizedJson,
    crop,
    resizeTo: resizeReferenceToRenderViewport ? renderViewport : null
  });
  const viewport = renderViewport
    ? { width: Number(renderViewport.width), height: Number(renderViewport.height) }
    : { width: reference.width, height: reference.height };

  const render = await runNode("render-html.mjs", [
    "--html",
    htmlInput,
    "--out",
    renderedPath,
    "--json",
    renderedJson,
    "--width",
    String(viewport.width),
    "--height",
    String(viewport.height)
  ]);

  const masks = args["mask-assets"] === "false" ? [] : assetMasks(spec);
  let compareReferencePath = normalizedPath;
  let compareRenderedPath = renderedPath;
  if (masks.length) {
    await writeMaskedImage({ input: normalizedPath, output: maskedReferencePath, masks });
    await writeMaskedImage({ input: renderedPath, output: maskedRenderedPath, masks });
    compareReferencePath = maskedReferencePath;
    compareRenderedPath = maskedRenderedPath;
  }

  const compare = await runNode("compare-screenshots.mjs", [
    "--reference",
    compareReferencePath,
    "--rendered",
    compareRenderedPath,
    "--diff",
    diffPath,
    "--json",
    compareJson,
    "--threshold",
    threshold
  ]);

  const diagnostics = await compareDiagnostics({
    reference: compareReferencePath,
    rendered: compareRenderedPath,
    outDir,
    threshold
  });

  const regions = spec
    ? await compareRegions({
        spec,
        reference: normalizedPath,
        rendered: renderedPath,
        outDir,
        threshold
      })
    : null;

  const accessibility = await runNode("check-accessibility.mjs", [
    "--html",
    htmlInput,
    "--json",
    accessibilityJson,
    "--width",
    String(viewport.width),
    "--height",
    String(viewport.height)
  ]);

  const layout = spec
    ? await runNode("inspect-layout.mjs", [
        "--html",
        htmlInput,
        "--spec",
        specPath,
        "--json",
        layoutJson,
        "--width",
        String(viewport.width),
        "--height",
        String(viewport.height),
        "--tolerance",
        String(spec?.layoutTolerance ?? 8)
      ])
    : null;

  const responsive =
    spec && responsiveMode !== "fixed-artifact"
      ? await runNode("responsive-check.mjs", [
          "--html",
          htmlInput,
          "--json",
          responsiveJson,
          "--out-dir",
          path.join(outDir, "responsive"),
          "--viewports",
          args.viewports || (spec.viewports || []).map((item) => `${item.width}x${item.height}`).join(",") || `${viewport.width}x${viewport.height},1280x900,390x844`
        ])
      : null;

  const a11yScore = accessibilityScore(accessibility.countsByImpact);
  const dimensionScore = compare.dimensionsMatch ? 1 : 0.85;
  const layoutScore = layout ? (layout.total ? round(layout.passed / layout.total) : 1) : 1;
  const regionScore = regions ? (regions.total ? round(regions.passed / regions.total) : 1) : 1;
  const responsiveScore = responsive ? (responsive.total ? round(responsive.passed / responsive.total) : 1) : 1;
  const diagnosticScore = round((diagnostics.edge.similarity + diagnostics.shadow.similarity) / 2);
  const automated = round(
    compare.similarity * 0.48 +
      dimensionScore * 0.06 +
      a11yScore * 0.1 +
      layoutScore * 0.16 +
      regionScore * 0.1 +
      responsiveScore * 0.06 +
      diagnosticScore * 0.04
  );
  const pass =
    automated >= target &&
    compare.similarity >= Math.min(0.88, target) &&
    accessibility.countsByImpact.critical === 0 &&
    !render.pageBlank &&
    (!layout || layout.failed === 0) &&
    (!responsive || responsive.failed === 0) &&
    (!regions || regions.failed === 0);

  const report = {
    reference: { input: referenceInput, normalized: normalizedPath, ...reference },
    html: { input: htmlInput },
    spec: specPath,
    viewport,
    render,
    compare,
    diagnostics,
    regions,
    accessibility,
    layout,
    responsive,
    assetSlots: spec
      ? {
          total: spec.assetSlots?.length || 0,
          masked: masks.length,
          masks,
          outputs: {
            reference: masks.length ? maskedReferencePath : null,
            rendered: masks.length ? maskedRenderedPath : null
          }
        }
      : null,
    score: {
      automated,
      target,
      accessibility: a11yScore,
      dimension: dimensionScore,
      layout: layoutScore,
      region: regionScore,
      responsive: responsiveScore,
      diagnostics: diagnosticScore
    },
    pass,
    outputs: {
      reportJson,
      reportMd,
      reference: normalizedPath,
      rendered: renderedPath,
      maskedReference: masks.length ? maskedReferencePath : null,
      maskedRendered: masks.length ? maskedRenderedPath : null,
      diff: diffPath,
      accessibility: accessibilityJson,
      layout: spec ? layoutJson : null,
      responsive: responsive ? responsiveJson : null,
      responsiveScreenshots: responsive ? path.join(outDir, "responsive") : null,
      regions: regions ? path.join(outDir, "regions") : null,
      edgeDiff: diagnostics.outputs.edgeDiff,
      shadowDiff: diagnostics.outputs.shadowDiff
    }
  };

  await fs.writeFile(reportJson, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(reportMd, buildMarkdown(report));

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!pass) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
