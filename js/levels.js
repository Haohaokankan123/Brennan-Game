// Level definitions for Brennan Game (Marble Trap).
// The track runs in the -Z direction (away from the camera). +X is right, -X is left.
// All platforms are flat boxes with their TOP surface at y = 0 unless noted.
//
// Difficulty tuning targets (so levels are hard but FAIR):
//   - axis sweep: a point on the track is hit every PI/speed sec -> keep >= ~1.1s
//   - spears: safe window = period - up  -> keep >= ~1.1s
//   - pits: solid window = period - down -> keep >= ~1.1s
//   - saws: slower than the marble, but fast enough to punish camping
// Escalation comes from stacking traps and narrowing tracks, not impossible timing.

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

const axis = (x, z, length, speed, phase = 0) =>
  ({ type: "axis", pos: [x, z], length, thickness: 0.7, speed, phase });

const spears = (x, z, w, d, period, up, offset = 0) =>
  ({ type: "spears", pos: [x, z], area: [w, d], period, up, offset });

const cube = (fx, fz, tx, tz, speed, size = 1.5, offset = 0) =>
  ({ type: "spikecube", from: [fx, fz], to: [tx, tz], speed, size, offset });

const cannon = (x, z, dx, dz, period, speed, offset = 0) =>
  ({ type: "cannon", pos: [x, z], dir: [dx, dz], period, speed, offset, range: 26 });

const saw = (x, z, speed, size = 1.9) =>
  ({ type: "chainsaw", start: [x, z], speed, size });

const finishAt = (x, z) => [x, 0, z];

// ---- the 8 levels ------------------------------------------------------------

