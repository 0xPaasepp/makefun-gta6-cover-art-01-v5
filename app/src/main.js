// main.js — wires the Velvet Heat editor page: state, template/engine/grade
// pickers, photo picker + upload, caption/tagline inputs, per-panel
// selection + drag/wheel/rotate, Undo/Redo history, Export-all (3 sizes),
// status line, and ?shot= handling via runShot.

import { drawCover, layoutPanels, renderCoverToSize } from "./cover.js";
import { GRADES } from "./grades.js";
import { TEMPLATES, templateById } from "./templates.js";
import { runShot } from "./shots.js";

export const PHOTOS = [
  "boombox", "boulevard", "convertible", "jetski", "marina",
  "neonstreet", "palmroad", "pier", "portrait", "rooftop", "skate",
];
export const EXPORT_SIZES = [
  [1080, 1080],
  [1080, 1350],
  [1920, 1080],
];

const DEFAULT_PANEL_PHOTOS = [
  "neonstreet", "convertible", "portrait",
  "marina", "palmroad", "jetski",
  "rooftop", "boombox", "skate",
];

function defaultState() {
  return {
    template: "ink-heat",
    engine: "ink",
    grade: "Sunset",
    title: "VELVET HEAT",
    subtitle: "Neon Shore",
    tagline: "SUMMER 2026",
    panels: DEFAULT_PANEL_PHOTOS.map((photo) => ({
      photo, engine: null, grade: null, dx: 0, dy: 0, zoom: 1, rot: 0,
    })),
  };
}

const state = defaultState();
let selectedPanel = 4; // the portrait panel, centre of the grid
const photos = new Map(); // name -> loaded Image

const canvas = document.getElementById("cover");
const statusEl = document.getElementById("status");
const captionInput = document.getElementById("caption");
const taglineInput = document.getElementById("tagline");
const subtitleInput = document.getElementById("subtitle");

window.__state = state;
window.__paintCount = 0;
window.__exportDone = false;
window.__lastExports = [];

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export function loadPhoto(name) {
  if (photos.has(name)) return Promise.resolve(photos.get(name));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      photos.set(name, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error("could not load photo " + name));
    img.src = "./samples/" + name + ".jpg";
  });
}

async function ensurePhotos() {
  const names = new Set(state.panels.map((p) => p.photo));
  await Promise.all([...names].map((n) => loadPhoto(n).catch(() => null)));
}

// ---------------------------------------------------------------------------
// History: snapshot the state on pointerdown / focus BEFORE the mutation,
// so a drag's start state (or a caption's old text) is restorable.
// ---------------------------------------------------------------------------

const history = [];
let historyIndex = -1;

function snapshot() {
  return JSON.stringify(state);
}

function pushHistory() {
  // Drop any redo tail, then record the pre-mutation state.
  history.length = historyIndex + 1;
  history.push(snapshot());
  if (history.length > 50) history.shift();
  historyIndex = history.length - 1;
  syncUndoRedo();
}

// Post-mutation push: record the new state, but only when it actually
// differs from the last history entry. Together with the pre-mutation
// push, this is what makes Redo work: history holds both the state
// before the change and the state after it, so Undo steps back and Redo
// steps forward to the changed state instead of to another copy of the
// old one. The redo tail is dropped when a new change branches off an
// undone state.
function pushIfChanged() {
  const s = snapshot();
  if (history[historyIndex] === s) return;
  history.length = historyIndex + 1;
  history.push(s);
  if (history.length > 50) history.shift();
  historyIndex = history.length - 1;
  syncUndoRedo();
}

function restoreFromSnapshot(json) {
  const parsed = JSON.parse(json);
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, parsed);
  syncControls();
  render();
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  restoreFromSnapshot(history[historyIndex]);
  setStatus("Undid last change.");
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  restoreFromSnapshot(history[historyIndex]);
  setStatus("Redid change.");
}

