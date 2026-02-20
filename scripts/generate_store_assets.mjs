#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile, copyFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_OUT_DIR = path.join(ROOT_DIR, "store-assets");
const ICON_MASTER_SIZE = 1024;
const ICON_TIGHT_CROP_RATIO = 0.82;
const ICON_TIGHT_CROP_SIZE = Math.round(ICON_MASTER_SIZE * ICON_TIGHT_CROP_RATIO);

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Missing OPENAI_API_KEY.");
  console.error("Example: OPENAI_API_KEY=sk-... npm run assets:generate");
  process.exit(1);
}

const model = args.model || "gpt-image-1";
const quality = args.quality || "high";
const outDir = path.resolve(args.out || DEFAULT_OUT_DIR);
const iconsDir = path.join(ROOT_DIR, "icons");
const generatedIconsDir = path.join(outDir, "icons");
const cwsDir = path.join(outDir, "chrome-web-store");
const screenshotsDir = path.join(cwsDir, "screenshots");
const mastersDir = path.join(outDir, "masters");

const BRAND_STYLE = [
  "Brand: Jot it!.",
  "Primary mark is lowercase 'j!' (small j followed by exclamation mark).",
  "Visual language: calm, minimal, modern, rounded geometry.",
  "Palette: blue tonalities with deep navy, cobalt, slate-blue, and soft ice-blue highlights.",
  "Suggested anchors: #0F1C3F, #2F5BFF, #6F8CCF, #EAF1FF.",
  "Cohesive style across all outputs.",
].join(" ");

const ICON_PROMPT = [
  BRAND_STYLE,
  "Design a polished extension icon.",
  "Centered 'j!' mark only, high legibility at tiny sizes.",
  "Scale the mark and badge large so they fill most of the canvas with tight safe margins.",
  "Avoid tiny symbol composition or excess transparent padding.",
  "Use a blue-tonality gradient/background treatment with strong contrast on the mark.",
  "Rounded square badge with subtle depth, transparent outer background.",
  "No extra words, no watermark, no mockup frame.",
].join(" ");

const PROMO_LARGE_PROMPT = [
  BRAND_STYLE,
  "Create a Chrome Web Store promotional visual for Jot it!.",
  "Show a browser side panel note-taking experience with clean UI cards.",
  "Include the j! mark as a small brand element.",
  "Professional product-marketing composition, soft gradients, no clutter.",
  "If text appears, only use: 'Jot it!'.",
].join(" ");

const PROMO_MARQUEE_PROMPT = [
  BRAND_STYLE,
  "Create a wide promotional banner for Jot it! with a side-panel workflow.",
  "Keep important elements centered so crop-safe area remains strong.",
  "Show clean notes UI and subtle motion/flow cues, no people.",
  "If text appears, only use: 'Jot it!'.",
].join(" ");

const SCREENSHOT_PROMPTS = [
  [
    BRAND_STYLE,
    "Realistic browser screenshot style.",
    "Jot it! side panel open with title field, date/time row, and rich note body.",
    "Clean, readable UI and calm neutral palette.",
  ].join(" "),
  [
    BRAND_STYLE,
    "Realistic browser screenshot style.",
    "Jot it! settings view focused on export workflow and folder options.",
    "Show crisp controls and concise labels.",
  ].join(" "),
  [
    BRAND_STYLE,
    "Realistic browser screenshot style.",
    "Jot it! detached window mode with formatting toolbar and markdown export hint.",
    "Keep layout balanced and modern.",
  ].join(" "),
];

const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${commandArgs.join(" ")}\n${result.stderr || result.stdout}`
    );
  }
  return result.stdout || "";
};

const ensureSips = () => {
  try {
    run("sips", ["-h"]);
  } catch (error) {
    throw new Error("This script requires macOS `sips` to resize/crop images.");
  }
};

const getDimensions = (filePath) => {
  const output = run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath]);
  const widthMatch = output.match(/pixelWidth:\s+(\d+)/);
  const heightMatch = output.match(/pixelHeight:\s+(\d+)/);
  if (!widthMatch || !heightMatch) {
    throw new Error(`Could not read dimensions for ${filePath}`);
  }
  return {
    width: Number.parseInt(widthMatch[1], 10),
    height: Number.parseInt(heightMatch[1], 10),
  };
};

const resizeExact = (source, targetWidth, targetHeight, destination) => {
  run("sips", [
    "-s",
    "format",
    "png",
    "--resampleHeightWidth",
    String(targetHeight),
    String(targetWidth),
    source,
    "--out",
    destination,
  ]);
};

const centerCropSquare = ({ source, cropSize, destination }) => {
  run("sips", [
    "-s",
    "format",
    "png",
    "--cropToHeightWidth",
    String(cropSize),
    String(cropSize),
    source,
    "--out",
    destination,
  ]);
};

const resizeCover = async ({
  source,
  targetWidth,
  targetHeight,
  destination,
  tempDir,
}) => {
  const { width, height } = getDimensions(source);
  const sourceRatio = width / height;
  const targetRatio = targetWidth / targetHeight;
  const stepFile = path.join(tempDir, `step-${targetWidth}x${targetHeight}.png`);

  if (sourceRatio >= targetRatio) {
    run("sips", [
      "-s",
      "format",
      "png",
      "--resampleHeight",
      String(targetHeight),
      source,
      "--out",
      stepFile,
    ]);
  } else {
    run("sips", [
      "-s",
      "format",
      "png",
      "--resampleWidth",
      String(targetWidth),
      source,
      "--out",
      stepFile,
    ]);
  }

  run("sips", [
    "-s",
    "format",
    "png",
    "--cropToHeightWidth",
    String(targetHeight),
    String(targetWidth),
    stepFile,
    "--out",
    destination,
  ]);
};

const generateImage = async ({
  prompt,
  size = "1024x1024",
  background = "opaque",
}) => {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality,
      output_format: "png",
      background,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const item = payload?.data?.[0];
  if (!item) {
    throw new Error("OpenAI API returned no image data.");
  }
  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }
  if (item.url) {
    const download = await fetch(item.url);
    if (!download.ok) {
      throw new Error(`Failed to download generated image: ${download.status}`);
    }
    return Buffer.from(await download.arrayBuffer());
  }
  throw new Error("Unsupported OpenAI image response payload.");
};

const generateAndSave = async ({
  label,
  prompt,
  size,
  background,
  destination,
}) => {
  console.log(`• Generating ${label} (${size})...`);
  const imageBuffer = await generateImage({ prompt, size, background });
  await writeFile(destination, imageBuffer);
  console.log(`  Saved: ${destination}`);
};

function parseArgs(argv) {
  const parsed = {
    out: null,
    model: null,
    quality: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--out") {
      parsed.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--model") {
      parsed.model = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--quality") {
      parsed.quality = argv[i + 1];
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (
    parsed.quality &&
    !["low", "medium", "high", "auto"].includes(parsed.quality)
  ) {
    throw new Error("--quality must be one of: low, medium, high, auto");
  }
  return parsed;
}

function printHelp() {
  console.log(`
