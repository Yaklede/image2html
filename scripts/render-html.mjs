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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("Usage: node scripts/render-html.mjs --html output.html --out rendered.png [--json render.json] [--width 1440] [--height 900]\n");
    return;
  }
  const html = requireArg(args, "html");
  const out = path.resolve(requireArg(args, "out"));
  const jsonOut = args.json ? path.resolve(args.json) : null;
  const width = Number(args.width || 1440);
  const height = Number(args.height || 900);
  const scale = Number(args.scale || 1);
  const fullPage = args["full-page"] === true || args["full-page"] === "true";

  if (!Number.isFinite(width) || width <= 0) throw new Error("--width must be a positive number");
  if (!Number.isFinite(height) || height <= 0) throw new Error("--height must be a positive number");

  await fs.mkdir(path.dirname(out), { recursive: true });
  if (jsonOut) await fs.mkdir(path.dirname(jsonOut), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: scale
  });

  const consoleMessages = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push({
        type: message.type(),
        text: message.text()
      });
    }
  });

  const url = toUrl(html);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({ path: out, fullPage });

  const pageState = await page.evaluate(() => {
    const body = document.body;
    const root = document.documentElement;
    return {
      title: document.title,
      bodyTextLength: body?.innerText?.trim().length ?? 0,
      bodyChildCount: body?.children?.length ?? 0,
      scrollWidth: root.scrollWidth,
      scrollHeight: root.scrollHeight,
      clientWidth: root.clientWidth,
      clientHeight: root.clientHeight,
      hasHorizontalOverflow: root.scrollWidth > root.clientWidth + 1,
      hasVerticalOverflow: root.scrollHeight > root.clientHeight + 1
    };
  });

  await browser.close();

  const report = {
    html: url,
    output: out,
    viewport: { width, height, scale, fullPage },
    page: pageState,
    consoleMessages,
    pageBlank: pageState.bodyTextLength === 0 && pageState.bodyChildCount === 0
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
