#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pixelmatch from "pixelmatch";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import sharp from "sharp";

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

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function toUrl(input) {
  if (/^https?:\/\//i.test(input) || input.startsWith("file://")) return input;
  return pathToFileURL(path.resolve(input)).href;
}

function routeUrl(baseUrl, route) {
  if (!route) return baseUrl;
  if (route.startsWith("#")) return `${baseUrl}${route}`;
  return `${baseUrl}#${route.replace(/^\/+/, "")}`;
}

function reportPath(input) {
  const relative = path.relative(process.cwd(), input);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return input;
  return relative.split(path.sep).join("/");
}

function reportString(input) {
  if (input.startsWith("file://")) {
    try {
      const url = new URL(input);
      return `${reportPath(fileURLToPath(url))}${url.hash}`;
    } catch {
      return input;
    }
  }
  if (path.isAbsolute(input)) return reportPath(input);
  return input;
}

function reportValue(value) {
  if (typeof value === "string") return reportString(value);
  if (Array.isArray(value)) return value.map((item) => reportValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, reportValue(item)]));
  }
  return value;
}

function normalizeBox(box) {
  return {
    left: Math.round(Number(box.x)),
    top: Math.round(Number(box.y)),
    width: Math.round(Number(box.width)),
    height: Math.round(Number(box.height))
  };
}

async function prepareReference({ input, output, crop, resizeTo }) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  let image = sharp(input, { limitInputPixels: false }).rotate();
  const source = await image.metadata();
  if (crop) image = image.extract(normalizeBox(crop));
  if (resizeTo) {
    image = image.resize({
      width: Number(resizeTo.width),
      height: Number(resizeTo.height),
      fit: "fill"
    });
  }
  await image.png().toFile(output);
  const meta = await sharp(output).metadata();
  return {
    input,
    output,
    source: { width: source.width, height: source.height, format: source.format },
    width: meta.width,
    height: meta.height,
    crop: crop || null,
    resizeTo: resizeTo || null
  };
}

async function readPng(file) {
  return PNG.sync.read(await fs.readFile(file));
}

async function compareImages({ reference, rendered, diff, threshold = 0.1 }) {
  await fs.mkdir(path.dirname(diff), { recursive: true });
  const refPng = await readPng(reference);
  let renderedPng = await readPng(rendered);
  let renderedPathForCompare = rendered;
  const dimensionsMatch = refPng.width === renderedPng.width && refPng.height === renderedPng.height;

  if (!dimensionsMatch) {
    const resized = await sharp(rendered)
      .resize(refPng.width, refPng.height, { fit: "fill" })
      .png()
      .toBuffer();
    renderedPng = PNG.sync.read(resized);
    renderedPathForCompare = `${rendered}#resized-for-compare`;
  }

  const diffPng = new PNG({ width: refPng.width, height: refPng.height });
  const diffPixels = pixelmatch(
    refPng.data,
    renderedPng.data,
    diffPng.data,
    refPng.width,
    refPng.height,
    { threshold, includeAA: false }
  );
  await fs.writeFile(diff, PNG.sync.write(diffPng));
  const totalPixels = refPng.width * refPng.height;
  const diffRatio = diffPixels / totalPixels;
  return {
    reference,
    rendered,
    renderedPathForCompare,
    diff,
    width: refPng.width,
    height: refPng.height,
    dimensionsMatch,
    threshold,
    diffPixels,
    totalPixels,
    diffRatio: Number(diffRatio.toFixed(6)),
    similarity: Number((1 - diffRatio).toFixed(6))
  };
}

async function inspectPage(page, expectedTexts = []) {
  return page.evaluate((texts) => {
    const root = document.documentElement;
    const body = document.body;
    const activeNav = document.querySelector("[data-nav-active='true']")?.textContent?.trim() || null;
    return {
      title: document.title,
      route: window.location.hash,
      bodyTextLength: body?.innerText?.trim().length ?? 0,
      scrollWidth: root.scrollWidth,
      scrollHeight: root.scrollHeight,
      clientWidth: root.clientWidth,
      clientHeight: root.clientHeight,
      hasHorizontalOverflow: root.scrollWidth > root.clientWidth + 1,
      hasVerticalOverflow: root.scrollHeight > root.clientHeight + 1,
      activeNav,
      missingTexts: texts.filter((text) => !body.innerText.includes(text))
    };
  }, expectedTexts);
}

