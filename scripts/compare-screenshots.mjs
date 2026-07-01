#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import pixelmatch from "pixelmatch";
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
  if (!args[key]) {
    throw new Error(`Missing required argument --${key}`);
  }
  return args[key];
}

async function readPng(file) {
  return PNG.sync.read(await fsp.readFile(file));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("Usage: node scripts/compare-screenshots.mjs --reference reference.png --rendered rendered.png [--diff diff.png] [--json compare.json] [--threshold 0.1]\n");
    return;
  }
  const reference = path.resolve(requireArg(args, "reference"));
  const rendered = path.resolve(requireArg(args, "rendered"));
  const diffPath = args.diff ? path.resolve(args.diff) : null;
  const jsonOut = args.json ? path.resolve(args.json) : null;
  const threshold = args.threshold ? Number(args.threshold) : 0.1;
  const resizeRendered = args["resize-rendered"] !== "false";

  if (diffPath) await fsp.mkdir(path.dirname(diffPath), { recursive: true });
  if (jsonOut) await fsp.mkdir(path.dirname(jsonOut), { recursive: true });

  const refPng = await readPng(reference);
  let renderedPathForCompare = rendered;
  let renderedPng = await readPng(rendered);
  const dimensionsMatch = refPng.width === renderedPng.width && refPng.height === renderedPng.height;

  if (!dimensionsMatch && resizeRendered) {
    const resizedBuffer = await sharp(rendered)
      .resize(refPng.width, refPng.height, { fit: "fill" })
      .png()
      .toBuffer();
    renderedPng = PNG.sync.read(resizedBuffer);
    renderedPathForCompare = `${rendered}#resized-for-compare`;
  }

  if (refPng.width !== renderedPng.width || refPng.height !== renderedPng.height) {
    throw new Error(
      `Screenshot dimensions differ: reference ${refPng.width}x${refPng.height}, rendered ${renderedPng.width}x${renderedPng.height}`
    );
  }

  const diff = new PNG({ width: refPng.width, height: refPng.height });
  const diffPixels = pixelmatch(
    refPng.data,
    renderedPng.data,
    diff.data,
    refPng.width,
    refPng.height,
    { threshold, includeAA: false }
  );
  const totalPixels = refPng.width * refPng.height;
  const diffRatio = diffPixels / totalPixels;
  const similarity = 1 - diffRatio;

  if (diffPath) {
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }

  const report = {
    reference,
    rendered,
    renderedPathForCompare,
    diff: diffPath,
    width: refPng.width,
    height: refPng.height,
    dimensionsMatch,
    threshold,
    diffPixels,
    totalPixels,
    diffRatio: Number(diffRatio.toFixed(6)),
    similarity: Number(similarity.toFixed(6))
  };

  if (jsonOut) {
    await fsp.writeFile(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