function syncUndoRedo() {
  const undoBtn = document.getElementById("undo");
  const redoBtn = document.getElementById("redo");
  if (undoBtn) undoBtn.disabled = historyIndex <= 0;
  if (redoBtn) redoBtn.disabled = historyIndex >= history.length - 1;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

let renderQueued = false;

export async function render() {
  if (renderQueued) return;
  renderQueued = true;
  try {
    await ensurePhotos();
    drawCover(canvas, state, photos);
    window.__paintCount++;
  } finally {
    renderQueued = false;
  }
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function buildTemplatePicker() {
  const box = document.getElementById("templates");
  for (const t of TEMPLATES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "template-btn";
    btn.dataset.template = t.id;
    btn.textContent = t.name;
    btn.setAttribute("aria-pressed", t.id === state.template ? "true" : "false");
    btn.addEventListener("click", () => {
      pushIfChanged();
      setTemplate(t.id);
      pushIfChanged();
      render();
      setStatus(`Template: ${t.name}.`);
    });
    box.appendChild(btn);
  }
}

function setTemplate(id) {
  const t = templateById(id);
  state.template = t.id;
  state.engine = t.engine;
  state.grade = t.grade;
  for (const btn of document.querySelectorAll(".template-btn")) {
    btn.setAttribute("aria-pressed", btn.dataset.template === t.id ? "true" : "false");
  }
  const engineInput = document.querySelector(`input[name="engine"][value="${t.engine}"]`);
  if (engineInput) engineInput.checked = true;
  const gradeSelect = document.getElementById("grade");
  if (gradeSelect) gradeSelect.value = t.grade;
}

function buildGradePicker() {
  const select = document.getElementById("grade");
  for (const g of GRADES) {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    select.appendChild(opt);
  }
  select.value = state.grade;
  select.addEventListener("focus", () => pushIfChanged());
  select.addEventListener("change", () => {
    state.grade = select.value;
    pushIfChanged();
    render();
    setStatus(`Grade: ${select.value}.`);
  });
}

function buildEngineSwitch() {
  for (const input of document.querySelectorAll('input[name="engine"]')) {
    input.addEventListener("focus", () => pushIfChanged());
    input.addEventListener("change", () => {
      if (input.checked) {
        state.engine = input.value;
        pushIfChanged();
        render();
        setStatus(`Engine: ${input.value === "ink" ? "Ink" : "Photo"}.`);
      }
    });
  }
}

function buildPhotoPicker() {
  const box = document.getElementById("photos");
  for (const name of PHOTOS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "photo-btn";
    btn.dataset.photo = name;
    btn.textContent = name;
    btn.setAttribute("aria-label", "Use photo " + name);
    btn.addEventListener("click", () => {
      pushIfChanged();
      state.panels[selectedPanel].photo = name;
      pushIfChanged();
      render();
      setStatus(`Panel ${selectedPanel + 1} photo: ${name}.`);
    });
    box.appendChild(btn);
  }
  const upload = document.getElementById("upload");
  upload.addEventListener("change", async () => {
    const file = upload.files && upload.files[0];
    if (!file) return;
    pushIfChanged();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });
    photos.set("upload", img);
    state.panels[selectedPanel].photo = "upload";
    pushIfChanged();
    await render();
    setStatus(`Uploaded ${file.name} into panel ${selectedPanel + 1}.`);
  });
}

function buildTextInputs() {
  captionInput.value = state.title;
  taglineInput.value = state.tagline;
  subtitleInput.value = state.subtitle;
  captionInput.addEventListener("focus", () => pushIfChanged());
  captionInput.addEventListener("input", () => {
    state.title = captionInput.value.toUpperCase();
    pushIfChanged();
    render();
  });
  taglineInput.addEventListener("focus", () => pushIfChanged());
  taglineInput.addEventListener("input", () => {
    state.tagline = taglineInput.value.toUpperCase();
    pushIfChanged();
    render();
  });
  subtitleInput.addEventListener("focus", () => pushIfChanged());
  subtitleInput.addEventListener("input", () => {
    state.subtitle = subtitleInput.value;
    pushIfChanged();
    render();
  });
}

function selectPanel(i) {
  selectedPanel = i;
  const label = document.getElementById("selected-panel");
  if (label) label.textContent = `Panel ${i + 1} of 9`;
  const panel = state.panels[i];
  const rot = document.getElementById("rotate");
  const zoom = document.getElementById("zoom");
  const pg = document.getElementById("panel-grade");
  const pe = document.getElementById("panel-engine");
  if (rot) rot.value = String(panel.rot || 0);
  if (zoom) zoom.value = String(panel.zoom || 1);
  if (pg) pg.value = panel.grade || "";
  if (pe) pe.value = panel.engine || "";
  for (const btn of document.querySelectorAll(".photo-btn")) {
    btn.classList.toggle("active", btn.dataset.photo === panel.photo);
  }
}

function buildPanelControls() {
  const rot = document.getElementById("rotate");
  const zoom = document.getElementById("zoom");
  const pg = document.getElementById("panel-grade");
  const pe = document.getElementById("panel-engine");
  for (const g of GRADES) {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    pg.appendChild(opt);
  }
  rot.addEventListener("focus", () => pushIfChanged());
  rot.addEventListener("input", () => {
    state.panels[selectedPanel].rot = Number(rot.value);
    pushIfChanged();
    render();
  });
  zoom.addEventListener("focus", () => pushIfChanged());
  zoom.addEventListener("input", () => {
    state.panels[selectedPanel].zoom = Number(zoom.value);
    pushIfChanged();
    render();
  });
  pg.addEventListener("focus", () => pushIfChanged());
  pg.addEventListener("change", () => {
    state.panels[selectedPanel].grade = pg.value || null;
    pushIfChanged();
    render();
    setStatus(`Panel ${selectedPanel + 1} grade: ${pg.value || "inherit"}.`);
  });
  pe.addEventListener("focus", () => pushIfChanged());
  pe.addEventListener("change", () => {
    state.panels[selectedPanel].engine = pe.value || null;
    pushIfChanged();
    render();
    setStatus(`Panel ${selectedPanel + 1} engine: ${pe.value || "inherit"}.`);
  });
}

// ---------------------------------------------------------------------------
// Canvas interaction: click to select a panel, drag to move its photo,
// wheel to zoom.
// ---------------------------------------------------------------------------