function locatorFor(page, selector) {
  if (!selector) throw new Error("Interaction step is missing selector");
  return page.locator(selector);
}

async function runInteractions({ page, interactions }) {
  const results = [];
  for (const interaction of interactions || []) {
    const result = { id: interaction.id, route: interaction.route, steps: [], pass: true };
    if (interaction.route) {
      await page.goto(routeUrl(page.url().split("#")[0], interaction.route), { waitUntil: "networkidle" });
      await page.waitForTimeout(350);
    }
    for (const step of interaction.steps || []) {
      if (step.action === "click") {
        await locatorFor(page, step.selector).click();
        result.steps.push({ action: "click", selector: step.selector, pass: true });
      } else if (step.action === "fill") {
        await locatorFor(page, step.selector).fill(step.value || "");
        result.steps.push({ action: "fill", selector: step.selector, pass: true });
      } else if (step.action === "expectText") {
        const visible = await page.locator("body").filter({ hasText: step.text }).count();
        const pass = visible > 0;
        result.pass = result.pass && pass;
        result.steps.push({ action: "expectText", text: step.text, pass });
      } else if (step.action === "expectSelector") {
        const pass = await locatorFor(page, step.selector).isVisible();
        result.pass = result.pass && pass;
        result.steps.push({ action: "expectSelector", selector: step.selector, pass });
      } else if (step.action === "expectRoute") {
        const pass = page.url().includes(step.route);
        result.pass = result.pass && pass;
        result.steps.push({ action: "expectRoute", route: step.route, pass, actual: page.url() });
      } else {
        result.pass = false;
        result.steps.push({ action: step.action, pass: false, error: "Unsupported action" });
      }
    }
    results.push(result);
  }
  return results;
}

