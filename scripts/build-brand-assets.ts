/**
 * Builds web-ready brand assets from the source logos in /brand.
 *
 * Run with: npm run brand
 *
 * Outputs (to public/brand and src/app):
 *  - SVG traces of both logos (light + dark variants)
 *  - WebP/PNG fallbacks at sensible sizes
 *  - Favicon, apple-touch icon and PWA icons from the orange pin
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Potrace } from "potrace";

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "brand");
const OUT = path.join(ROOT, "public", "brand");
const APP = path.join(ROOT, "src", "app");

// Brand colours from the brief. Dark mode uses a lighter teal tint for the wordmark.
const TEAL = "#0D9488";
const TEAL_DARK_MODE = "#2DD4BF";
const ORANGE = "#F97316";

type Rgba = { data: Buffer; width: number; height: number };

async function loadRgba(file: string, maxWidth?: number): Promise<Rgba> {
  let img = sharp(path.join(SRC, file)).ensureAlpha();
  if (maxWidth) img = img.resize({ width: maxWidth, withoutEnlargement: true });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

type Layer = "teal" | "orange" | "dark";

function classify(r: number, g: number, b: number, a: number): Layer | null {
  if (a < 128) return null;
  if (r > 200 && g > 200 && b > 200) return null; // white background (jpg)
  if (r > g + 50 && r > b + 80) return "orange";
  if (g > r + 40 && b > r + 30) return "teal";
  if (r < 90 && g < 90 && b < 90) return "dark";
  return null;
}

/** Black-on-white PNG mask of one colour layer, for potrace. */
async function maskFor(img: Rgba, layer: Layer): Promise<Buffer> {
  const out = Buffer.alloc(img.width * img.height);
  for (let i = 0; i < img.width * img.height; i++) {
    const o = i * 4;
    const hit =
      classify(img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]) === layer;
    out[i] = hit ? 0 : 255;
  }
  return sharp(out, { raw: { width: img.width, height: img.height, channels: 1 } })
    .png()
    .toBuffer();
}

function tracePath(mask: Buffer, fill: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = new Potrace({ turdSize: 8, optTolerance: 0.3, threshold: 128 });
    // At runtime potrace calls back with (error) only; its type definitions disagree.
    const done = (err: Error | null) => (err ? reject(err) : resolve(p.getPathTag(fill, 1)));
    p.loadImage(mask, done as unknown as (potrace: Potrace, error: Error | null) => void);
  });
}

async function traceLogo(
  file: string,
  layers: { layer: Layer; fill: string; className: string }[],
  maxWidth?: number,
) {
  const img = await loadRgba(file, maxWidth);
  const paths: string[] = [];
  for (const l of layers) {
    const tag = await tracePath(await maskFor(img, l.layer), l.fill);
    paths.push(tag.replace("<path ", `<path class="${l.className}" `));
  }
  return { width: img.width, height: img.height, paths };
}

