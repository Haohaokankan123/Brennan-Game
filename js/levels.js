// Level definitions for Brennan Game (Marble Trap).
// The track runs mostly in the -Z direction (away from camera). +X is right, -X is left.
// All platforms are flat boxes with their TOP surface at y = 0 unless noted.
//
// BIG WINDING COURSES: each level is a long multi-leg path — straights, L-turns,
// S-curves, jogs, narrow bridges, and wide arenas — roughly 4x the size of the
// original straights. Traps are RANDOMIZED ({ random:true }) so the same spot is
// sometimes fast, sometimes slow. Tuned hard-but-fair: every chokepoint leaves a
// readable safe window, beatable by a human in ~30 tries.

// ---- small authoring helpers -------------------------------------------------

// A flat floor tile centered at (cx,cz), width w (x) and depth d (z), top surface at topY.
function tile(cx, cz, w, d, topY = 0) {
  return { pos: [cx, topY - 0.5, cz], size: [w, 1, d] };
}

// A pit-trap tile: a floor tile that periodically drops away, leaving a deadly gap.
function pit(cx, cz, w, d, period, downTime, offset = 0) {
  return { pos: [cx, -0.5, cz], size: [w, 1, d], drop: { period, down: downTime, offset } };
}

// A straight run of tiles along -Z from z0 down `len` units, width w, centered at cx.
// Returns one tile (boxes can be long); kept as a helper for readability.
function leg(cx, z0, len, w, topY = 0) {
  return tile(cx, z0 - len / 2, w, len, topY);
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
  ({ type: "cannon", pos: [x, z], dir: [dx, dz], period, speed, offset, range: 30, random });

const saw = (x, z, speed, size = 1.9) =>
  ({ type: "chainsaw", start: [x, z], speed, size });

const finishAt = (x, z) => [x, 0, z];

// ---- the 8 levels ------------------------------------------------------------

export const LEVELS = [
  // 1 — WARM UP : long straight that bends into an L, wide forgiving track.
  {
    name: "WARM UP",
    start: [0, 1, 6],
    finish: finishAt(40, -180),
    killY: -12,
    platforms: [
      leg(0, 9, 205, 8),              // long first straight: z 9 .. -196 (covers spawn)
      tile(20, -180, 48, 8),          // turn right (+X) along z=-180
    ],
    traps: [
      axis(0, -10, 7.4, 0.9, 0, false),
      cube(-3, -26, 3, -26, 3.0, 1.5),
      axis(0, -42, 7.4, -0.7, 0, true),
      cube(-3, -60, 3, -60, 3.2, 1.5, 0.4),
      axis(0, -80, 7.4, 0.8, 0.5, true),
      cube(-3, -100, 3, -100, 3.0, 1.5),
      axis(0, -122, 7.4, -0.8, 0.2, true),
      spears(0, -142, 6.5, 4, 2.0, 0.7, 0.0, true),
      axis(0, -164, 7.4, 0.8, 0.3, true),
      // the +X turn leg
      cube(12, -180, 12, -180, 3.0, 1.5),
      cannon(28, -176, 0, -1, 1.9, 9, 0.2, true),
      cube(34, -180, 34, -180, 3.2, 1.5, 0.4),
    ],
  },

  // 2 — SPIKE FIELD : S-curve through spear bands and sweeping axes.
  {
    name: "SPIKE FIELD",
    start: [0, 1, 6],
    finish: finishAt(0, -210),
    killY: -12,
    platforms: [
      leg(0, 9, 75, 6),               // straight down (covers spawn)
      tile(-12, -66, 30, 6),          // jog left
      leg(-24, -66, 70, 6),           // down again (left lane)
      tile(-12, -136, 30, 6),         // jog back right
      leg(0, -136, 80, 6),            // final straight down to finish
    ],
    traps: [
      spears(0, -12, 5.4, 4, 2.0, 0.7, 0.0, true),
      axis(0, -26, 5.6, 1.6, 0, true),
      spears(0, -44, 5.4, 4, 1.9, 0.65, 0.5, true),
      axis(0, -58, 5.6, -1.5, 0.4, true),
      cannon(-12, -62, 0, -1, 1.8, 9, 0.3, true),  // across the left jog
      spears(-24, -84, 5.4, 4, 1.9, 0.65, 0.2, true),
      axis(-24, -100, 5.6, 1.5, 0, true),
      spears(-24, -120, 5.4, 5, 1.8, 0.65, 0.7, true),
      cannon(-12, -132, 0, -1, 1.8, 9, 0.5, true), // across the right jog
      axis(0, -156, 5.6, -1.4, 0.3, true),
      spears(0, -176, 5.4, 4, 1.9, 0.65, 0.1, true),
      axis(0, -196, 5.6, 1.4, 0.5, true),
    ],
  },

  // 3 — PIT STOP : long alternating solid/pit terrain with side cannons + a turn.
  {
    name: "PIT STOP",
    start: [0, 1, 6],
    finish: finishAt(-36, -150),
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
      tile(0, -92, 6, 18),            // arena before the turn
      tile(-18, -100, 42, 6),         // turn left (-X)
      pit(-36, -112, 6, 6, 2.4, 0.8, 0.2),
      tile(-36, -120, 6, 10),
      pit(-36, -128, 6, 6, 2.4, 0.8, 0.7),
      tile(-36, -141, 6, 20),         // spans -131..-151, meets the pit edge
    ],
    traps: [
      cannon(5, -16, -1, 0, 1.8, 8, 0.0, true),
      cannon(-5, -32, 1, 0, 1.8, 8, 0.8, true),
      cannon(5, -52, -1, 0, 1.7, 9, 0.3, true),
      cannon(-5, -72, 1, 0, 1.7, 9, 0.5, true),
      cube(-2, -92, 2, -92, 2.4, 1.5),
      cannon(-18, -96, 0, -1, 1.8, 9, 0.2, true),   // across the turn
      cube(-30, -100, -30, -100, 2.6, 1.5, 0.3),
      cannon(-31, -120, 1, 0, 1.7, 9, 0.4, true),
      cannon(-41, -142, 1, 0, 1.6, 9, 0.6, true),
    ],
  },

  // 4 — CROSSFIRE : big U-shape, crossfiring cannons + patrol cubes on every leg.
  {
    name: "CROSSFIRE",
    start: [0, 1, 6],
    finish: finishAt(0, -8),
    killY: -12,
    platforms: [
      leg(0, 9, 105, 5),              // down the right side: z 9 .. -96 (covers spawn)
      tile(-25, -98, 56, 5),          // bottom of the U (-X)
      leg(-50, -96, 100, 5),          // up the left side: z -96 .. back toward start
    ],
    traps: [
      cannon(4.5, -8, -1, 0, 1.8, 9, 0.0, true),
      cube(-2, -22, 2, -22, 2.0, 1.5),
      cannon(-4.5, -36, 1, 0, 1.8, 9, 0.7, true),
      cube(-2, -52, 2, -52, 2.2, 1.5, 0.3),
      cannon(4.5, -68, -1, 0, 1.7, 9, 0.4, true),
      cube(-2, -84, 2, -84, 2.4, 1.5),
      // bottom leg
      cube(-14, -98, -14, -98, 2.4, 1.5, 0.5),
      cannon(-25, -90, 0, -1, 1.8, 9, 0.2, true),
      cube(-36, -98, -36, -98, 2.6, 1.5, 0.4),
      // left leg going up
      cannon(-45.5, -80, 1, 0, 1.7, 9, 0.1, true),
      cube(-52, -64, -48, -64, 2.4, 1.5, 0.2),
      cannon(-54.5, -48, 1, 0, 1.7, 9, 0.5, true),
      cube(-52, -32, -48, -32, 2.6, 1.5, 0.3),
      cannon(-45.5, -16, 1, 0, 1.7, 9, 0.2, true),
    ],
  },

  // 5 — THE SAW : a chasing chainsaw forces motion through a long winding gauntlet.
  {
    name: "THE SAW",
    start: [0, 1, 8],
    finish: finishAt(30, -190),
    killY: -12,
    platforms: [
      leg(0, 10, 124, 5),             // long straight (covers spawn)
      tile(15, -114, 36, 5),          // jog right
      leg(30, -114, 80, 5),           // final straight down
    ],
    traps: [
      saw(0, 19, 3.35, 1.9),
      axis(0, -8, 4.8, 0.6, 0, true),
      axis(0, -22, 4.8, -0.7, 0.7, true),
      cube(-1.6, -36, 1.6, -36, 3.0, 1.4),
      axis(0, -52, 4.8, 0.8, 0.3, true),
      axis(0, -68, 4.8, -0.7, 0, true),
      cube(-1.6, -84, 1.6, -84, 3.0, 1.4, 0.4),
      axis(0, -100, 4.8, 0.8, 0.5, true),
      cannon(15, -110, 0, -1, 1.7, 10, 0.2, true),  // at the jog
      axis(30, -134, 4.8, -0.7, 0.2, true),
      cube(28.4, -152, 31.6, -152, 3.0, 1.4, 0.3),
      axis(30, -170, 4.8, 0.8, 0.4, true),
    ],
  },

  // 6 — GAUNTLET : narrow winding bridge, every-trap, long, all random.
  {
    name: "GAUNTLET",
    start: [0, 1, 6],
    finish: finishAt(-30, -200),
    killY: -12,
    platforms: [
      leg(0, 9, 105, 4.5),            // narrow straight (covers spawn)
      tile(-15, -100, 36, 4.5),       // jog left
      leg(-30, -100, 104, 4.5),       // narrow straight to finish
    ],
    traps: [
      spears(0, -8, 4.0, 3.5, 1.8, 0.6, 0.0, true),
      cube(-1.0, -18, 1.0, -18, 2.5, 1.4),
      cannon(4, -28, -1, 0, 1.7, 10, 0.0, true),
      cannon(-4, -28, 1, 0, 1.7, 10, 0.85, true),
      axis(0, -42, 4.3, 1.3, 0, true),
      spears(0, -56, 4.0, 4, 1.7, 0.6, 0.5, true),
      cube(-1.0, -70, 1.0, -70, 2.6, 1.4, 0.4),
      axis(0, -86, 4.3, -1.3, 0.3, true),
      cannon(-15, -96, 0, -1, 1.7, 10, 0.2, true),  // at the jog
      spears(-30, -116, 4.0, 4, 1.7, 0.6, 0.1, true),
      cube(-31, -132, -29, -132, 2.6, 1.4, 0.2),
      axis(-30, -148, 4.3, 1.3, 0.4, true),
      cannon(-26, -162, -1, 0, 1.7, 10, 0.3, true),
      cannon(-34, -162, 1, 0, 1.7, 10, 0.7, true),
      spears(-30, -178, 4.0, 4, 1.7, 0.6, 0.6, true),
      axis(-30, -192, 4.3, -1.3, 0.2, true),
    ],
  },

  // 7 — CHASE : chainsaw + pits + crossfire across a big zig-zag with 3 turns.
  {
    name: "CHASE",
    start: [0, 1, 8],
    finish: finishAt(40, -160),
    killY: -12,
    platforms: [
      leg(0, 10, 64, 4.5),            // down (covers spawn)
      pit(0, -56, 4.5, 6, 2.6, 0.8, 0.0),
      leg(0, -62, 30, 4.5),           // down a bit more
      tile(15, -92, 34, 4.5),         // jog right
      leg(30, -92, 30, 4.5),          // down
      pit(30, -122, 4.5, 6, 2.5, 0.8, 0.4),
      tile(35, -128, 14, 4.5),        // small jog right
      leg(40, -128, 36, 4.5),         // final down
    ],
    traps: [
      saw(0, 20, 3.65, 1.9),
      cannon(4, -10, -1, 0, 1.7, 10, 0.0, true),
      cannon(-4, -18, 1, 0, 1.7, 10, 0.6, true),
      cube(-1.4, -34, 1.4, -34, 2.2, 1.4),
      axis(0, -48, 4.0, 1.2, 0, true),
      cube(-1.4, -70, 1.4, -70, 2.2, 1.4, 0.4),
      cannon(15, -88, 0, -1, 1.6, 10, 0.3, true),   // at first jog
      axis(30, -104, 4.0, -1.2, 0.3, true),
      cube(28.6, -118, 31.4, -118, 2.2, 1.4, 0.2),
      cannon(35, -124, 0, -1, 1.6, 10, 0.4, true),  // at second jog
      axis(40, -140, 4.0, 1.2, 0.4, true),
      cube(38.6, -152, 41.4, -152, 2.4, 1.4, 0.3),
    ],
  },

  // 8 — FINALE : the longest, a full circuit of turns + every trap, all random.
  {
    name: "FINALE",
    start: [0, 1, 8],
    finish: finishAt(-40, -220),
    killY: -12,
    platforms: [
      leg(0, 10, 94, 4.4),                      // leg 1 down (covers spawn)
      pit(0, -84, 4.4, 6, 2.4, 0.75, 0.0),
      leg(0, -90, 30, 4.4),
      tile(-20, -120, 44, 4.4),                 // turn left
      leg(-40, -120, 60, 4.4),                  // leg 2 down (left lane)
      pit(-40, -180, 4.4, 6, 2.3, 0.7, 0.3),
      leg(-40, -183, 43, 4.4),                  // spans -183..-226, meets the pit edge
    ],
    traps: [
      saw(0, 20, 3.95, 1.9),
      spears(0, -8, 3.6, 3, 1.7, 0.6, 0.0, true),
      axis(0, -20, 3.9, 1.0, 0, true),
      cannon(3.6, -32, -1, 0, 1.6, 10, 0.0, true),
      cube(-1.0, -48, 1.0, -48, 2.0, 1.3),
      axis(0, -64, 3.9, -1.4, 0.4, true),
      spears(0, -78, 3.6, 4, 1.6, 0.6, 0.3, true),
      cube(-1.0, -98, 1.0, -98, 2.2, 1.3, 0.6),
      cannon(-20, -116, 0, -1, 1.6, 10, 0.2, true), // at the turn
      axis(-40, -134, 3.9, 1.3, 0, true),
      spears(-40, -150, 3.6, 4, 1.6, 0.6, 0.5, true),
      cube(-41, -166, -39, -166, 2.2, 1.3, 0.3),
      axis(-40, -198, 3.9, -1.3, 0.4, true),
      cannon(-36, -210, -1, 0, 1.6, 10, 0.3, true),
      cannon(-44, -210, 1, 0, 1.6, 10, 0.7, true),
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
