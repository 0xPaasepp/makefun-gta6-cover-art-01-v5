// shots.js — the ?shot= scenes for Velvet Heat.
// runShot(shot, query, api) sets up a fixed scene for screenshots and sets
// window.__shotReady = true once painted (after 2 requestAnimationFrame).
// Scenes: cover (cover alone, controls hidden), editor (editor with a
// sample photo loaded), export (exported covers on show), dual (same photo
// in the ink engine vs the photo engine, side by side).
// Each scene sets a distinct bodyClass so the layout adapts.

import { drawCover, drawSinglePanel, renderCoverToSize } from "./cover.js";

function readyAfterPaint() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}

function showOnly(id) {
  for (const el of document.querySelectorAll(".shot-showcase")) {
    el.hidden = true;
  }
  if (id) {
    const el = document.getElementById(id);
    if (el) el.hidden = false;
  }
}

export async function runShot(shot, query, api) {
  const photo = query.get("photo") || "portrait";
  const caption = query.get("caption") || "Velvet Heat";
  // Clear any previous scene's showcase content so a re-run never shows
  // stale canvases from the last scene.
  for (const el of document.querySelectorAll(".shot-showcase")) {
    el.innerHTML = "";
  }
  document.body.classList.remove("shot-cover", "shot-editor", "shot-export", "shot-dual");
  document.body.classList.add("shot-" + shot);

  if (shot === "cover") {
    showOnly(null);
    api.setPhotoForAll(photo);
    api.setCaption(caption);
    api.setTemplate("ink-heat");
    await api.render();
    readyAfterPaint();
    return;
  }

  if (shot === "editor") {
    showOnly(null);
    api.setPhotoForAll(photo);
    api.setCaption(caption);
    api.setTemplate("ink-heat");
    await api.render();
    readyAfterPaint();
    return;
  }

  if (shot === "export") {
    showOnly("export-showcase");
    api.setPhotoForAll(photo);
    api.setCaption(caption);
    api.setTemplate("ink-heat");
    await api.render();
    // Render the three export sizes into the showcase row.
    const box = document.getElementById("export-showcase");
    box.innerHTML = "";
    const sizes = [
      [1080, 1080],
      [1080, 1350],
      [1920, 1080],
    ];
    for (const [w, h] of sizes) {
      const big = renderCoverToSize(api.state, api.photos, w, h);
      const thumb = document.createElement("canvas");
      const tw = Math.round(360 * (w / Math.max(w, h)));
      const th = Math.round(360 * (h / Math.max(w, h)));
      thumb.width = Math.max(120, tw);
      thumb.height = Math.max(120, th);
      const tctx = thumb.getContext("2d");
      tctx.drawImage(big, 0, 0, thumb.width, thumb.height);
      const wrap = document.createElement("figure");
      const cap = document.createElement("figcaption");
      cap.textContent = `${w} × ${h} PNG`;
      wrap.appendChild(thumb);
      wrap.appendChild(cap);
      box.appendChild(wrap);
    }
    readyAfterPaint();
    return;
  }

  if (shot === "dual") {
    showOnly("dual-showcase");
    api.setPhotoForAll(photo);
    api.setCaption(caption);
    const img = await api.loadPhoto(photo);
    const box = document.getElementById("dual-showcase");
    box.innerHTML = "";
    const defs = [
      ["Ink engine", "ink"],
      ["Photo engine", "photo"],
    ];
    for (const [label, engine] of defs) {
      const c = document.createElement("canvas");
      c.width = 520;
      c.height = 520;
      drawSinglePanel(c, img, engine, api.state.grade || "Sunset");
      const wrap = document.createElement("figure");
      const cap = document.createElement("figcaption");
      cap.textContent = label;
      wrap.appendChild(c);
      wrap.appendChild(cap);
      box.appendChild(wrap);
    }
    // Also paint the main preview as the ink cover so the scene reads as
    // one app, not two loose canvases.
    api.setTemplate("ink-heat");
    await api.render();
    readyAfterPaint();
    return;
  }

  // Unknown shot: fall back to the editor scene.
  showOnly(null);
  api.setPhotoForAll(photo);
  api.setCaption(caption);
  await api.render();
  readyAfterPaint();
}