function svgDoc(width: number, height: number, title: string, body: string[]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><title>${title}</title>${body.join("")}</svg>\n`;
}

/** Bounding box of the orange pixels in the right half = the map pin ("Hub" sits on the left). */
function pinBox(img: Rgba) {
  let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = Math.floor(img.width / 2); x < img.width; x++) {
      const o = (y * img.width + x) * 4;
      if (classify(img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]) === "orange") {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Cuts the pin out of the logo. Keeps orange pixels plus teal pixels that don't touch
 * the crop edge (the smile), dropping slivers of neighbouring letters.
 */
function cutPin(img: Rgba, box: ReturnType<typeof pinBox>): Buffer {
  const { left, top, width, height } = box;
  const at = (x: number, y: number) => ((top + y) * img.width + (left + x)) * 4;
  const layerAt = (x: number, y: number) => {
    const o = at(x, y);
    return classify(img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]);
  };

  // Flood-fill teal from the crop border to find letter fragments.
  const letter = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) stack.push(x, 0, x, height - 1);
  for (let y = 0; y < height; y++) stack.push(0, y, width - 1, y);
  while (stack.length) {
    const y = stack.pop()!, x = stack.pop()!;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const i = y * width + x;
    if (letter[i] || layerAt(x, y) !== "teal") continue;
    letter[i] = 1;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const layer = layerAt(x, y);
      if (layer === "orange" || (layer === "teal" && !letter[i])) {
        img.data.copy(out, i * 4, at(x, y), at(x, y) + 4);
      }
    }
  }

  // Fill the hole inside the pin with white so the favicon reads on dark browser tabs.
  const outside = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) stack.push(x, 0, x, height - 1);
  for (let y = 0; y < height; y++) stack.push(0, y, width - 1, y);
  while (stack.length) {
    const y = stack.pop()!, x = stack.pop()!;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const i = y * width + x;
    if (outside[i] || out[i * 4 + 3] > 128) continue;
    outside[i] = 1;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  for (let i = 0; i < width * height; i++) {
    if (!outside[i] && out[i * 4 + 3] <= 128) {
      // Blend any anti-aliased edge pixel onto white.
      const a = out[i * 4 + 3] / 255;
      for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(out[i * 4 + c] * a + 255 * (1 - a));
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  // 1. Waypoint Hub logo (app logo): teal wordmark + orange pin.
  const hub = await traceLogo("waypoint-hub-logo-transparent.png", [
    { layer: "teal", fill: TEAL, className: "teal" },
    { layer: "orange", fill: ORANGE, className: "orange" },
  ]);
  await fs.writeFile(path.join(OUT, "waypoint-hub-logo.svg"), svgDoc(hub.width, hub.height, "Waypoint Hub", hub.paths));
  await fs.writeFile(
    path.join(OUT, "waypoint-hub-logo-dark.svg"),
    svgDoc(hub.width, hub.height, "Waypoint Hub", hub.paths.map((p) => p.replace(TEAL, TEAL_DARK_MODE))),
  );

  // 2. Waypoint Connect logo (public-facing). Large source, so trace at 2400px wide.
  const connect = await traceLogo(
    "waypoint-connect-logo.png",
    [
      { layer: "teal", fill: TEAL, className: "teal" },
      { layer: "orange", fill: ORANGE, className: "orange" },
    ],
    2400,
  );
  await fs.writeFile(path.join(OUT, "waypoint-connect-logo.svg"), svgDoc(connect.width, connect.height, "Waypoint Connect", connect.paths));
  await fs.writeFile(
    path.join(OUT, "waypoint-connect-logo-dark.svg"),
    svgDoc(connect.width, connect.height, "Waypoint Connect", connect.paths.map((p) => p.replace(TEAL, TEAL_DARK_MODE))),
  );

  // 3. Raster fallbacks (for emails and PDFs, where SVG support is patchy).
  for (const [file, name] of [
    ["waypoint-hub-logo-transparent.png", "waypoint-hub-logo"],
    ["waypoint-connect-logo.png", "waypoint-connect-logo"],
  ] as const) {
    for (const w of [240, 480, 960]) {
      const base = sharp(path.join(SRC, file)).resize({ width: w });
      await base.clone().webp({ quality: 90 }).toFile(path.join(OUT, `${name}-${w}.webp`));
      await base.clone().png({ compressionLevel: 9 }).toFile(path.join(OUT, `${name}-${w}.png`));
    }
  }

  // 4. Pin icon (orange pin + teal smile), cropped square from the hub logo.
  const hubImg = await loadRgba("waypoint-hub-logo-transparent.png");
  const box = pinBox(hubImg);
  const side = Math.max(box.width, box.height);
  const pin = await sharp(cutPin(hubImg, box), { raw: { width: box.width, height: box.height, channels: 4 } })
    .resize({ width: side, height: side, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Transparent pin for in-app use.
  await sharp(pin).resize(256, 256).png().toFile(path.join(OUT, "pin-256.png"));

  // Icons on a white rounded tile so they read on any home screen.
  const tile = async (size: number, padding: number) => {
    const inner = Math.round(size * (1 - padding * 2));
    const pinImg = await sharp(pin).resize(inner, inner).png().toBuffer();
    return sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
      .composite([{ input: pinImg, gravity: "center" }])
      .png();
  };
  await (await tile(192, 0.1)).toFile(path.join(OUT, "icon-192.png"));
  await (await tile(512, 0.1)).toFile(path.join(OUT, "icon-512.png"));
  // Maskable icons need the artwork inside the central 80% "safe zone".
  await (await tile(512, 0.2)).toFile(path.join(OUT, "icon-maskable-512.png"));
  await (await tile(180, 0.12)).toFile(path.join(APP, "apple-icon.png"));
  // Next.js picks up src/app/icon.png as the favicon.
  await sharp(pin).resize(64, 64).png().toFile(path.join(APP, "icon.png"));

  console.log("Brand assets written to public/brand and src/app");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
