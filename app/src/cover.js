// cover.js — the cover renderer for Velvet Heat.
// Draws the 9-panel grid + title band onto a canvas, in two engines:
//   photo: the photo as-is, with its grade.
//   ink:   posterize to 6 levels at 78% strength, then a halftone dot screen
//          (5px cells), with 30% of the original photo blended back inside
//          a face window ("whisper 0.30") so faces stay readable.
// Everything here is deterministic for identical state.

import { drawGraded, gradedCanvas } from "./grades.js";
import { templateById } from "./templates.js";

export const COVER_SIZE = 1080;
export const INK_LEVELS = 6;
export const INK_STRENGTH = 0.78;
export const HALFTONE_CELL = 5;
export const FACE_WHISPER = 0.3;

// ---------------------------------------------------------------------------
// Face window: scan the photo for skin-tone density and take the densest
// window, enlarged by ~20% margin; fall back to a centred window covering
// the middle 40% of the frame when no skin region is found. The window is
// used ONLY to soften the ink there; it never blanks the panel.
// ---------------------------------------------------------------------------

function isSkin(r, g, b) {
  if (!(r > g && g > b)) return false;
  if (r < 90 || r > 250) return false;
  const rg = r - g;
  const gb = g - b;
  return rg >= 10 && rg <= 80 && gb >= 5 && gb <= 60;
}

export function findFaceWindow(data, w, h) {
  const step = 8;
  const winW = Math.round(w * 0.4);
  const winH = Math.round(h * 0.4);
  let best = null;
  let bestScore = 0;
  for (let wy = 0; wy + winH <= h; wy += step * 2) {
    for (let wx = 0; wx + winW <= w; wx += step * 2) {
      let score = 0;
      for (let y = wy; y < wy + winH; y += step) {
        for (let x = wx; x < wx + winW; x += step) {
          const i = (y * w + x) * 4;
          if (isSkin(data[i], data[i + 1], data[i + 2])) score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = { x: wx, y: wy, w: winW, h: winH };
      }
    }
  }
  const minScore = Math.round(((winW / step) * (winH / step)) * 0.04);
  if (!best || bestScore < minScore) {
    // Fallback: centred window covering the middle 40%.
    return {
      x: Math.round(w * 0.3),
      y: Math.round(h * 0.3),
      w: winW,
      h: winH,
    };
  }
  // Enlarge by ~20% margin around the densest window.
  const mx = best.w * 0.2;
  const my = best.h * 0.2;
  return {
    x: Math.max(0, Math.round(best.x - mx)),
    y: Math.max(0, Math.round(best.y - my)),
    w: Math.min(w, Math.round(best.w + mx * 2)),
    h: Math.min(h, Math.round(best.h + my * 2)),
  };
}

// ---------------------------------------------------------------------------
// Ink engine
// ---------------------------------------------------------------------------

// Pre-rendered dot sprites (radius 0.5..2.5px) so the halftone loop is a
// fast drawImage per cell instead of an arc path per cell.
const dotSprites = [];
function dotSprite(r) {
  const size = Math.ceil(r * 2) + 2;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a0b12";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.fill();
  return c;
}
for (let k = 0; k <= 9; k++) dotSprites.push(dotSprite(0.5 + k * 0.25));

function posterize(data, levels, strength) {
  const step = 255 / (levels - 1);
  for (let i = 0; i < data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const v = data[i + ch];
      const q = Math.round(v / step) * step;
      data[i + ch] = Math.round(v + (q - v) * strength);
    }
  }
}