async function writeReport({ outDir, manifest, pageResults, responsiveResults, interactionResults, score, pass }) {
  const reportJson = path.join(outDir, "report.json");
  const reportMd = path.join(outDir, "report.md");
  const failedPages = pageResults.filter((result) => !result.pass);
  const failedResponsive = responsiveResults.filter((result) => !result.pass);
  const failedInteractions = interactionResults.filter((result) => !result.pass);
  const lines = [
    "# Image2HTML Site Harness Report",
    "",
    "## Summary",
    "",
    `- HTML: ${reportPath(path.resolve(manifest.html))}`,
    `- Pages checked: ${pageResults.length}`,
    `- Responsive checks: ${responsiveResults.length}`,
    `- Interactions checked: ${interactionResults.length}`,
    `- Average similarity: ${score.averageSimilarity}`,
    `- Target score: ${score.target}`,
    `- Result: ${pass ? "PASS" : "FAIL"}`,
    "",
    "## Pages",
    "",
    ...pageResults.map(
      (result) =>
        `- ${result.id}: ${result.pass ? "PASS" : "FAIL"} similarity=${result.compare.similarity} route=${result.route} screenshot=${reportPath(result.screenshot)}`
    ),
    "",
    "## Responsive",
    "",
    ...responsiveResults.map(
      (result) =>
        `- ${result.route} ${result.viewport.width}x${result.viewport.height}: ${result.pass ? "PASS" : "FAIL"} overflowX=${result.health.hasHorizontalOverflow} screenshot=${reportPath(result.screenshot)}`
    ),
    "",
    "## Interactions",
    "",
    ...interactionResults.map((result) => `- ${result.id}: ${result.pass ? "PASS" : "FAIL"}`),
    "",
    "## Failures",
    "",
    `- Page failures: ${failedPages.length}`,
    `- Responsive failures: ${failedResponsive.length}`,
    `- Interaction failures: ${failedInteractions.length}`,
    "",
    "## Manual Checks Still Required",
    "",
    "- Confirm typography nuance, icon optical alignment, and animation feel against the reference pages.",
    "- Confirm modal copy and dynamic states are product-appropriate, since static screenshots cannot prove all states."
  ];

  const report = reportValue({
    manifest,
    score,
    pass,
    pages: pageResults,
    responsive: responsiveResults,
    interactions: interactionResults,
    outputs: { reportJson, reportMd }
  });
  await fs.writeFile(reportJson, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(reportMd, `${lines.join("\n")}\n`);
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("Usage: node scripts/run-site-harness.mjs --manifest site-manifest.json --out report-dir [--target 0.86]\n");
    return;
  }
  const manifestPath = path.resolve(requireArg(args, "manifest"));
  const outDir = path.resolve(requireArg(args, "out"));
  const target = Number(args.target || 0.86);
  const manifest = await readJson(manifestPath);
  manifest.html = path.resolve(path.dirname(manifestPath), manifest.html);
  const baseUrl = toUrl(manifest.html);
  const viewport = manifest.renderViewport || { width: 1440, height: 1080 };
  const settleMs = Number(manifest.settleMs ?? 350);
  const referenceCrop = manifest.contentBounds || null;

  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  const consoleMessages = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push({ type: message.type(), text: message.text() });
    }
  });

  const pageResults = [];
  for (const pageSpec of manifest.pages || []) {
    const pageDir = path.join(outDir, "pages", pageSpec.id);
    await fs.mkdir(pageDir, { recursive: true });
    const referencePath = path.resolve(path.dirname(manifestPath), pageSpec.reference);
    const normalizedReference = path.join(pageDir, "reference.png");
    await prepareReference({
      input: referencePath,
      output: normalizedReference,
      crop: pageSpec.contentBounds || referenceCrop,
      resizeTo: manifest.referenceTarget === "renderViewport" ? viewport : null
    });
    await page.goto(routeUrl(baseUrl, pageSpec.route), { waitUntil: "networkidle" });
    await page.waitForTimeout(settleMs);
    const screenshot = path.join(pageDir, "rendered.png");
    await page.screenshot({ path: screenshot, fullPage: false });
    const diff = path.join(pageDir, "diff.png");
    const compare = await compareImages({
      reference: normalizedReference,
      rendered: screenshot,
      diff,
      threshold: pageSpec.threshold || manifest.threshold || 0.1
    });
    const health = await inspectPage(page, pageSpec.expectedText || []);
    const pass =
      compare.similarity >= (pageSpec.minSimilarity || manifest.minSimilarity || target) &&
      !health.hasHorizontalOverflow &&
      health.missingTexts.length === 0;
    pageResults.push({
      id: pageSpec.id,
      route: pageSpec.route,
      reference: normalizedReference,
      screenshot,
      diff,
      compare,
      health,
      pass
    });
  }

  const responsiveResults = [];
  for (const viewportSpec of manifest.viewports || []) {
    for (const route of manifest.responsiveRoutes || ["#/"]) {
      const responsiveDir = path.join(outDir, "responsive");
      await fs.mkdir(responsiveDir, { recursive: true });
      await page.setViewportSize({ width: viewportSpec.width, height: viewportSpec.height });
      await page.goto(routeUrl(baseUrl, route), { waitUntil: "networkidle" });
      await page.waitForTimeout(settleMs);
      const routeName = route.replaceAll(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
      const screenshot = path.join(responsiveDir, `${routeName}-${viewportSpec.width}x${viewportSpec.height}.png`);
      await page.screenshot({ path: screenshot, fullPage: false });
      const health = await inspectPage(page, []);
      responsiveResults.push({
        route,
        viewport: viewportSpec,
        screenshot,
        health,
        pass: health.bodyTextLength > 0 && !health.hasHorizontalOverflow
      });
    }
  }

  await page.setViewportSize(viewport);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(settleMs);
  const interactionResults = await runInteractions({ page, interactions: manifest.interactions || [] });
  await browser.close();

  const averageSimilarity = Number(
    (pageResults.reduce((sum, result) => sum + result.compare.similarity, 0) / Math.max(1, pageResults.length)).toFixed(4)
  );
  const score = {
    averageSimilarity,
    target,
    pagePassRate: Number((pageResults.filter((result) => result.pass).length / Math.max(1, pageResults.length)).toFixed(4)),
    responsivePassRate: Number(
      (responsiveResults.filter((result) => result.pass).length / Math.max(1, responsiveResults.length)).toFixed(4)
    ),
    interactionPassRate: Number(
      (interactionResults.filter((result) => result.pass).length / Math.max(1, interactionResults.length)).toFixed(4)
    ),
    consoleWarningsErrors: consoleMessages.length
  };
  const pass =
    averageSimilarity >= target &&
    pageResults.every((result) => result.pass) &&
    responsiveResults.every((result) => result.pass) &&
    interactionResults.every((result) => result.pass) &&
    consoleMessages.length === 0;

  const report = await writeReport({
    outDir,
    manifest,
    pageResults,
    responsiveResults,
    interactionResults,
    score,
    pass
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
