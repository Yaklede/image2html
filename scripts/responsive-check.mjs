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

function parseViewports(value) {
  return String(value || "1440x900,1280x900,390x844")
    .split(",")
    .map((entry) => {
      const [width, height] = entry.split("x").map(Number);
      if (!Number.isFinite(width) || !Number.isFinite(height)) {
        throw new Error(`Invalid viewport "${entry}", expected WIDTHxHEIGHT`);
      }
      return { width, height };
    });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("Usage: node scripts/responsive-check.mjs --html output.html --json responsive.json [--viewports 1440x900,390x844]\n");
    return;
  }

  const html = requireArg(args, "html");
  const jsonOut = args.json ? path.resolve(args.json) : null;
  const viewports = parseViewports(args.viewports);
  if (jsonOut) await fs.mkdir(path.dirname(jsonOut), { recursive: true });

  const browser = await chromium.launch();
  const results = [];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(toUrl(html), { waitUntil: "networkidle" });
    const result = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const viewportWidth = root.clientWidth;
      const viewportHeight = root.clientHeight;
      const fixedLike = Array.from(document.querySelectorAll("body, body > *")).map((el) => {
        const style = getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          width: style.width,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          overflow: style.overflow
        };
      });
      return {
        bodyTextLength: body?.innerText?.trim().length ?? 0,
        scrollWidth: root.scrollWidth,
        scrollHeight: root.scrollHeight,
        clientWidth: viewportWidth,
        clientHeight: viewportHeight,
        hasHorizontalOverflow: root.scrollWidth > viewportWidth + 1,
        hasVerticalOverflow: root.scrollHeight > viewportHeight + 1,
        fixedLike
      };
    });
    await page.close();
    results.push({
      viewport,
      ...result,
      pass: !result.hasHorizontalOverflow && result.bodyTextLength > 0
    });
  }
  await browser.close();

  const report = {
    html: toUrl(html),
    total: results.length,
    passed: results.filter((result) => result.pass).length,
    failed: results.filter((result) => !result.pass).length,
    results
  };

  if (jsonOut) await fs.writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

