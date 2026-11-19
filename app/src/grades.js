// grades.js — the 5 colour grades for Velvet Heat.
// Each grade is a { filter, overlays } pair applied when a photo is drawn:
// the canvas filter tints the pixels, then one or two translucent gradient
// overlays are composited on top. Every grade has a distinct pixel signature
// (different filter + different overlay hues), so the same photo renders
// measurably differently under each grade.

export const GRADES = ["Sunset", "Golden Hour", "Vice Neon", "Noir", "Palm"];

// Grade names double as the <select> values, so keep them exactly as the
// UI shows them: Title Case, single spaces, no punctuation.

// A gradient overlay: [x0, y0, x1, y1] in unit space, colour stops,
// composite operation and alpha.
function overlay(x0, y0, x1, y1, stops, composite, alpha) {
  return { x0, y0, x1, y1, stops, composite, alpha };
}

export const GRADE_DEFS = {
  "Sunset": {
    filter: "saturate(1.35) sepia(0.25) hue-rotate(-12deg) brightness(1.03)",
    overlays: [
      overlay(0, 0, 0, 1, [[0, "rgba(255,120,60,1)"], [1, "rgba(255,60,140,1)"]], "overlay", 0.20),
    ],
  },
  "Golden Hour": {
    filter: "sepia(0.5) saturate(1.6) brightness(1.08) contrast(1.05)",
    overlays: [
      overlay(0, 0, 1, 1, [[0, "rgba(255,190,80,1)"], [1, "rgba(255,140,40,1)"]], "soft-light", 0.28),
      overlay(0, 0, 0, 1, [[0, "rgba(255,220,140,0.9)"], [1, "rgba(255,160,60,0.9)"]], "overlay", 0.12),
    ],
  },
  "Vice Neon": {
    // Strong pink/teal separation: the pink wash comes from the top, the
    // teal wash from the bottom, both in screen mode so neither muddies.
    filter: "saturate(1.9) contrast(1.12) hue-rotate(8deg) brightness(1.02)",
    overlays: [
      overlay(0, 0, 0, 0.55, [[0, "rgba(255,45,149,1)"], [1, "rgba(255,45,149,0)"]], "screen", 0.30),
      overlay(0, 0.45, 0, 1, [[0, "rgba(45,226,230,0)"], [1, "rgba(45,226,230,1)"]], "screen", 0.30),
    ],
  },
  "Noir": {
    // Deep blacks, bright highlights: full desaturation plus a hard contrast
    // lift, with a faint cool vignette tint so it is not flat grey.
    filter: "grayscale(1) contrast(1.42) brightness(0.92)",
    overlays: [
      overlay(0, 0, 0, 1, [[0, "rgba(10,14,30,1)"], [1, "rgba(10,14,30,0)"]], "multiply", 0.10),
    ],
  },
  "Palm": {
    filter: "saturate(1.35) hue-rotate(-18deg) contrast(1.05) brightness(1.01)",
    overlays: [
      overlay(0, 0, 1, 1, [[0, "rgba(30,200,160,1)"], [1, "rgba(20,120,90,1)"]], "overlay", 0.16),
    ],
  },
};

// Draw `img` cover-fitting rect (x, y, w, h) on ctx with the named grade.
// The grade is applied by drawing with ctx.filter and then painting the
// grade's overlays clipped to the same rect.
export function drawGraded(ctx, img, x, y, w, h, gradeName) {
  const def = GRADE_DEFS[gradeName] || GRADE_DEFS["Sunset"];
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.filter = def.filter;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.filter = "none";
  for (const ov of def.overlays) {
    const g = ctx.createLinearGradient(
      x + ov.x0 * w, y + ov.y0 * h, x + ov.x1 * w, y + ov.y1 * h,
    );
    for (const [stop, color] of ov.stops) g.addColorStop(stop, color);
    ctx.globalCompositeOperation = ov.composite;
    ctx.globalAlpha = ov.alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// Render a graded copy of `img` into a fresh offscreen canvas of size w x h.
// Used by the ink engine, which needs pixels to posterize.
export function gradedCanvas(img, w, h, gradeName) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d");
  drawGraded(ctx, img, 0, 0, c.width, c.height, gradeName);
  return c;
}