// Draw the ink version of `img` (already graded to `src`, a canvas of the
// panel's size) into rect (x, y, w, h) of ctx.
function drawInk(ctx, src, x, y, w, h) {
  const iw = Math.max(8, Math.round(w));
  const ih = Math.max(8, Math.round(h));
  const off = document.createElement("canvas");
  off.width = iw;
  off.height = ih;
  const octx = off.getContext("2d");
  octx.drawImage(src, 0, 0, iw, ih);
  const imageData = octx.getImageData(0, 0, iw, ih);
  posterize(imageData.data, INK_LEVELS, INK_STRENGTH);
  octx.putImageData(imageData, 0, 0);

  // Halftone: cream paper, one dark dot per 5px cell, sized by darkness.
  const paper = document.createElement("canvas");
  paper.width = iw;
  paper.height = ih;
  const pctx = paper.getContext("2d");
  pctx.fillStyle = "#f6e8d8";
  pctx.fillRect(0, 0, iw, ih);
  const px = imageData.data;
  for (let cy = 0; cy < ih; cy += HALFTONE_CELL) {
    for (let cx = 0; cx < iw; cx += HALFTONE_CELL) {
      // One sample per cell (its centre pixel): the posterize step already
      // flattened the tones, so sub-sampling the cell adds nothing but cost.
      const sx = Math.min(iw - 1, cx + (HALFTONE_CELL >> 1));
      const sy = Math.min(ih - 1, cy + (HALFTONE_CELL >> 1));
      const i = (sy * iw + sx) * 4;
      const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      const darkness = 1 - lum / 255;
      if (darkness < 0.08) continue;
      const sprite = dotSprites[Math.min(9, Math.round(darkness * 9))];
      pctx.drawImage(
        sprite,
        cx + HALFTONE_CELL / 2 - sprite.width / 2,
        cy + HALFTONE_CELL / 2 - sprite.height / 2,
      );
    }
  }

  // Face whisper: blend 30% of the graded original back inside the face
  // window so faces stay recognisable under the ink.
  const face = findFaceWindow(px, iw, ih);
  const faceSrc = document.createElement("canvas");
  faceSrc.width = face.w;
  faceSrc.height = face.h;
  const fctx = faceSrc.getContext("2d");
  fctx.drawImage(src, face.x, face.y, face.w, face.h, 0, 0, face.w, face.h);
  // Feather the window's edges with an elliptical radial mask so the
  // whisper blends into the halftone instead of ending in a hard rectangle.
  fctx.globalCompositeOperation = "destination-in";
  const mask = fctx.createRadialGradient(
    face.w / 2, face.h / 2, Math.min(face.w, face.h) * 0.28,
    face.w / 2, face.h / 2, Math.max(face.w, face.h) * 0.62,
  );
  mask.addColorStop(0, "rgba(0,0,0,1)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  fctx.fillStyle = mask;
  fctx.fillRect(0, 0, face.w, face.h);
  fctx.globalCompositeOperation = "source-over";
  pctx.save();
  pctx.globalAlpha = FACE_WHISPER;
  pctx.drawImage(faceSrc, face.x, face.y);
  pctx.restore();

  ctx.drawImage(paper, x, y, w, h);
}

// ---------------------------------------------------------------------------
// Panel drawing
// ---------------------------------------------------------------------------

// Draw one panel's photo into rect, honouring the panel's transform
// (dx, dy offset in cover px, zoom, rotation in degrees) and its engine
// and grade. `photoImg` is the loaded Image for the panel's photo.
export function drawPanel(ctx, rect, photoImg, panel, engine, grade) {
  if (!photoImg) return;
  const { x, y, w, h } = rect;
  const rot = ((panel && panel.rot) || 0) * (Math.PI / 180);
  const zoom = (panel && panel.zoom) || 1;
  const dx = (panel && panel.dx) || 0;
  const dy = (panel && panel.dy) || 0;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // Dark gutter backing so any gap under a rotated panel reads as a gutter.
  ctx.fillStyle = "#140a12";
  ctx.fillRect(x, y, w, h);
  ctx.translate(x + w / 2 + dx, y + h / 2 + dy);
  if (rot) ctx.rotate(rot);
  if (zoom !== 1) ctx.scale(zoom, zoom);
  // Draw oversized (1.6x) so rotation corners stay covered.
  const dw = w * 1.6;
  const dh = h * 1.6;
  if (engine === "ink") {
    const src = gradedCanvas(photoImg, Math.round(w), Math.round(h), grade);
    const ink = document.createElement("canvas");
    ink.width = Math.round(dw);
    ink.height = Math.round(dh);
    const ictx = ink.getContext("2d");
    drawInk(ictx, src, 0, 0, ink.width, ink.height);
    ctx.drawImage(ink, -dw / 2, -dh / 2, dw, dh);
  } else {
    drawGraded(ctx, photoImg, -dw / 2, -dh / 2, dw, dh, grade);
  }
  ctx.restore();
}

// Draw a single photo filling the whole canvas in the given engine/grade.
// Used by the dual-engine comparison scene.
export function drawSinglePanel(canvas, img, engine, grade) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPanel(
    ctx,
    { x: 0, y: 0, w: canvas.width, h: canvas.height },
    img,
    { dx: 0, dy: 0, zoom: 1, rot: 0 },
    engine,
    grade,
  );
}