function canvasPoint(ev) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - rect.left) / rect.width) * canvas.width,
    y: ((ev.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function hitPanel(p) {
  const template = templateById(state.template);
  for (const { index, rect } of layoutPanels(template)) {
    if (p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h) {
      return index;
    }
  }
  return null;
}

function buildCanvasInteraction() {
  let dragging = null;
  let lastWheelPush = 0;

  canvas.addEventListener("pointerdown", (ev) => {
    const p = canvasPoint(ev);
    const hit = hitPanel(p);
    if (hit === null) return;
    pushIfChanged();
    selectPanel(hit);
    const panel = state.panels[hit];
    dragging = { startX: p.x, startY: p.y, dx: panel.dx || 0, dy: panel.dy || 0 };
    canvas.setPointerCapture(ev.pointerId);
  });

  canvas.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const p = canvasPoint(ev);
    const panel = state.panels[selectedPanel];
    panel.dx = dragging.dx + (p.x - dragging.startX);
    panel.dy = dragging.dy + (p.y - dragging.startY);
    render();
  });

  canvas.addEventListener("pointerup", () => {
    if (dragging) pushIfChanged();
    dragging = null;
  });

  canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const now = Date.now();
    if (now - lastWheelPush > 500) {
      pushIfChanged();
      lastWheelPush = now;
    }
    const panel = state.panels[selectedPanel];
    const next = (panel.zoom || 1) * Math.exp(-ev.deltaY * 0.001);
    panel.zoom = Math.min(3, Math.max(1, next));
    pushIfChanged();
    const zoom = document.getElementById("zoom");
    if (zoom) zoom.value = String(panel.zoom);
    render();
  }, { passive: false });
}

// ---------------------------------------------------------------------------
// Export-all: render all 3 post sizes and download them as PNGs.
// ---------------------------------------------------------------------------

export async function exportAll() {
  window.__exportDone = false;
  window.__lastExports = [];
  const done = [];
  for (const [w, h] of EXPORT_SIZES) {
    const out = renderCoverToSize(state, photos, w, h);
    const dataUrl = out.toDataURL("image/png");
    window.__lastExports.push({ w, h, dataUrl });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `velvet-heat-${w}x${h}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    done.push(`${w}×${h}`);
  }
  window.__exportDone = true;
  setStatus(`Exported ${done.join(", ")} as PNG.`);
  return done;
}

window.__exportSize = async (w, h) => {
  await ensurePhotos();
  return renderCoverToSize(state, photos, w, h).toDataURL("image/png");
};

// Test/debug handle: select a panel by index (0-8) and sync the controls.
window.__selectPanel = (i) => {
  selectPanel(Math.max(0, Math.min(8, i)));
  render();
};

function buildExport() {
  const btn = document.getElementById("export-all");
  btn.addEventListener("click", () => {
    setStatus("Exporting 3 sizes…");
    exportAll().catch((err) => setStatus("Export failed: " + err.message));
  });
  document.getElementById("undo").addEventListener("click", undo);
  document.getElementById("redo").addEventListener("click", redo);
  document.addEventListener("keydown", (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
      ev.preventDefault();
      if (ev.shiftKey) redo();
      else undo();
    } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") {
      ev.preventDefault();
      redo();
    }
  });
}

// ---------------------------------------------------------------------------
// Shot-scene API (used by shots.js)
// ---------------------------------------------------------------------------

const shotApi = {
  state,
  photos,
  render,
  loadPhoto,
  setPhotoForAll(name) {
    for (const panel of state.panels) panel.photo = name;
  },
  setCaption(caption) {
    state.title = caption;
    captionInput.value = caption;
  },
  setTemplate(id) {
    setTemplate(id);
    syncControls();
  },
};

function syncControls() {
  captionInput.value = state.title;
  taglineInput.value = state.tagline;
  subtitleInput.value = state.subtitle;
  const gradeSelect = document.getElementById("grade");
  if (gradeSelect) gradeSelect.value = state.grade;
  const engineInput = document.querySelector(`input[name="engine"][value="${state.engine}"]`);
  if (engineInput) engineInput.checked = true;
  for (const btn of document.querySelectorAll(".template-btn")) {
    btn.setAttribute("aria-pressed", btn.dataset.template === state.template ? "true" : "false");
  }
  selectPanel(selectedPanel);
  syncUndoRedo();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  buildTemplatePicker();
  buildGradePicker();
  buildEngineSwitch();
  buildPhotoPicker();
  buildTextInputs();
  buildPanelControls();
  buildCanvasInteraction();
  buildExport();
  selectPanel(selectedPanel);
  pushHistory(); // the initial state, so the first Undo has somewhere to go
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('96px Anton'),
        document.fonts.load('40px Pacifico'),
        document.fonts.ready,
      ]),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  } catch {
    // Fonts are local files; if one fails to load the canvas falls back.
  }
  await render();
  const query = new URLSearchParams(location.search);
  const shot = query.get("shot");
  if (shot) {
    await runShot(shot, query, shotApi);
  }
}

boot();
