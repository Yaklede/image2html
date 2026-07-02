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

function compareBounds(expected, actual, tolerance) {
  const deltas = {
    x: Number((actual.x - expected.x).toFixed(2)),
    y: Number((actual.y - expected.y).toFixed(2)),
    width: Number((actual.width - expected.width).toFixed(2)),
    height: Number((actual.height - expected.height).toFixed(2))
  };
  const maxDelta = Number(Math.max(...Object.values(deltas).map((value) => Math.abs(value))).toFixed(2));
  return { deltas, maxDelta, pass: maxDelta <= tolerance };
}

function verticalFitSpec(pageSpec, manifest, viewport) {
  const enabled = Boolean(pageSpec.viewportFit ?? manifest.viewportFit);
  const absolute = pageSpec.maxScrollHeight ?? manifest.maxScrollHeight;
  const ratio = pageSpec.maxScrollHeightRatio ?? manifest.maxScrollHeightRatio;
  if (absolute) {
    return {
      enabled: true,
      maxScrollHeight: Number(absolute),
      reason: "absolute maxScrollHeight"
    };
  }
  if (enabled || ratio) {
    const resolvedRatio = Number(ratio ?? 1.03);
    return {
      enabled: true,
      maxScrollHeight: Math.round(Number(viewport.height) * resolvedRatio),
      ratio: resolvedRatio,
      reason: "viewportFit ratio"
    };
  }
  return { enabled: false, maxScrollHeight: null };
}

async function extractRegion({ input, output, bounds }) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(input, { limitInputPixels: false }).extract(normalizeBox(bounds)).png().toFile(output);
}

async function compareRegions({ reference, rendered, outDir, regions, threshold, defaultMinSimilarity }) {
  const results = [];
  for (const region of regions || []) {
    if (!region || region.required === false || !region.bounds) continue;
    const regionDir = path.join(outDir, region.id || `region-${results.length + 1}`);
    const referenceCrop = path.join(regionDir, "reference.png");
    const renderedCrop = path.join(regionDir, "rendered.png");
    const diff = path.join(regionDir, "diff.png");
    await extractRegion({ input: reference, output: referenceCrop, bounds: region.bounds });
    await extractRegion({ input: rendered, output: renderedCrop, bounds: region.bounds });
    const compare = await compareImages({
      reference: referenceCrop,
      rendered: renderedCrop,
      diff,
      threshold: region.threshold || threshold
    });
    const minSimilarity = Number(region.minSimilarity ?? defaultMinSimilarity);
    results.push({
      id: region.id || `region-${results.length + 1}`,
      bounds: region.bounds,
      minSimilarity,
      compare,
      pass: compare.similarity >= minSimilarity
    });
  }
  return results;
}

