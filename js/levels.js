// Level definitions for Brennan Game (Marble Trap).
// The track runs in the -Z direction (away from the camera). +X is right, -X is left.
// All platforms are flat boxes with their TOP surface at y = 0 unless noted.
//
// LONG-COURSE DESIGN: levels are long Marble-Trap-style gauntlets. Traps are
// RANDOMIZED — { random: true } makes a trap vary its speed/timing each cycle, so
// the same spot is sometimes fast, sometimes slow. This is unpredictable but still
// human-beatable in ~30 tries: every trap leaves a readable safe window, and the
// random ranges never fully close the gap.
//
// Difficulty comes from length + stacking + randomness, not from impossible timing.

// ---- small authoring helpers -------------------------------------------------

// A flat floor tile centered at (cx,cz), width w (x) and depth d (z), top surface at topY.
function tile(cx, cz, w, d, topY = 0) {
  return { pos: [cx, topY - 0.5, cz], size: [w, 1, d] };
}

// A pit-trap tile: a floor tile that periodically drops away, leaving a deadly gap.
function pit(cx, cz, w, d, period, downTime, offset = 0) {
  return { pos: [cx, -0.5, cz], size: [w, 1, d], drop: { period, down: downTime, offset } };
}

// ---- traps -------------------------------------------------------------------
// Pass random=true on any trap to make it vary speed/timing each cycle.

const axis = (x, z, length, speed, phase = 0, random = false) =>
  ({ type: "axis", pos: [x, z], length, thickness: 0.7, speed, phase,
     random: random ? { min: 0.75, max: 1.4 } : null });

const spears = (x, z, w, d, period, up, offset = 0, random = false) =>
  ({ type: "spears", pos: [x, z], area: [w, d], period, up, offset, random });

const cube = (fx, fz, tx, tz, speed, size = 1.5, offset = 0) =>
  ({ type: "spikecube", from: [fx, fz], to: [tx, tz], speed, size, offset });

const cannon = (x, z, dx, dz, period, speed, offset = 0, random = false) =>
  ({ type: "cannon", pos: [x, z], dir: [dx, dz], period, speed, offset, range: 26, random });

const saw = (x, z, speed, size = 1.9) =>
  ({ type: "chainsaw", start: [x, z], speed, size });

const finishAt = (x, z) => [x, 0, z];

// ---- the 8 levels ------------------------------------------------------------

