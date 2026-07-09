#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const ICON_SIZES = [16, 32, 48, 128];
const SCALE = 4;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (from, to, t) => Math.round(from + (to - from) * clamp(t));
const parseHex = (hex) => {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
};

const START = parseHex("#4c72e8");
const END = parseHex("#2444ad");
const WHITE = [255, 255, 255];

const setPixel = (buffer, width, x, y, color, alpha = 255) => {
  if (x < 0 || y < 0 || x >= width || y >= width || alpha <= 0) return;
  const index = (y * width + x) * 4;
  const existingAlpha = buffer[index + 3] / 255;
  const nextAlpha = alpha / 255;
  const outputAlpha = nextAlpha + existingAlpha * (1 - nextAlpha);
  if (outputAlpha <= 0) return;

  for (let channel = 0; channel < 3; channel += 1) {
    const existing = buffer[index + channel];
    buffer[index + channel] = Math.round(
      (color[channel] * nextAlpha +
        existing * existingAlpha * (1 - nextAlpha)) /
        outputAlpha
    );
  }
  buffer[index + 3] = Math.round(outputAlpha * 255);
};

const roundedRectAlpha = (x, y, size, radius) => {
  const left = radius;
  const right = size - radius;
  const top = radius;
  const bottom = size - radius;
  const closestX = clamp(x, left, right);
  const closestY = clamp(y, top, bottom);
  const distance = Math.hypot(x - closestX, y - closestY);
  return clamp(radius + 0.5 - distance);
};

const drawCircle = (buffer, size, cx, cy, radius, color) => {
  const minX = Math.floor(cx - radius - 1);
  const maxX = Math.ceil(cx + radius + 1);
  const minY = Math.floor(cy - radius - 1);
  const maxY = Math.ceil(cy + radius + 1);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const alpha = clamp(radius + 0.5 - distance);
      setPixel(buffer, size, x, y, color, Math.round(alpha * 255));
    }
  }
};

const drawCapsule = (buffer, size, ax, ay, bx, by, radius, color) => {
  const minX = Math.floor(Math.min(ax, bx) - radius - 1);
  const maxX = Math.ceil(Math.max(ax, bx) + radius + 1);
  const minY = Math.floor(Math.min(ay, by) - radius - 1);
  const maxY = Math.ceil(Math.max(ay, by) + radius + 1);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t =
        lengthSq === 0
          ? 0
          : clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq);
      const closestX = ax + dx * t;
      const closestY = ay + dy * t;
      const distance = Math.hypot(px - closestX, py - closestY);
      const alpha = clamp(radius + 0.5 - distance);
      setPixel(buffer, size, x, y, color, Math.round(alpha * 255));
    }
  }
};

const drawBezierStroke = (buffer, size, points, radius, color) => {
  const cubic = (t, p0, p1, p2, p3) => {
    const u = 1 - t;
    return (
      u * u * u * p0 +
      3 * u * u * t * p1 +
      3 * u * t * t * p2 +
      t * t * t * p3
    );
  };

  let previous = points[0];
  for (let index = 1; index <= 90; index += 1) {
    const t = index / 90;
    const current = {
      x: cubic(t, points[0].x, points[1].x, points[2].x, points[3].x),
      y: cubic(t, points[0].y, points[1].y, points[2].y, points[3].y),
    };
    drawCapsule(
      buffer,
      size,
      previous.x,
      previous.y,
      current.x,
      current.y,
      radius,
      color
    );
    previous = current;
  }
};

const drawMark = (buffer, size) => {
  const s = size;
  const stroke = s * 0.052;

  drawCircle(buffer, size, s * 0.375, s * 0.265, s * 0.052, WHITE);
  drawCapsule(buffer, size, s * 0.405, s * 0.39, s * 0.405, s * 0.655, stroke, WHITE);
  drawBezierStroke(
    buffer,
    size,
    [
      { x: s * 0.405, y: s * 0.655 },
      { x: s * 0.405, y: s * 0.785 },
      { x: s * 0.25, y: s * 0.83 },
      { x: s * 0.23, y: s * 0.69 },
    ],
    stroke,
    WHITE
  );

  drawCapsule(buffer, size, s * 0.64, s * 0.27, s * 0.605, s * 0.62, stroke, WHITE);
  drawCircle(buffer, size, s * 0.585, s * 0.765, s * 0.054, WHITE);
};

const renderLargeIcon = (targetSize) => {
  const size = targetSize * SCALE;
  const radius = size * 0.26;
  const buffer = Buffer.alloc(size * size * 4);
  const gradientVectorX = -0.55;
  const gradientVectorY = 0.83;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const mask = roundedRectAlpha(px, py, size, radius);
      if (mask <= 0) continue;
      const normalizedX = px / size - 0.5;
      const normalizedY = py / size - 0.5;
      const t = clamp(normalizedX * gradientVectorX + normalizedY * gradientVectorY + 0.5);
      const base = [
        mix(START[0], END[0], t),
        mix(START[1], END[1], t),
        mix(START[2], END[2], t),
      ];
      const gloss = py < size * 0.5 ? (1 - py / (size * 0.5)) * 0.22 : 0;
      const color = base.map((channel) => mix(channel, 255, gloss));
      setPixel(buffer, size, x, y, color, Math.round(mask * 255));
    }
  }

  drawMark(buffer, size);
  return { buffer, size };
};

const downsample = ({ buffer, size }, targetSize) => {
  const output = Buffer.alloc(targetSize * targetSize * 4);
  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const totals = [0, 0, 0, 0];
      for (let sy = 0; sy < SCALE; sy += 1) {
        for (let sx = 0; sx < SCALE; sx += 1) {
          const sourceIndex = ((y * SCALE + sy) * size + x * SCALE + sx) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            totals[channel] += buffer[sourceIndex + channel];
          }
        }
      }
      const index = (y * targetSize + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        output[index + channel] = Math.round(totals[channel] / (SCALE * SCALE));
      }
    }
  }
  return output;
};

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
};

const encodePng = (rgba, size) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    scanlines[rowStart] = 0;
    rgba.copy(scanlines, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

const writeIcons = async () => {
  const iconsDir = path.join(ROOT_DIR, "icons");
  const referenceDir = path.join(ROOT_DIR, "design-system", "reference");
  await mkdir(iconsDir, { recursive: true });
  await mkdir(referenceDir, { recursive: true });

  for (const size of ICON_SIZES) {
    const large = renderLargeIcon(size);
    const rgba = downsample(large, size);
    const png = encodePng(rgba, size);
    await writeFile(path.join(iconsDir, `icon_${size}.png`), png);
    if (size === 48 || size === 128) {
      await writeFile(path.join(referenceDir, `icon_${size}.png`), png);
    }
  }
};

await writeIcons();
