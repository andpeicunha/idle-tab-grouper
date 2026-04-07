import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const rootDir = process.cwd();
const outputDir = resolve(rootDir, "public", "icons");

mkdirSync(outputDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const png = createIconPng(size);
  writeFileSync(resolve(outputDir, `icon-${size}.png`), png);
}

function createIconPng(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 128;
  const transparent = [0, 0, 0, 0];
  fillAll(pixels, size, transparent);

  const outline = [43, 194, 160, 255];
  const body = [255, 255, 255, 255];
  const topBar = [42, 211, 138, 255];
  const accent = [59, 130, 246, 255];

  const x = scaleRect(18, scale);
  const y = scaleRect(18, scale);
  const w = scaleRect(92, scale);
  const h = scaleRect(92, scale);
  const r = scaleRect(18, scale);
  const border = Math.max(1, scaleRect(8, scale));

  drawRoundedRect(pixels, size, x, y, w, h, r, outline);
  drawRoundedRect(pixels, size, x + border, y + border, w - border * 2, h - border * 2, Math.max(1, r - border), body);

  const topHeight = scaleRect(16, scale);
  drawRoundedRect(pixels, size, x + border, y + border, w - border * 2, topHeight, Math.max(1, r - border - 1), topBar);

  const accentWidth = Math.max(2, scaleRect(10, scale));
  drawRoundedRect(pixels, size, x + border, y + border, accentWidth, topHeight, Math.max(1, scaleRect(6, scale)), accent);

  const innerInset = scaleRect(18, scale);
  drawRoundedRect(pixels, size, x + innerInset, y + innerInset + topHeight, scaleRect(28, scale), scaleRect(8, scale), Math.max(1, scaleRect(4, scale)), accent);
  drawRoundedRect(pixels, size, x + innerInset, y + innerInset + topHeight + scaleRect(14, scale), scaleRect(38, scale), scaleRect(8, scale), Math.max(1, scaleRect(4, scale)), accent);
  drawRoundedRect(pixels, size, x + innerInset, y + innerInset + topHeight + scaleRect(28, scale), scaleRect(22, scale), scaleRect(8, scale), Math.max(1, scaleRect(4, scale)), accent);

  return encodePng(size, pixels);
}

function fillAll(buffer, size, rgba) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      setPixel(buffer, size, x, y, rgba);
    }
  }
}

function scaleRect(value, scale) {
  return Math.max(1, Math.round(value * scale));
}

function setPixel(buffer, size, x, y, rgba) {
  const index = (y * size + x) * 4;
  buffer[index] = rgba[0];
  buffer[index + 1] = rgba[1];
  buffer[index + 2] = rgba[2];
  buffer[index + 3] = rgba[3];
}

function drawRoundedRect(buffer, size, x, y, width, height, radius, rgba) {
  const maxX = Math.min(size, x + width);
  const maxY = Math.min(size, y + height);
  for (let py = y; py < maxY; py += 1) {
    for (let px = x; px < maxX; px += 1) {
      const dx = px < x + radius ? x + radius - px : px >= x + width - radius ? px - (x + width - radius - 1) : 0;
      const dy = py < y + radius ? y + radius - py : py >= y + height - radius ? py - (y + height - radius - 1) : 0;
      if (dx * dx + dy * dy <= radius * radius || dx === 0 || dy === 0) {
        setPixel(buffer, size, px, py, rgba);
      }
    }
  }
}

function encodePng(size, pixels) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    pixels.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  const header = Buffer.from("89504e470d0a1a0a", "hex");
  const ihdr = createChunk("IHDR", buildIhdr(size, size));
  const idat = createChunk("IDAT", deflateSync(raw));
  const iend = createChunk("IEND", Buffer.alloc(0));
  return Buffer.concat([header, ihdr, idat, iend]);
}

function buildIhdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