// Panels to actually paint for a template: deduped by rect, keeping the
// first panel index per rect (hero/magazine layouts share rects across
// slots, and a shared rect is painted once, by its first panel).
export function layoutPanels(template) {
  const seen = new Set();
  const out = [];
  template.panels.forEach((rect, index) => {
    const key = `${rect.x}|${rect.y}|${rect.w}|${rect.h}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ index, rect });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Title band: skyline silhouette, starburst, title, subtitle, HEAT stars,
// tagline. `band` is "bottom" | "top" | "masthead".
// ---------------------------------------------------------------------------

function fitFont(ctx, text, maxWidth, startPx, fontFn) {
  let px = startPx;
  ctx.font = fontFn(px);
  while (px > 18 && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = fontFn(px);
  }
  return px;
}

function drawSkyline(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = "rgba(20,8,18,0.85)";
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  let cx = x;
  const base = y + h;
  while (cx < x + w) {
    const bw = 28 + ((cx * 7) % 46);
    const bh = h * (0.35 + ((cx * 13) % 55) / 100);
    ctx.lineTo(cx, base - bh);
    ctx.lineTo(cx + bw * 0.45, base - bh);
    ctx.lineTo(cx + bw * 0.45, base - bh - 10);
    ctx.lineTo(cx + bw * 0.6, base - bh - 10);
    ctx.lineTo(cx + bw * 0.6, base - bh);
    ctx.lineTo(cx + bw, base - bh);
    ctx.lineTo(cx + bw, base);
    cx += bw + 6;
  }
  ctx.lineTo(x + w, base);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStarburst(ctx, cx, cy, rOuter, rInner, points) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(255,190,80,0.28)";
  ctx.fill();
  ctx.restore();
}

function drawTitleBand(ctx, state, template) {
  const W = COVER_SIZE;
  const band = template.band;
  const bandH = band === "masthead" ? 0 : 168;
  const bandY = band === "top" ? 0 : 1080 - bandH;
  const cx = W / 2;

  if (band === "masthead") {
    // Magazine masthead: big title across the top over the photo, with a
    // halftone block behind it and cover lines down the bottom-left.
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, "rgba(20,6,16,0.88)");
    g.addColorStop(1, "rgba(20,6,16,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 260);
    ctx.restore();
    drawStarburst(ctx, cx, 118, 150, 96, 12);
    const px = fitFont(ctx, state.title, 980, 128, (s) => `${s}px Anton, sans-serif`);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${px}px Anton, sans-serif`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(20,6,16,0.9)";
    ctx.strokeText(state.title, cx, 112);
    const tg = ctx.createLinearGradient(cx - 420, 0, cx + 420, 0);
    tg.addColorStop(0, "#ffe9a8");
    tg.addColorStop(0.5, "#ffffff");
    tg.addColorStop(1, "#ffb3d1");
    ctx.fillStyle = tg;
    ctx.fillText(state.title, cx, 112);
    ctx.restore();
    // Cover lines.
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "44px Pacifico, cursive";
    ctx.fillStyle = "#ffd166";
    ctx.fillText(state.subtitle, 56, 930);
    ctx.font = "30px Anton, sans-serif";
    ctx.fillStyle = "#ffffff";
    const lines = ["INSIDE: THE NEON SHORE", "PALMS • HEAT • GOLDEN HOUR", state.tagline];
    lines.forEach((line, i) => ctx.fillText(line, 56, 990 + i * 44));
    ctx.restore();
    return;
  }

  // Bottom / top band: dark panel with skyline, starburst, title, subtitle,
  // HEAT stars and the tagline.
  ctx.save();
  const bg = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  bg.addColorStop(0, "#1c0a16");
  bg.addColorStop(1, "#0d050c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, bandY, W, bandH);
  ctx.restore();

  drawSkyline(ctx, 0, bandY, W, 46);
  drawStarburst(ctx, cx, bandY + bandH / 2, 120, 78, 12);

  const titlePx = fitFont(
    ctx, state.title, 960, 96,
    (s) => `${s}px Anton, sans-serif`,
  );
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const titleY = bandY + 66;
  ctx.font = `${titlePx}px Anton, sans-serif`;
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(10,4,10,0.85)";
  ctx.strokeText(state.title, cx, titleY);
  let fill;
  if (template.titleStyle === "gradient") {
    fill = ctx.createLinearGradient(cx - 400, 0, cx + 400, 0);
    fill.addColorStop(0, "#ffb347");
    fill.addColorStop(0.5, "#ff5e7a");
    fill.addColorStop(1, "#c86bff");
  } else if (template.titleStyle === "neon") {
    fill = ctx.createLinearGradient(cx - 400, 0, cx + 400, 0);
    fill.addColorStop(0, "#ff2d95");
    fill.addColorStop(0.5, "#ffffff");
    fill.addColorStop(1, "#2de2e6");
  } else if (template.titleStyle === "hero") {
    fill = "#ffe9a8";
  } else {
    fill = "#fdf6e3";
  }
  ctx.fillStyle = fill;
  ctx.fillText(state.title, cx, titleY);
  ctx.restore();

  // Pacifico subtitle, tucked under the title.
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const subPx = fitFont(ctx, state.subtitle, 560, 40, (s) => `${s}px Pacifico, cursive`);
  ctx.font = `${subPx}px Pacifico, cursive`;
  ctx.fillStyle = template.titleStyle === "neon" ? "#2de2e6" : "#ff8fb8";
  ctx.fillText(state.subtitle, cx, bandY + 122);
  ctx.restore();

  // HEAT stars + tagline, one row, centred.
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "26px Anton, sans-serif";
  ctx.fillStyle = "#ffd166";
  const stars = "★ ★ ★ ★ ★";
  const tag = state.tagline || "SUMMER 2026";
  const tagPx = fitFont(ctx, tag, 420, 30, (s) => `${s}px Anton, sans-serif`);
  const rowY = bandY + bandH - 22;
  ctx.font = "26px Anton, sans-serif";
  ctx.fillText(stars, cx - 250, rowY);
  ctx.font = `${tagPx}px Anton, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(tag, cx + 250, rowY);
  ctx.restore();

  // Badge ribbon for the Palm Grid template.
  if (template.flags.badge) {
    ctx.save();
    ctx.translate(980, bandY + 84);
    ctx.rotate(0.12);
    ctx.fillStyle = "#ff2d95";
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffe9a8";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "22px Anton, sans-serif";
    ctx.fillText("EST.", 0, -12);
    ctx.fillText("2026", 0, 14);
    ctx.restore();
  }
}

// Grain + vignette overlays for the Sunset Sleeve template.
function drawFinish(ctx, template) {
  if (template.flags.vignette) {
    const g = ctx.createRadialGradient(540, 540, 380, 540, 540, 780);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(10,4,10,0.42)");
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, COVER_SIZE, COVER_SIZE);
    ctx.restore();
  }
  if (template.flags.grain) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 2600; i++) {
      const x = (i * 7919) % COVER_SIZE;
      const y = (i * 104729) % COVER_SIZE;
      ctx.fillStyle = i % 2 ? "#ffffff" : "#000000";
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Main entry: draw the whole cover for `state` onto `canvas`.
// `photos` is a Map from photo name to a loaded Image (or data-URL image).
// `state.panels[i]` = { photo, engine, grade, dx, dy, zoom, rot }.
// ---------------------------------------------------------------------------

export function drawCover(canvas, state, photos) {
  const template = templateById(state.template);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0d050c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scale = canvas.width / COVER_SIZE;
  ctx.save();
  ctx.scale(scale, scale);
  for (const { index, rect } of layoutPanels(template)) {
    const panel = state.panels[index] || {};
    const photoName = panel.photo || "portrait";
    const img = photos.get(photoName);
    const engine = panel.engine || state.engine || template.engine;
    const grade = panel.grade || state.grade || template.grade;
    drawPanel(ctx, rect, img, panel, engine, grade);
  }
  // Thin dark gutters between panels are the canvas background showing
  // through the gaps between rects.
  drawTitleBand(ctx, state, template);
  drawFinish(ctx, template);
  ctx.restore();
}

// Render the cover at an export size (w x h): the square 1080 design is
// scaled to fit and letterboxed on a dark gradient so every export keeps
// the same composition.
export function renderCoverToSize(state, photos, w, h) {
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#160a14");
  bg.addColorStop(1, "#0a0409");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const square = document.createElement("canvas");
  square.width = COVER_SIZE;
  square.height = COVER_SIZE;
  drawCover(square, state, photos);
  const scale = Math.min(w / COVER_SIZE, h / COVER_SIZE);
  const dw = COVER_SIZE * scale;
  const dh = COVER_SIZE * scale;
  ctx.drawImage(square, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return out;
}
