#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

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

function toUrl(input) {
  if (/^https?:\/\//i.test(input) || input.startsWith("file://")) {
    return input;
  }
  return pathToFileURL(path.resolve(input)).href;
}

function countByImpact(violations) {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 };
  for (const violation of violations) {
    const impact = violation.impact || "unknown";
    counts[impact] = (counts[impact] ?? 0) + 1;
  }
  return counts;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("Usage: node scripts/check-accessibility.mjs --html output.html [--json accessibility.json] [--width 1440] [--height 900]\n");
    return;
  }
  const html = requireArg(args, "html");
  const jsonOut = args.json ? path.resolve(args.json) : null;
  const width = Number(args.width || 1440);
  const height = Number(args.height || 900);

  if (jsonOut) await fs.mkdir(path.dirname(jsonOut), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const url = toUrl(html);
  await page.goto(url, { waitUntil: "networkidle" });

  const results = await new AxeBuilder({ page }).analyze();
  await context.close();
  await browser.close();

  const report = {
    html: url,
    viewport: { width, height },
    violationCount: results.violations.length,
    countsByImpact: countByImpact(results.violations),
    violations: results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact || "unknown",
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodes: violation.nodes.length
    }))
  };

  if (jsonOut) {
    await fs.writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