async function inspectElements(page, checks, defaultTolerance) {
  const requested = (checks || [])
    .filter((item) => item && item.required !== false)
    .map((item, index) => ({ ...item, id: item.id || `element-${index + 1}` }));
  if (!requested.length) return [];
  const actual = await page.evaluate((items) => {
    const result = {};
    for (const item of items) {
      const selector = item.selector || `[data-i2h-id="${CSS.escape(item.id)}"]`;
      const nodes = [...document.querySelectorAll(selector)];
      if (!nodes.length) {
        result[item.id] = { count: 0, selector, actual: null };
        continue;
      }
      const el = nodes[0];
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const media = el.matches("img,picture,video,canvas")
        ? el
        : el.querySelector("img,picture,video,canvas");
      const mediaStyle = media ? getComputedStyle(media) : null;
      result[item.id] = {
        count: nodes.length,
        selector,
        actual: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          display: style.display,
          position: style.position,
          overflow: style.overflow,
          borderRadius: style.borderRadius,
          objectFit: mediaStyle?.objectFit || style.objectFit || null,
          backgroundImage: style.backgroundImage && style.backgroundImage !== "none" ? style.backgroundImage : null,
          tagName: el.tagName.toLowerCase(),
          mediaTagName: media?.tagName?.toLowerCase() || null,
          mediaSrc: media?.currentSrc || media?.src || null,
          mediaAlt: media?.alt || null,
          naturalWidth: media?.naturalWidth || null,
          naturalHeight: media?.naturalHeight || null
        }
      };
    }
    return result;
  }, requested);

  return requested.map((item, index) => {
    const id = item.id || `element-${index + 1}`;
    const entry = actual[id] || { count: 0, selector: item.selector || null, actual: null };
    const tolerance = Number(item.tolerance ?? defaultTolerance);
    const uniquePass = item.allowMultiple ? entry.count > 0 : entry.count === 1;
    if (!entry.actual) {
      return {
        id,
        selector: entry.selector || item.selector || null,
        expected: item.bounds || null,
        actual: null,
        tolerance,
        count: entry.count,
        pass: false,
        reason: "missing element"
      };
    }
    const bounds = item.bounds ? compareBounds(item.bounds, entry.actual, tolerance) : { pass: true };
    const objectFitPass = item.fillMode ? entry.actual.objectFit === item.fillMode : true;
    const srcPass = item.expectedSrcIncludes ? String(entry.actual.mediaSrc || "").includes(item.expectedSrcIncludes) : true;
    const altPass = item.expectedAltIncludes ? String(entry.actual.mediaAlt || "").includes(item.expectedAltIncludes) : true;
    const requiresMedia = item.requiresMedia === true || item.expectedSrcIncludes || item.fillMode;
    const mediaPass = requiresMedia ? Boolean(entry.actual.mediaTagName || entry.actual.backgroundImage) : true;
    return {
      id,
      selector: entry.selector,
      expected: item.bounds || null,
      actual: entry.actual,
      tolerance,
      count: entry.count,
      uniquePass,
      ...(item.bounds ? bounds : {}),
      objectFitPass,
      srcPass,
      altPass,
      mediaPass,
      pass: uniquePass && bounds.pass && objectFitPass && srcPass && altPass && mediaPass
    };
  });
}