export const LEVELS = [
  // 1 — WARM UP : long wide runway, a few slow random axes + spike cubes.
  {
    name: "WARM UP",
    start: [0, 1, 6],
    finish: finishAt(0, -104),
    killY: -12,
    platforms: [ tile(0, -48, 8, 116) ],
    traps: [
      axis(0, -10, 7.4, 0.9, 0, false),   // first obstacle: steady, true warm-up
      cube(-3, -26, 3, -26, 3.0, 1.5),
      axis(0, -40, 7.4, -0.7, 0, true),
      cube(-3, -56, 3, -56, 3.2, 1.5, 0.4),
      axis(0, -72, 7.4, 0.8, 0.5, true),
      cube(-3, -88, 3, -88, 3.0, 1.5),
    ],
  },

  // 2 — SPIKE FIELD : long lane, many random rising-spear bands + sweeping axes.
  {
    name: "SPIKE FIELD",
    start: [0, 1, 6],
    finish: finishAt(0, -116),
    killY: -12,
    platforms: [ tile(0, -54, 6, 124) ],
    traps: [
      spears(0, -12, 5.4, 4, 2.0, 0.7, 0.0, true),
      axis(0, -24, 5.6, 1.6, 0, true),
      spears(0, -34, 5.4, 4, 1.9, 0.65, 0.5, true),
      spears(0, -48, 5.4, 5, 1.8, 0.65, 0.9, true),
      axis(0, -62, 5.6, -1.5, 0.4, true),
      spears(0, -76, 5.4, 4, 1.9, 0.65, 0.2, true),
      axis(0, -90, 5.6, 1.4, 0, true),
      spears(0, -104, 5.4, 5, 1.8, 0.65, 0.7, true),
    ],
  },

  // 3 — PIT STOP : long sequence of random dropping pits + random side cannons.
  {
    name: "PIT STOP",
    start: [0, 1, 6],
    finish: finishAt(0, -116),
    killY: -12,
    platforms: [
      tile(0, 1, 6, 12),
      pit(0, -8, 6, 6, 2.6, 0.8, 0.0),
      tile(0, -16, 6, 10),
      pit(0, -24, 6, 6, 2.6, 0.8, 0.6),
      tile(0, -32, 6, 10),
      pit(0, -40, 6, 6, 2.5, 0.8, 1.1),
      tile(0, -52, 6, 18),
      pit(0, -64, 6, 6, 2.6, 0.8, 0.3),
      tile(0, -72, 6, 10),
      pit(0, -80, 6, 6, 2.5, 0.8, 0.9),
      tile(0, -88, 6, 10),
      pit(0, -96, 6, 6, 2.4, 0.8, 0.5),
      tile(0, -108, 6, 18),
    ],
    traps: [
      cannon(5, -16, -1, 0, 1.8, 8, 0.0, true),
      cannon(-5, -32, 1, 0, 1.8, 8, 0.8, true),
      cannon(5, -52, -1, 0, 1.7, 9, 0.3, true),
      cannon(-5, -72, 1, 0, 1.7, 9, 0.5, true),
      cannon(5, -88, -1, 0, 1.7, 9, 0.2, true),
      cannon(-5, -108, 1, 0, 1.6, 9, 0.6, true),
    ],
  },

  // 4 — CROSSFIRE : long L-turn, random crossfiring cannons + patrol cubes.
  {
    name: "CROSSFIRE",
    start: [0, 1, 6],
    finish: finishAt(-46, -60),
    killY: -12,
    platforms: [
      tile(0, -28, 5, 74),         // first leg (-Z), ends ~z=-65
      tile(-25, -60, 56, 6),       // long second leg (-X)
    ],
    traps: [
      cannon(4.5, -8, -1, 0, 1.8, 9, 0.0, true),
      cannon(-4.5, -20, 1, 0, 1.8, 9, 0.7, true),
      cube(-2, -32, 2, -32, 2.0, 1.5),
      cannon(4.5, -44, -1, 0, 1.7, 9, 0.4, true),
      cube(-2, -56, 2, -56, 2.2, 1.5, 0.3),
      // turn, then the long -X leg with cubes + cannons firing across it
      cube(-14, -62.5, -14, -57.5, 2.4, 1.5, 0.5),
      cannon(-24, -52, 0, -1, 1.8, 9, 0.2, true),
      cube(-30, -62.5, -30, -57.5, 2.6, 1.5, 0.4),
      cannon(-40, -52, 0, -1, 1.7, 9, 0.6, true),
      cube(-44, -62.5, -44, -57.5, 2.4, 1.5, 0.2),
    ],
  },

  // 5 — THE SAW : a chasing chainsaw forces constant motion past random axes. Long.
  {
    name: "THE SAW",
    start: [0, 1, 8],
    finish: finishAt(0, -120),
    killY: -12,
    platforms: [ tile(0, -56, 5, 132) ],
    traps: [
      saw(0, 19, 3.35, 1.9),
      axis(0, -8, 4.8, 0.6, 0, true),
      axis(0, -22, 4.8, -0.7, 0.7, true),
      cube(-1.6, -36, 1.6, -36, 3.0, 1.4),
      axis(0, -50, 4.8, 0.8, 0.3, true),
      axis(0, -64, 4.8, -0.7, 0, true),
      cube(-1.6, -78, 1.6, -78, 3.0, 1.4, 0.4),
      axis(0, -92, 4.8, 0.8, 0.5, true),
      axis(0, -106, 4.8, -0.7, 0.2, true),
    ],
  },

  // 6 — GAUNTLET : narrow, everything-but-the-saw, long, random timing.
  {
    name: "GAUNTLET",
    start: [0, 1, 6],
    finish: finishAt(0, -128),
    killY: -12,
    platforms: [ tile(0, -60, 4.5, 136) ],
    traps: [
      spears(0, -8, 4.0, 3.5, 1.8, 0.6, 0.0, true),
      cube(-1.0, -18, 1.0, -18, 2.5, 1.4),
      cannon(4, -28, -1, 0, 1.7, 10, 0.0, true),
      cannon(-4, -28, 1, 0, 1.7, 10, 0.85, true),
      axis(0, -40, 4.3, 1.3, 0, true),
      spears(0, -52, 4.0, 4, 1.7, 0.6, 0.5, true),
      cube(-1.0, -64, 1.0, -64, 2.6, 1.4, 0.4),
      cannon(4, -76, -1, 0, 1.7, 10, 0.2, true),
      cannon(-4, -76, 1, 0, 1.7, 10, 0.6, true),
      axis(0, -90, 4.3, -1.3, 0.4, true),
      spears(0, -104, 4.0, 4, 1.7, 0.6, 0.3, true),
      cube(-1.0, -116, 1.0, -116, 2.6, 1.4, 0.2),
    ],
  },

  // 7 — CHASE : chainsaw + random pit traps + crossfire on a long zig-zag.
  {
    name: "CHASE",
    start: [0, 1, 8],
    finish: finishAt(28, -92),
    killY: -12,
    platforms: [
      tile(0, -6, 4.5, 32),
      pit(0, -22, 4.5, 6, 2.6, 0.8, 0.0),
      tile(0, -38, 4.5, 26),
      pit(0, -54, 4.5, 6, 2.5, 0.8, 0.5),
      tile(0, -64, 4.5, 14),
      tile(14, -72, 32, 4.5),        // jog right (+X)
      tile(28, -82, 4.5, 24),        // final leg (-Z)
    ],
    traps: [
      saw(0, 20, 3.65, 1.9),
      cannon(4, -10, -1, 0, 1.7, 10, 0.0, true),
      cannon(-4, -16, 1, 0, 1.7, 10, 0.6, true),
      cube(-1.4, -38, 1.4, -38, 2.2, 1.4),
      cannon(4, -48, -1, 0, 1.7, 10, 0.3, true),
      cube(-1.4, -64, 1.4, -64, 2.2, 1.4, 0.4),
      cannon(14, -69.5, 0, -1, 1.6, 10, 0.3, true),
      cube(26, -72, 30, -72, 2.0, 1.4, 0.4),
      cannon(28, -70, 0, -1, 1.7, 10, 0.5, true),
    ],
  },

  // 8 — FINALE : narrowest + longest, every trap type, all randomized.
  {
    name: "FINALE",
    start: [0, 1, 8],
    finish: finishAt(0, -152),
    killY: -12,
    platforms: [
      tile(0, -10, 4.4, 40),
      pit(0, -32, 4.4, 6, 2.4, 0.75, 0.0),
      tile(0, -52, 4.4, 36),
      pit(0, -72, 4.4, 6, 2.3, 0.75, 0.5),
      tile(0, -90, 4.4, 32),
      pit(0, -108, 4.4, 6, 2.3, 0.75, 0.2),
      tile(0, -128, 4.4, 36),
      pit(0, -144, 4.4, 6, 2.2, 0.7, 0.6),
      tile(0, -150, 4.4, 8),
    ],
    traps: [
      saw(0, 20, 3.95, 1.9),
      spears(0, -8, 3.6, 3, 1.7, 0.6, 0.0, true),
      axis(0, -18, 3.9, 1.0, 0, true),
      cannon(3.6, -26, -1, 0, 1.6, 10, 0.0, true),
      cannon(-3.6, -44, 1, 0, 1.6, 10, 0.5, true),
      cube(-1.0, -52, 1.0, -52, 2.0, 1.3),
      axis(0, -62, 3.9, -1.5, 0.4, true),
      spears(0, -80, 3.6, 4, 1.6, 0.6, 0.3, true),
      cube(-1.0, -90, 1.0, -90, 2.2, 1.3, 0.6),
      axis(0, -100, 3.9, 1.3, 0, true),
      cannon(3.6, -116, -1, 0, 1.6, 10, 0.2, true),
      cube(-1.0, -128, 1.0, -128, 2.2, 1.3, 0.3),
      spears(0, -138, 3.6, 4, 1.6, 0.6, 0.5, true),
      axis(0, -148, 3.9, -1.3, 0.4, true),
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
