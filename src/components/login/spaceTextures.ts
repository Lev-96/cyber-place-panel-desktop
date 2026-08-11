import * as THREE from "three";

/**
 * Textures for the login backdrop, drawn at runtime onto a canvas.
 *
 * ## Why generated and not shipped as images
 * A moon and a nebula would otherwise be two more binary assets to package,
 * version and keep in sync with the palette — and the packaged Electron app
 * may run offline on a venue machine, so nothing can be fetched. Drawing them
 * costs a few milliseconds once, weighs nothing, and lets the nebula follow the
 * brand colours instead of pinning its own.
 *
 * Both textures are created once per app run and reused: `CanvasTexture`
 * uploads to the GPU on first render, so re-creating them per mount would
 * re-upload for no reason.
 */

/**
 * A cratered lunar surface.
 *
 * Built in three passes, which is roughly how a moon actually reads at a
 * glance: a pale base, the dark maria, then craters with a lit rim and a
 * shaded floor. The rim/floor pair is what gives each crater relief — a flat
 * grey disc reads as a stain rather than a hole.
 */
export const createMoonTexture = (): THREE.Texture => {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.Texture();

  ctx.fillStyle = "#d6dce8";
  ctx.fillRect(0, 0, size, size);

  // Maria — the large dark plains. Soft-edged, so they read as shading rather
  // than as painted shapes.
  for (let i = 0; i < 9; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 40 + Math.random() * 90;
    const blob = ctx.createRadialGradient(x, y, 0, x, y, r);
    blob.addColorStop(0, "rgba(120, 133, 158, 0.55)");
    blob.addColorStop(1, "rgba(120, 133, 158, 0)");
    ctx.fillStyle = blob;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 120; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2 + Math.random() * 16;

    // Lit rim.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Shaded floor.
    const floor = ctx.createRadialGradient(x, y, 0, x, y, r);
    floor.addColorStop(0, "rgba(96, 106, 128, 0.5)");
    floor.addColorStop(1, "rgba(96, 106, 128, 0)");
    ctx.fillStyle = floor;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/**
 * A soft two-tone cloud for the nebula, in the brand's cyan and violet.
 *
 * Transparent at the edges so the plane it is mapped onto has no visible
 * border — the whole point is that the viewer never perceives a quad.
 */
export const createNebulaTexture = (): THREE.Texture => {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.Texture();

  ctx.clearRect(0, 0, size, size);

  const clouds: Array<[number, number, number, string]> = [
    [size * 0.38, size * 0.44, size * 0.42, "7, 221, 241"],
    [size * 0.62, size * 0.56, size * 0.36, "209, 82, 250"],
    [size * 0.5, size * 0.38, size * 0.3, "50, 175, 247"],
  ];

  clouds.forEach(([x, y, r, rgb]) => {
    const cloud = ctx.createRadialGradient(x, y, 0, x, y, r);
    cloud.addColorStop(0, `rgba(${rgb}, 0.5)`);
    cloud.addColorStop(0.45, `rgba(${rgb}, 0.16)`);
    cloud.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = cloud;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/**
 * A soft round falloff, white in the middle and transparent at the rim.
 *
 * Used for the moon's halo and as the alpha of the stars. Points and sprites
 * are square quads by default — without a texture like this the "stars" render
 * as visible squares and a halo renders as a grey rectangle, which is exactly
 * how both looked before this existed.
 */
export const createGlowTexture = (): THREE.Texture => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.Texture();

  const half = size / 2;
  const glow = ctx.createRadialGradient(half, half, 0, half, half, half);
  glow.addColorStop(0, "rgba(255, 255, 255, 1)");
  glow.addColorStop(0.25, "rgba(255, 255, 255, 0.65)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
};

/**
 * A planet surface: banded cloud belts over a base hue, with a few storms.
 *
 * `hue` is in degrees, so one generator covers the whole family — a rust-red
 * world and an ice-blue one differ by a number rather than by a second
 * function. Bands run horizontally because the texture is wrapped around a
 * sphere spinning about Y: they become latitude belts, which is what makes a
 * gas giant read as one.
 */
export const createPlanetTexture = (hue: number): THREE.Texture => {
  const width = 512;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new THREE.Texture();

  ctx.fillStyle = `hsl(${hue}, 26%, 32%)`;
  ctx.fillRect(0, 0, width, height);

  // Belts. Varying height and lightness stops them reading as a barcode.
  let y = 0;
  while (y < height) {
    const band = 6 + Math.random() * 26;
    const lightness = 20 + Math.random() * 24;
    ctx.fillStyle = `hsla(${hue + (Math.random() * 20 - 10)}, 28%, ${lightness}%, 0.7)`;
    ctx.fillRect(0, y, width, band);
    y += band;
  }

  // Storms — soft ovals riding the belts.
  for (let i = 0; i < 14; i += 1) {
    const x = Math.random() * width;
    const cy = Math.random() * height;
    const rx = 8 + Math.random() * 34;
    const ry = rx * (0.35 + Math.random() * 0.3);
    const storm = ctx.createRadialGradient(x, cy, 0, x, cy, rx);
    storm.addColorStop(0, `hsla(${hue + 15}, 34%, 58%, 0.4)`);
    storm.addColorStop(1, `hsla(${hue + 15}, 34%, 58%, 0)`);
    ctx.fillStyle = storm;
    ctx.beginPath();
    ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Wrapping horizontally hides the seam where the texture meets itself.
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
};