async function collectPageCssText(page) {
  const snapshot = await page.evaluate(() => {
    const sheets = [...document.styleSheets].map((sheet) => {
      let cssText = "";
      try {
        cssText = [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      } catch {
        cssText = "";
      }
      return { href: sheet.href || null, cssText };
    });
    const inline = [...document.querySelectorAll("style")].map((node) => node.textContent || "");
    return { sheets, inline };
  });

  const chunks = [...snapshot.inline, ...snapshot.sheets.map((sheet) => sheet.cssText).filter(Boolean)];
  for (const sheet of snapshot.sheets) {
    if (sheet.cssText || !sheet.href) continue;
    try {
      if (sheet.href.startsWith("file://")) {
        chunks.push(await fs.readFile(fileURLToPath(sheet.href), "utf8"));
      } else if (/^https?:\/\//i.test(sheet.href)) {
        const response = await fetch(sheet.href);
        if (response.ok) chunks.push(await response.text());
      }
    } catch {
      // Keep anti-slop checks best-effort for remote or inaccessible stylesheets.
    }
  }
  return chunks.join("\n");
}

async function inspectAntiSlop(page, rules = null) {
  const enabled = Boolean(
    rules &&
      (rules.forbiddenCssIncludes?.length ||
        rules.forbiddenVisibleText?.length ||
        rules.computedRules?.length)
  );
  if (!enabled) return { enabled: false, pass: true, checks: [] };

  const cssText = await collectPageCssText(page);
  return page.evaluate(({ inputRules, cssText }) => {
    const checks = [];
    const visibleText = document.body?.innerText || "";

    for (const token of inputRules.forbiddenCssIncludes || []) {
      const pass = !cssText.includes(token);
      checks.push({
        id: `forbidden-css:${token}`,
        type: "forbiddenCssIncludes",
        token,
        pass,
        reason: pass ? null : `CSS contains forbidden token: ${token}`
      });
    }

    for (const token of inputRules.forbiddenVisibleText || []) {
      const pass = !visibleText.includes(token);
      checks.push({
        id: `forbidden-text:${token}`,
        type: "forbiddenVisibleText",
        token,
        pass,
        reason: pass ? null : `Visible text contains invented token: ${token}`
      });
    }

    for (const rule of inputRules.computedRules || []) {
      const selector = rule.selector || "*";
      const property = rule.property;
      const nodes = [...document.querySelectorAll(selector)];
      const values = nodes.map((node) => getComputedStyle(node).getPropertyValue(property));
      let pass = nodes.length > 0;
      let reason = pass ? null : `No elements matched ${selector}`;

      if (pass && rule.notIncludes) {
        const hit = values.find((value) => value.includes(rule.notIncludes));
        pass = !hit;
        reason = pass ? null : `${selector} ${property} contains ${rule.notIncludes}`;
      }
      if (pass && rule.equals !== undefined) {
        const mismatch = values.find((value) => value.trim() !== String(rule.equals));
        pass = !mismatch;
        reason = pass ? null : `${selector} ${property} expected ${rule.equals}`;
      }

      checks.push({
        id: rule.id || `computed:${selector}:${property}`,
        type: "computedRule",
        selector,
        property,
        sampleValues: values.slice(0, 5),
        matched: nodes.length,
        pass,
        reason
      });
    }

    return {
      enabled: true,
      cssLength: cssText.length,
      checks,
      pass: checks.every((check) => check.pass)
    };
  }, { inputRules: rules, cssText });
}

function passRate(items) {
  if (!items.length) return 1;
  return Number((items.filter((item) => item.pass).length / items.length).toFixed(4));
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
        let pass;
        if (step.selector) {
          const actual = await locatorFor(page, step.selector).innerText();
          pass = actual.includes(step.text);
          result.steps.push({ action: "expectText", selector: step.selector, text: step.text, pass, actual });
        } else {
          const visible = await page.locator("body").filter({ hasText: step.text }).count();
          pass = visible > 0;
          result.steps.push({ action: "expectText", text: step.text, pass });
        }
        result.pass = result.pass && pass;
      } else if (step.action === "expectNotText") {
        let actual;
        if (step.selector) {
          actual = await locatorFor(page, step.selector).innerText();
        } else {
          actual = await page.locator("body").innerText();
        }
        const pass = !actual.includes(step.text);
        result.pass = result.pass && pass;
        result.steps.push({ action: "expectNotText", selector: step.selector || "body", text: step.text, pass, actual });
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
  const failedRegions = pageResults.flatMap((result) =>
    result.regions.filter((region) => !region.pass).map((region) => ({ page: result.id, ...region }))
  );
  const failedElements = pageResults.flatMap((result) =>
    result.elementChecks.filter((element) => !element.pass).map((element) => ({ page: result.id, ...element }))
  );
  const failedComponents = pageResults.flatMap((result) =>
    result.componentChecks.filter((component) => !component.pass).map((component) => ({ page: result.id, ...component }))
  );
  const failedAssetSlots = pageResults.flatMap((result) =>
    result.assetSlots.filter((slot) => !slot.pass).map((slot) => ({ page: result.id, ...slot }))
  );
  const failedAntiSlop = pageResults.flatMap((result) =>
    result.antiSlop?.enabled
      ? result.antiSlop.checks.filter((check) => !check.pass).map((check) => ({ page: result.id, ...check }))
      : []
  );
  const failedVerticalFit = pageResults
    .filter((result) => result.verticalFit?.enabled && !result.verticalFit.pass)
    .map((result) => ({ page: result.id, ...result.verticalFit }));
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
    `- Region pass rate: ${score.regionPassRate}`,
    `- Element pass rate: ${score.elementPassRate}`,
    `- Component pass rate: ${score.componentPassRate}`,
    `- Asset slot pass rate: ${score.assetSlotPassRate}`,
    `- Anti-slop pass rate: ${score.antiSlopPassRate}`,
    `- Vertical fit pass rate: ${score.verticalFitPassRate}`,
    `- Target score: ${score.target}`,
    `- Result: ${pass ? "PASS" : "FAIL"}`,
    "",
    "## Pages",
    "",
    ...pageResults.map(
      (result) =>
        `- ${result.id}: ${result.pass ? "PASS" : "FAIL"} similarity=${result.compare.similarity} regions=${result.regions.filter((item) => item.pass).length}/${result.regions.length} elements=${result.elementChecks.filter((item) => item.pass).length}/${result.elementChecks.length} components=${result.componentChecks.filter((item) => item.pass).length}/${result.componentChecks.length} assets=${result.assetSlots.filter((item) => item.pass).length}/${result.assetSlots.length} antiSlop=${result.antiSlop.enabled ? result.antiSlop.pass : "n/a"} verticalFit=${result.verticalFit.enabled ? result.verticalFit.pass : "n/a"} route=${result.route} screenshot=${reportPath(result.screenshot)}`
    ),
    "",
    "## Responsive",
    "",
    ...responsiveResults.map(
      (result) =>
        `- ${result.route} ${result.viewport.width}x${result.viewport.height}: ${result.pass ? "PASS" : "FAIL"} overflowX=${result.health.hasHorizontalOverflow} verticalFit=${result.verticalFit.enabled ? result.verticalFit.pass : "n/a"} screenshot=${reportPath(result.screenshot)}`
    ),
    "",
    "## Interactions",
    "",
    ...interactionResults.map((result) => `- ${result.id}: ${result.pass ? "PASS" : "FAIL"}`),
    "",
    "## Failures",
    "",
    `- Page failures: ${failedPages.length}`,
    `- Region failures: ${failedRegions.length}`,
    `- Element bbox failures: ${failedElements.length}`,
    `- Component failures: ${failedComponents.length}`,
    `- Asset slot failures: ${failedAssetSlots.length}`,
    `- Anti-slop failures: ${failedAntiSlop.length}`,
    `- Vertical fit failures: ${failedVerticalFit.length}`,
    `- Responsive failures: ${failedResponsive.length}`,
    `- Interaction failures: ${failedInteractions.length}`,
    "",
    "## Gate Failure Details",
    "",
    ...(failedRegions.length
      ? failedRegions.map(
          (item) => `- region ${item.page}/${item.id}: similarity=${item.compare.similarity} min=${item.minSimilarity}`
        )
      : ["- Region failures: none"]),
    ...(failedElements.length
      ? failedElements.map(
          (item) => `- element ${item.page}/${item.id}: selector=${item.selector} maxDelta=${item.maxDelta ?? "n/a"} count=${item.count}`
        )
      : ["- Element failures: none"]),
    ...(failedComponents.length
      ? failedComponents.map(
          (item) =>
            `- component ${item.page}/${item.id}: selector=${item.selector} maxDelta=${item.maxDelta ?? "n/a"} count=${item.count}`
        )
      : ["- Component failures: none"]),
    ...(failedAssetSlots.length
      ? failedAssetSlots.map(
          (item) =>
            `- asset ${item.page}/${item.id}: selector=${item.selector} maxDelta=${item.maxDelta ?? "n/a"} media=${item.mediaPass} src=${item.srcPass} objectFit=${item.objectFitPass}`
        )
      : ["- Asset slot failures: none"]),
    ...(failedAntiSlop.length
      ? failedAntiSlop.map((item) => `- anti-slop ${item.page}/${item.id}: ${item.reason || "failed"}`)
      : ["- Anti-slop failures: none"]),
    ...(failedVerticalFit.length
      ? failedVerticalFit.map(
          (item) => `- vertical ${item.page}: scrollHeight=${item.actualScrollHeight} max=${item.maxScrollHeight}`
        )
      : ["- Vertical fit failures: none"]),
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
    const verticalFit = verticalFitSpec(pageSpec, manifest, viewport);
    const verticalFitResult = {
      ...verticalFit,
      actualScrollHeight: health.scrollHeight,
      viewportHeight: health.clientHeight,
      pass: !verticalFit.enabled || health.scrollHeight <= verticalFit.maxScrollHeight
    };
    const defaultRegionMinSimilarity = Number(pageSpec.regionMinSimilarity ?? manifest.regionMinSimilarity ?? 0.9);
    const regions = await compareRegions({
      reference: normalizedReference,
      rendered: screenshot,
      outDir: path.join(pageDir, "regions"),
      regions: pageSpec.regions || [],
      threshold: pageSpec.regionThreshold || pageSpec.threshold || manifest.regionThreshold || manifest.threshold || 0.1,
      defaultMinSimilarity: defaultRegionMinSimilarity
    });
    const elementChecks = await inspectElements(
      page,
      pageSpec.elements || [],
      Number(pageSpec.elementTolerance ?? manifest.elementTolerance ?? 8)
    );
    const componentChecks = await inspectElements(
      page,
      pageSpec.components || [],
      Number(pageSpec.componentTolerance ?? manifest.componentTolerance ?? manifest.elementTolerance ?? 8)
    );
    const assetSlots = await inspectElements(
      page,
      pageSpec.assetSlots || [],
      Number(pageSpec.assetSlotTolerance ?? manifest.assetSlotTolerance ?? 8)
    );
    const antiSlop = await inspectAntiSlop(page, pageSpec.antiSlop || manifest.antiSlop || null);
    const pass =
      compare.similarity >= (pageSpec.minSimilarity || manifest.minSimilarity || target) &&
      !health.hasHorizontalOverflow &&
      health.missingTexts.length === 0 &&
      verticalFitResult.pass &&
      regions.every((result) => result.pass) &&
      elementChecks.every((result) => result.pass) &&
      componentChecks.every((result) => result.pass) &&
      antiSlop.pass &&
      assetSlots.every((result) => result.pass);
    pageResults.push({
      id: pageSpec.id,
      route: pageSpec.route,
      reference: normalizedReference,
      screenshot,
      diff,
      compare,
      health,
      verticalFit: verticalFitResult,
      regions,
      elementChecks,
      componentChecks,
      assetSlots,
      antiSlop,
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
      const responsiveVerticalFit =
        viewportSpec.maxScrollHeight || viewportSpec.maxScrollHeightRatio || manifest.responsiveMaxScrollHeightRatio
          ? {
              enabled: true,
              maxScrollHeight: viewportSpec.maxScrollHeight
                ? Number(viewportSpec.maxScrollHeight)
                : Math.round(
                    viewportSpec.height * Number(viewportSpec.maxScrollHeightRatio ?? manifest.responsiveMaxScrollHeightRatio)
                  ),
              actualScrollHeight: health.scrollHeight
            }
          : { enabled: false, maxScrollHeight: null, actualScrollHeight: health.scrollHeight };
      responsiveVerticalFit.pass =
        !responsiveVerticalFit.enabled || health.scrollHeight <= responsiveVerticalFit.maxScrollHeight;
      responsiveResults.push({
        route,
        viewport: viewportSpec,
        screenshot,
        health,
        verticalFit: responsiveVerticalFit,
        pass: health.bodyTextLength > 0 && !health.hasHorizontalOverflow && responsiveVerticalFit.pass
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
    regionPassRate: passRate(pageResults.flatMap((result) => result.regions)),
    elementPassRate: passRate(pageResults.flatMap((result) => result.elementChecks)),
    componentPassRate: passRate(pageResults.flatMap((result) => result.componentChecks)),
    assetSlotPassRate: passRate(pageResults.flatMap((result) => result.assetSlots)),
    antiSlopPassRate: passRate(pageResults.filter((result) => result.antiSlop?.enabled).map((result) => result.antiSlop)),
    verticalFitPassRate: passRate(
      pageResults.filter((result) => result.verticalFit.enabled).map((result) => result.verticalFit)
    ),
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
