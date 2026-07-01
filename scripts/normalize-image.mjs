#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("Usage: node scripts/normalize-image.mjs --input reference.png --out normalized.png [--json reference.json] [--max-width 1600]\n");
    return;
  }
  const input = path.resolve(requireArg(args, "input"));
  const out = path.resolve(requireArg(args, "out"));
  const jsonOut = args.json ? path.resolve(args.json) : null;
  const maxWidth = args["max-width"] ? Number(args["max-width"]) : null;

  await fs.mkdir(path.dirname(out), { recursive: true });
  if (jsonOut) await fs.mkdir(path.dirname(jsonOut), { recursive: true });

  const image = sharp(input, { limitInputPixels: false }).rotate();
  const meta = await image.metadata();
  let pipeline = image;

  if (maxWidth && meta.width && meta.width > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }

  await pipeline.png().toFile(out);
  const normalizedMeta = await sharp(out).metadata();

  const report = {
    input,
    output: out,
    format: normalizedMeta.format,
    width: normalizedMeta.width,
    height: normalizedMeta.height,
    channels: normalizedMeta.channels,
    density: normalizedMeta.density ?? null,
    resized: Boolean(maxWidth && meta.width && meta.width > maxWidth)
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