Generate Jot it! icon/store visual assets with the OpenAI Images API.

Usage:
  OPENAI_API_KEY=sk-... node scripts/generate_store_assets.mjs [options]

Options:
  --out <dir>        Output directory (default: store-assets)
  --model <name>     Image model (default: gpt-image-1)
  --quality <level>  low | medium | high | auto (default: high)
  --help             Show this help
`);
}

const main = async () => {
  ensureSips();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "jot-it-assets-"));
  try {
    await mkdir(outDir, { recursive: true });
    await mkdir(generatedIconsDir, { recursive: true });
    await mkdir(cwsDir, { recursive: true });
    await mkdir(screenshotsDir, { recursive: true });
    await mkdir(mastersDir, { recursive: true });

    const iconMaster = path.join(mastersDir, "icon-master-1024.png");
    await generateAndSave({
      label: "icon master",
      prompt: ICON_PROMPT,
      size: "1024x1024",
      background: "transparent",
      destination: iconMaster,
    });

    const iconMasterTight = path.join(tempDir, "icon-master-tight.png");
    centerCropSquare({
      source: iconMaster,
      cropSize: ICON_TIGHT_CROP_SIZE,
      destination: iconMasterTight,
    });

    const iconSizes = [16, 32, 48, 128];
    for (const size of iconSizes) {
      const generatedPath = path.join(generatedIconsDir, `icon_${size}.png`);
      resizeExact(iconMasterTight, size, size, generatedPath);
      const extensionPath = path.join(iconsDir, `icon_${size}.png`);
      await copyFile(generatedPath, extensionPath);
      console.log(`  Updated extension icon: ${extensionPath}`);
    }

    const cwsStoreIcon = path.join(cwsDir, "store-icon-128.png");
    await copyFile(path.join(generatedIconsDir, "icon_128.png"), cwsStoreIcon);

    const promoMaster = path.join(mastersDir, "promo-master-1536x1024.png");
    await generateAndSave({
      label: "promo master",
      prompt: PROMO_LARGE_PROMPT,
      size: "1536x1024",
      background: "opaque",
      destination: promoMaster,
    });

    await resizeCover({
      source: promoMaster,
      targetWidth: 920,
      targetHeight: 680,
      destination: path.join(cwsDir, "promo-large-920x680.png"),
      tempDir,
    });

    const marqueeMaster = path.join(mastersDir, "marquee-master-1536x1024.png");
    await generateAndSave({
      label: "marquee master",
      prompt: PROMO_MARQUEE_PROMPT,
      size: "1536x1024",
      background: "opaque",
      destination: marqueeMaster,
    });

    await resizeCover({
      source: marqueeMaster,
      targetWidth: 1400,
      targetHeight: 560,
      destination: path.join(cwsDir, "promo-marquee-1400x560.png"),
      tempDir,
    });

    for (let index = 0; index < SCREENSHOT_PROMPTS.length; index += 1) {
      const number = String(index + 1).padStart(2, "0");
      const masterPath = path.join(
        mastersDir,
        `screenshot-${number}-master-1536x1024.png`
      );
      await generateAndSave({
        label: `screenshot ${number} master`,
        prompt: SCREENSHOT_PROMPTS[index],
        size: "1536x1024",
        background: "opaque",
        destination: masterPath,
      });
      await resizeCover({
        source: masterPath,
        targetWidth: 1280,
        targetHeight: 800,
        destination: path.join(screenshotsDir, `screenshot-${number}-1280x800.png`),
        tempDir,
      });
    }

    console.log("\nDone.");
    console.log(`Generated assets in: ${outDir}`);
    console.log("Extension icons were updated in: icons/");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
