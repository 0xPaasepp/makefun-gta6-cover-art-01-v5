// templates.js — the 6 cover templates for Velvet Heat.
// Every template is a layout definition in 1080x1080 cover space:
//   panels: rects {x, y, w, h, rot} the cover renderer draws photos into.
//   band:   where the title band sits ("bottom" | "top" | "masthead").
//   engine / grade: the template's default engine and grade.
//   flags:  extra treatments (tilt, grain, vignette, badge, gradientTitle).
// All 6 templates render distinctly: different panel arrangements AND
// different title treatments.

const GRID_GUTTER = 10;
const GRID_MARGIN = 12;
const BAND_H = 168;

// 3x3 grid filling the area above the bottom title band.
function gridPanels(top, bottom) {
  const availW = 1080 - GRID_MARGIN * 2;
  const availH = bottom - top;
  const cw = (availW - GRID_GUTTER * 2) / 3;
  const ch = (availH - GRID_GUTTER * 2) / 3;
  const panels = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      panels.push({
        x: GRID_MARGIN + c * (cw + GRID_GUTTER),
        y: top + r * (ch + GRID_GUTTER),
        w: cw,
        h: ch,
        rot: 0,
      });
    }
  }
  return panels;
}

export const TEMPLATES = [
  {
    id: "ink-heat",
    name: "Ink Heat",
    engine: "ink",
    grade: "Sunset",
    panels: gridPanels(GRID_MARGIN, 1080 - BAND_H - GRID_MARGIN),
    band: "bottom",
    titleStyle: "classic",
    flags: {},
  },
  {
    id: "golden-hour-hero",
    name: "Golden Hour Hero",
    engine: "photo",
    grade: "Golden Hour",
    panels: [
      // One large hero panel on the left, three stacked panels on the right.
      { x: 12, y: 12, w: 684, h: 888, rot: 0 },
      { x: 708, y: 12, w: 360, h: 288, rot: 0 },
      { x: 708, y: 312, w: 360, h: 288, rot: 0 },
      { x: 708, y: 612, w: 360, h: 288, rot: 0 },
      // Slots 4-8 share rects with slots 0-3: cover.js paints each unique
      // rect once, using its first panel, so the hero layout never
      // double-paints. The shared slots stay editable in the panel controls
      // and take over if a future layout gives them their own rects.
      { x: 12, y: 12, w: 684, h: 888, rot: 0 },
      { x: 708, y: 12, w: 360, h: 288, rot: 0 },
      { x: 708, y: 312, w: 360, h: 288, rot: 0 },
      { x: 708, y: 612, w: 360, h: 288, rot: 0 },
      { x: 12, y: 12, w: 684, h: 888, rot: 0 },
    ],
    band: "bottom",
    titleStyle: "hero",
    flags: {},
  },
  {
    id: "neon-tilt",
    name: "Neon Tilt",
    engine: "photo",
    grade: "Vice Neon",
    panels: gridPanels(GRID_MARGIN, 1080 - BAND_H - GRID_MARGIN).map((p, i) => ({
      ...p,
      rot: (i % 2 === 0 ? -1 : 1) * (2 + (i % 3)),
    })),
    band: "bottom",
    titleStyle: "neon",
    flags: { tilt: true },
  },
  {
    id: "sunset-sleeve",
    name: "Sunset Sleeve",
    engine: "photo",
    grade: "Sunset",
    // Horizontal sleeve: a tall top row, a mid row, a short bottom row.
    panels: (() => {
      const panels = [];
      const rows = [
        { y: 12, h: 400 },
        { y: 424, h: 268 },
        { y: 704, h: 196 },
      ];
      for (const row of rows) {
        const cw = (1080 - GRID_MARGIN * 2 - GRID_GUTTER * 2) / 3;
        for (let c = 0; c < 3; c++) {
          panels.push({
            x: GRID_MARGIN + c * (cw + GRID_GUTTER),
            y: row.y,
            w: cw,
            h: row.h,
            rot: 0,
          });
        }
      }
      return panels;
    })(),
    band: "bottom",
    titleStyle: "gradient",
    flags: { grain: true, vignette: true },
  },
  {
    id: "palm-grid",
    name: "Palm Grid",
    engine: "ink",
    grade: "Palm",
    panels: gridPanels(BAND_H + GRID_MARGIN, 1080 - GRID_MARGIN),
    band: "top",
    titleStyle: "badge",
    flags: { badge: true },
  },
  {
    id: "vice-magazine",
    name: "Vice Magazine",
    engine: "photo",
    grade: "Vice Neon",
    // Magazine cover: one big photo fills the whole cover; the masthead
    // title sits on top and cover lines run down the bottom-left.
    panels: [{ x: 0, y: 0, w: 1080, h: 1080, rot: 0 }],
    band: "masthead",
    titleStyle: "masthead",
    flags: { masthead: true },
  },
];

export function templateById(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}
