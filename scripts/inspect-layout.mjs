#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

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
  if (!args[key]) throw new Error(`Missing required argument --${key}`);
  return args[key];
}

function toUrl(input) {
  if (/^https?:\/\//i.test(input) || input.startsWith("file://")) return input;
  return pathToFileURL(path.resolve(input)).href;
}

function normalizeExpectedItems(spec) {
  const groups = [
    ["components", spec.components || []],
    ["nestedComponents", spec.nestedComponents || []],
    ["icons", spec.icons || []],
    ["regions", spec.regions || []],
    ["assetSlots", spec.assetSlots || []]
  ];
  return groups.flatMap(([group, items]) =>
    items
      .filter((item) => item && item.id && item.bounds && item.required !== false)
      .map((item) => ({
        group,
        id: item.id,
        parentId: item.parentId || null,
        bounds: item.bounds,
        tolerance: item.tolerance,
        shadow: item.shadow || null
      }))
  );
}

function compareBounds(expected, actual, tolerance) {
  const deltas = {
    x: Number((actual.x - expected.x).toFixed(2)),
    y: Number((actual.y - expected.y).toFixed(2)),
    width: Number((actual.width - expected.width).toFixed(2)),
    height: Number((actual.height - expected.height).toFixed(2))
  };
  const abs = Object.values(deltas).map(Math.abs);
  const maxDelta = Number(Math.max(...abs).toFixed(2));
  return { deltas, maxDelta, pass: maxDelta <= tolerance };
}

function containsBounds(parent, child, tolerance) {
  if (!parent || !child) return { containmentPass: false, containmentReason: "missing parent or child bounds" };
  const overflows = {
    left: Number((parent.x - child.x).toFixed(2)),
    top: Number((parent.y - child.y).toFixed(2)),
    right: Number((child.x + child.width - (parent.x + parent.width)).toFixed(2)),
    bottom: Number((child.y + child.height - (parent.y + parent.height)).toFixed(2))
  };
  const maxOverflow = Number(Math.max(0, ...Object.values(overflows)).toFixed(2));
  return {
    containmentPass: maxOverflow <= tolerance,
    containmentMaxOverflow: maxOverflow,
    containmentOverflows: overflows
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("Usage: node scripts/inspect-layout.mjs --html output.html --spec analysis.json --json layout.json [--width 1440] [--height 900] [--tolerance 8]\n");
    return;
  }

  const html = requireArg(args, "html");
  const specPath = path.resolve(requireArg(args, "spec"));
  const jsonOut = args.json ? path.resolve(args.json) : null;
  const width = Number(args.width || 1440);
  const height = Number(args.height || 900);
  const defaultTolerance = Number(args.tolerance || 8);

  if (jsonOut) await fs.mkdir(path.dirname(jsonOut), { recursive: true });

  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  const expectedItems = normalizeExpectedItems(spec);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(toUrl(html), { waitUntil: "networkidle" });

  const actualItems = await page.evaluate((ids) => {
    const result = {};
    for (const id of ids) {
      const selector = `[data-i2h-id="${CSS.escape(id)}"]`;
      const el = document.querySelector(selector);
      if (!el) {
        result[id] = null;
        continue;
      }
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      result[id] = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        display: style.display,
        position: style.position,
        boxShadow: style.boxShadow,
        borderRadius: style.borderRadius,
        overflow: style.overflow
      };
    }
    return result;
  }, expectedItems.map((item) => item.id));

  await browser.close();

  const results = expectedItems.map((item) => {
    const actual = actualItems[item.id];
    const tolerance = Number(item.tolerance ?? defaultTolerance);
    if (!actual) {
      return {
        group: item.group,
        id: item.id,
        parentId: item.parentId,
        expected: item.bounds,
        actual: null,
        tolerance,
        pass: false,
        reason: "missing data-i2h-id element"
      };
    }
    const boundsResult = compareBounds(item.bounds, actual, tolerance);
    const containment =
      item.parentId && actualItems[item.parentId]
        ? containsBounds(actualItems[item.parentId], actual, tolerance)
        : item.parentId
          ? { containmentPass: false, containmentReason: `missing parent data-i2h-id element "${item.parentId}"` }
          : null;
    return {
      group: item.group,
      id: item.id,
      parentId: item.parentId,
      expected: item.bounds,
      actual,
      tolerance,
      ...boundsResult,
      ...(containment || {}),
      pass: boundsResult.pass && (!containment || containment.containmentPass)
    };
  });

  const failed = results.filter((result) => !result.pass);
  const report = {
    html: toUrl(html),
    spec: specPath,
    viewport: { width, height },
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    maxDelta: results.length
      ? Math.max(...results.map((result) => (Number.isFinite(result.maxDelta) ? result.maxDelta : 0)))
      : 0,
    results
  };

  if (jsonOut) await fs.writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