export const LEVELS = [
  // 1 — WARM UP : wide runway, a couple of slow axes + one spike cube.
  {
    name: "WARM UP",
    start: [0, 1, 6],
    finish: finishAt(0, -52),
    killY: -12,
    platforms: [ tile(0, -22, 8, 60) ],
    traps: [
      axis(0, -10, 7.4, 0.9, 0),
      cube(-3, -26, 3, -26, 3.0, 1.5),
      axis(0, -40, 7.4, -0.6, 0),
    ],
  },

  // 2 — SPIKE FIELD : narrower, rising spears in three bands + a sweeping axis.
  {
    name: "SPIKE FIELD",
    start: [0, 1, 6],
    finish: finishAt(0, -58),
    killY: -12,
    platforms: [ tile(0, -25, 6, 66) ],
    traps: [
      spears(0, -12, 5.4, 4, 2.0, 0.7, 0.0),
      axis(0, -24, 5.6, 2.2, 0),
      spears(0, -34, 5.4, 4, 1.9, 0.65, 0.5),
      spears(0, -48, 5.4, 5, 1.8, 0.65, 0.9),
    ],
  },

  // 3 — PIT STOP : dropping pit-trap tiles you must time, plus side cannons.
  {
    name: "PIT STOP",
    start: [0, 1, 6],
    finish: finishAt(0, -60),
    killY: -12,
    platforms: [
      tile(0, 1, 6, 12),                  // z  7 .. -5 (flush with pit below)
      pit(0, -8, 6, 6, 2.6, 0.8, 0.0),    // z -5 .. -11
      tile(0, -16, 6, 10),                // z -11 .. -21 (flush, no gaps)
      pit(0, -24, 6, 6, 2.6, 0.8, 0.6),   // z -21 .. -27
      tile(0, -32, 6, 10),                // z -27 .. -37
      pit(0, -40, 6, 6, 2.5, 0.8, 1.1),   // z -37 .. -43
      tile(0, -52, 6, 18),                // z -43 .. -61
    ],
    traps: [
      cannon(5, -16, -1, 0, 1.8, 8, 0.0),
      cannon(-5, -32, 1, 0, 1.8, 8, 0.8),
      cannon(5, -52, -1, 0, 1.7, 9, 0.3),
    ],
  },

  // 4 — CROSSFIRE : an L-turn, crossfiring cannons, patrolling spike cubes.
  {
    name: "CROSSFIRE",
    start: [0, 1, 6],
    finish: finishAt(-26, -44),
    killY: -12,
    platforms: [
      tile(0, -16, 5, 50),        // first leg (-Z), ends at z = -41
      tile(-13, -44, 30, 6),      // turn + second leg (-X), overlaps the corner fully
    ],
    traps: [
      cannon(4.5, -8, -1, 0, 1.8, 9, 0.0),
      cannon(-4.5, -20, 1, 0, 1.8, 9, 0.7),
      cube(-2, -32, 2, -32, 2.0, 1.5),
      cannon(4.5, -38, -1, 0, 1.7, 9, 0.4),
      cube(-14, -46.5, -14, -41.5, 3.2, 1.5, 0.5),
      cannon(-26, -36, 0, -1, 1.8, 9, 0.2),
    ],
  },

  // 5 — THE SAW : a chasing chainsaw forces constant motion past axes.
  {
    name: "THE SAW",
    start: [0, 1, 8],
    finish: finishAt(0, -64),
    killY: -12,
    platforms: [ tile(0, -28, 5, 76) ],
    traps: [
      saw(0, 19, 3.2, 1.9),
      axis(0, -8, 4.8, 0.5, 0),
      axis(0, -22, 4.8, -0.6, 0.7),
      cube(-1.6, -36, 1.6, -36, 3.6, 1.4),
      axis(0, -50, 4.8, 0.9, 0.3),
    ],
  },

  // 6 — GAUNTLET : narrow, everything-but-the-saw, tight timing.
  {
    name: "GAUNTLET",
    start: [0, 1, 6],
    finish: finishAt(0, -70),
    killY: -12,
    platforms: [ tile(0, -31, 4.5, 80) ],
    traps: [
      spears(0, -8, 4.0, 3.5, 1.8, 0.6, 0.0),
      cube(-1.0, -18, 1.0, -18, 2.5, 1.4),
      cannon(4, -28, -1, 0, 1.7, 10, 0.0),
      cannon(-4, -28, 1, 0, 1.7, 10, 0.85),
      axis(0, -40, 4.3, 1.5, 0),
      spears(0, -52, 4.0, 4, 1.7, 0.6, 0.5),
      cube(-1.4, -62, 1.4, -62, 4.2, 1.4, 0.4),
    ],
  },

  // 7 — CHASE : chainsaw + pit traps + crossfire on a zig-zag.
  {
    name: "CHASE",
    start: [0, 1, 8],
    finish: finishAt(18, -56),
    killY: -12,
    platforms: [
      tile(0, -6, 4.5, 32),
      pit(0, -22, 4.5, 6, 2.6, 0.8, 0.0),
      tile(0, -34, 4.5, 18),
      tile(9, -44, 22, 4.5),        // jog right (+X)
      tile(18, -50, 4.5, 16),       // final leg (-Z)
    ],
    traps: [
      saw(0, 20, 3.5, 1.9),
      cannon(4, -10, -1, 0, 1.7, 10, 0.0),
      cannon(-4, -16, 1, 0, 1.7, 10, 0.6),
      cube(-1.4, -34, 1.4, -34, 1.8, 1.4),
      cannon(9, -41.5, 0, -1, 1.6, 10, 0.3),
      cube(16, -50, 20, -50, 2.0, 1.4, 0.4),
    ],
  },

  // 8 — FINALE : narrowest + longest, chainsaw + spike cubes + cannons + spears + axes.
  {
    name: "FINALE",
    start: [0, 1, 8],
    finish: finishAt(0, -92),
    killY: -12,
    platforms: [
      tile(0, -10, 4.4, 40),
      pit(0, -32, 4.4, 6, 2.4, 0.75, 0.0),
      tile(0, -52, 4.4, 36),
      pit(0, -72, 4.4, 6, 2.3, 0.75, 0.5),
      tile(0, -84, 4.4, 20),
    ],
    traps: [
      saw(0, 20, 3.8, 1.9),
      spears(0, -8, 3.6, 3, 1.7, 0.6, 0.0),
      axis(0, -18, 3.9, 1.0, 0),
      cannon(3.6, -26, -1, 0, 1.6, 10, 0.0),
      cannon(-3.6, -44, 1, 0, 1.6, 10, 0.5),
      cube(-1.0, -52, 1.0, -52, 2.0, 1.3),
      axis(0, -62, 3.9, -1.6, 0.4),
      spears(0, -80, 3.6, 4, 1.6, 0.6, 0.3),
      cube(-1.0, -86, 1.0, -86, 2.2, 1.3, 0.6),
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
