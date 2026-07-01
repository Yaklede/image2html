#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

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

function buildMarkdown(report) {
  return `# Image2HTML Harness Report

## Summary

- Reference: ${report.reference.input}
- HTML: ${report.html.input}
- Viewport: ${report.viewport.width}x${report.viewport.height}
- Automated score: ${report.score.automated}
- Target score: ${report.score.target}
- Result: ${report.pass ? "PASS" : "FAIL"}

## Screenshot Comparison

- Pixel similarity: ${report.compare.similarity}
- Diff pixels: ${report.compare.diffPixels} / ${report.compare.totalPixels}
- Dimensions match: ${report.compare.dimensionsMatch}
- Diff image: ${report.compare.diff}

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

## Manual Checks Still Required

- Verify exact visible text and small labels against the source image.
- Verify typography personality, icon metaphors, and subtle shadows manually.
- Inspect the reference, rendered screenshot, and diff side by side before final acceptance.
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("Usage: node scripts/run-harness.mjs --reference reference.png --html output.html [--out .image2html-report] [--target 0.90] [--threshold 0.1]\n");
    return;
  }
  const referenceInput = path.resolve(requireArg(args, "reference"));
  const htmlInput = path.resolve(requireArg(args, "html"));
  const outDir = path.resolve(args.out || ".image2html-report");
  const target = Number(args.target || 0.9);
  const threshold = String(args.threshold || 0.1);

  await fs.mkdir(outDir, { recursive: true });

  const normalizedPath = path.join(outDir, "reference.png");
  const normalizedJson = path.join(outDir, "reference.json");
  const renderedPath = path.join(outDir, "rendered.png");
  const renderedJson = path.join(outDir, "render.json");
  const diffPath = path.join(outDir, "diff.png");
  const compareJson = path.join(outDir, "compare.json");
  const accessibilityJson = path.join(outDir, "accessibility.json");
  const reportJson = path.join(outDir, "report.json");
  const reportMd = path.join(outDir, "report.md");

  const reference = await runNode("normalize-image.mjs", [
    "--input",
    referenceInput,
    "--out",
    normalizedPath,
    "--json",
    normalizedJson
  ]);

  const render = await runNode("render-html.mjs", [
    "--html",
    htmlInput,
    "--out",
    renderedPath,
    "--json",
    renderedJson,
    "--width",
    String(reference.width),
    "--height",
    String(reference.height)
  ]);

  const compare = await runNode("compare-screenshots.mjs", [
    "--reference",
    normalizedPath,
    "--rendered",
    renderedPath,
    "--diff",
    diffPath,
    "--json",
    compareJson,
    "--threshold",
    threshold
  ]);

  const accessibility = await runNode("check-accessibility.mjs", [
    "--html",
    htmlInput,
    "--json",
    accessibilityJson,
    "--width",
    String(reference.width),
    "--height",
    String(reference.height)
  ]);

  const a11yScore = accessibilityScore(accessibility.countsByImpact);
  const dimensionScore = compare.dimensionsMatch ? 1 : 0.85;
  const automated = round(compare.similarity * 0.75 + dimensionScore * 0.1 + a11yScore * 0.15);
  const pass =
    automated >= target &&
    compare.similarity >= Math.min(0.88, target) &&
    accessibility.countsByImpact.critical === 0 &&
    !render.pageBlank;

  const report = {
    reference: { input: referenceInput, normalized: normalizedPath, ...reference },
    html: { input: htmlInput },
    viewport: { width: reference.width, height: reference.height },
    render,
    compare,
    accessibility,
    score: {
      automated,
      target,
      accessibility: a11yScore,
      dimension: dimensionScore
    },
    pass,
    outputs: {
      reportJson,
      reportMd,
      reference: normalizedPath,
      rendered: renderedPath,
      diff: diffPath,
      accessibility: accessibilityJson
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
