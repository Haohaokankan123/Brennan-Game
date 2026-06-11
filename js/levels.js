// Level definitions for Brennan Game (Marble Trap).
// The track winds in the -Z direction and turns along ±X. The fixed isometric-style
// camera (high 3/4, never rotates) shows turns clearly, so winding courses work.
//
// DESIGN RULES (learned the hard way):
//  - Platforms are authored in PATH ORDER; each one overlaps the previous in both
//    axes so the marble can roll across (validated by a BFS + waypoint sim).
//  - Every level ENDS on a wide, flat, obvious FINISH PAD with the gate on it.
//  - Terrain: the marble climbs steps up to ~0.35 and falls down any drop. "Hills" =
//    gentle up-stairs (ramp) then a drop; elevation lives on TRAP-FREE stretches only
//    (trap hit-tests are floor-relative, so trap zones stay flat at topY 0).
//  - Width varies (wide arenas <-> narrow bridges). Traps are randomized
//    ({random:true}); difficulty escalates L1 -> L8, still ~30-try fair.

// ---- authoring helpers -------------------------------------------------------

function tile(cx, cz, w, d, topY = 0) {
  return { pos: [cx, topY - 0.5, cz], size: [w, 1, d] };
}
function pit(cx, cz, w, d, period, downTime, offset = 0) {
  return { pos: [cx, -0.5, cz], size: [w, 1, d], drop: { period, down: downTime, offset } };
}
// straight run along -Z: tile from z0 (near) to z0-len (far)
function leg(cx, z0, len, w, topY = 0) {
  return tile(cx, z0 - len / 2, w, len, topY);
}
// staircase topY a -> b over depth len; each step <= 0.3 so it's climbable
function ramp(cx, z0, len, w, a, b) {
  const n = Math.max(1, Math.ceil(Math.abs(b - a) / 0.3));
  const seg = len / n, out = [];
  for (let i = 0; i < n; i++) {
    const ty = a + (b - a) * (i + 1) / n;
    out.push(tile(cx, z0 - seg * (i + 0.5), w, seg + 0.12, ty));
  }
  return out;
}

// ---- traps -------------------------------------------------------------------

const axis = (x, z, length, speed, phase = 0, random = false, cross = false) =>
  ({ type: "axis", pos: [x, z], length, thickness: 0.7, speed, phase, cross,
     random: random ? { min: 0.75, max: 1.4 } : null });

const crossAxis = (x, z, length, speed, phase = 0, random = false) =>
  axis(x, z, length, speed, phase, random, true);

const spears = (x, z, w, d, period, up, offset = 0, random = false) =>
  ({ type: "spears", pos: [x, z], area: [w, d], period, up, offset, random });

const cube = (fx, fz, tx, tz, speed, size = 1.5, offset = 0) =>
  ({ type: "spikecube", from: [fx, fz], to: [tx, tz], speed, size, offset });

const cannon = (x, z, dx, dz, period, speed, offset = 0, random = false) =>
  ({ type: "cannon", pos: [x, z], dir: [dx, dz], period, speed, offset, range: 30, random });

const saw = (x, z, speed, size = 1.9) =>
  ({ type: "chainsaw", start: [x, z], speed, size });

const finishAt = (x, z) => [x, 0, z];
const finishPad = (x, z, w = 12) => tile(x, z, w, 14, 0);

// ---- the 8 levels ------------------------------------------------------------

export const LEVELS = [
  // 1 — WARM UP : wide, a rolling hill, one gentle right turn into the finish.
  {
    name: "WARM UP",
    start: [0, 1, 6],
    finish: finishAt(34, -79),
    killY: -14,
    platforms: [
      leg(0, 9, 46, 8, 0),                 // A  9 .. -37
      ...ramp(0, -37, 12, 8, 0, 0.8),      // B  hill up to 0.8
      leg(0, -49, 10, 8, 0.8),             // C  peak
      leg(0, -59, 16, 8, 0),               // D  drop to 0 (-59..-75)
      tile(6, -79, 22, 10, 0),             // E  corner right (x -5..17, z -74..-84)
      tile(22, -79, 22, 10, 0),            // F  +X leg (x 11..33)
      finishPad(34, -79),                  // G  finish pad (x 28..40)
    ],
    traps: [
      axis(0, -10, 7.4, 0.9, 0, false),
      cube(-3, -28, 3, -28, 3.0, 1.5),
      spears(0, -68, 6.5, 4, 2.0, 0.7, 0.0, true),
      cube(16, -79, 26, -79, 3.0, 1.5, 0.3),
    ],
  },

  // 2 — SPIKE FIELD : S-curve (right, then back), spear bands + axes.
  {
    name: "SPIKE FIELD",
    start: [0, 1, 6],
    finish: finishAt(30, -95),
    killY: -14,
    platforms: [
      leg(0, 9, 50, 6, 0),                 // A  9 .. -41
      tile(9, -44, 24, 6, 0),              // B  corner right (x -3..21, z -41..-47)
      tile(24, -44, 22, 6, 0),             // C  +X leg (x 13..35)
      tile(31, -50, 6, 18, 0),             // D  corner back to -Z (x 28..34, z -41..-59)
      leg(31, -57, 34, 6, 0),              // E  -Z leg (-57..-91)
      finishPad(30, -95, 12),              // F  finish (x 24..36, z -88..-102)
    ],
    traps: [
      spears(0, -12, 5.4, 4, 2.0, 0.7, 0.0, true),
      axis(0, -26, 5.6, 1.2, 0, true),     // was 1.6 — too fast for an early level
      spears(0, -38, 5.4, 4, 1.9, 0.65, 0.5, true),  // right before the turn
      cube(15, -44, 33, -44, 2.6, 1.5, 0.2),         // patrol on the +X leg
      axis(31, -66, 5.6, -1.5, 0.4, true),
      spears(31, -80, 5.4, 4, 1.9, 0.65, 0.2, true),
    ],
  },

  // 3 — PIT STOP : dropping pits + side cannons, a left turn midway.
  {
    name: "PIT STOP",
    start: [0, 1, 6],
    finish: finishAt(-30, -92),
    killY: -14,
    platforms: [
      tile(0, 1, 6, 12),                   //  7 .. -5
      pit(0, -8, 6, 6, 2.6, 0.8, 0.0),     // -5 .. -11
      tile(0, -16, 6, 10),                 // -11 .. -21
      pit(0, -24, 6, 6, 2.6, 0.8, 0.6),    // -21 .. -27
      tile(0, -34, 6, 14),                 // -27 .. -41
      tile(-9, -44, 24, 6, 0),             // corner left (x -21..3, z -41..-47)
      tile(-24, -44, 24, 6, 0),            // -X leg (x -36..-12)
      tile(-31, -50, 6, 18, 0),            // corner back to -Z (x -34..-28, z -41..-59)
      leg(-31, -57, 14, 6, 0),             // -57 .. -71
      pit(-31, -74, 6, 6, 2.5, 0.8, 0.3),  // -71 .. -77
      tile(-31, -82, 6, 12, 0),            // -77 .. -89
      finishPad(-30, -92, 12),             // -85 .. -99
    ],
    traps: [
      cannon(5, -16, -1, 0, 1.8, 8, 0.0, true),
      cannon(-5, -34, 1, 0, 1.8, 8, 0.8, true),
      cube(-22, -44, -14, -44, 2.4, 1.5, 0.2),       // patrol on the -X leg
      cannon(-31, -64, 0, -1, 1.7, 9, 0.3, true),   // centered on the -Z leg (x -34..-28)
    ],
  },

  // 4 — CROSSFIRE : wide<->narrow, crossfiring cannons + patrol cubes, one turn.
  {
    name: "CROSSFIRE",
    start: [0, 1, 6],
    finish: finishAt(28, -86),
    killY: -14,
    platforms: [
      leg(0, 9, 34, 7, 0),                 //  9 .. -25
      leg(0, -25, 24, 4.2, 0),             // -25 .. -49  NARROW
      leg(0, -49, 14, 8, 0),               // -49 .. -63  WIDE
      tile(8, -67, 22, 9, 0),              // corner right (x -3..19, z -62.5..-71.5)
      tile(24, -67, 22, 6, 0),             // +X leg (x 13..35)
      finishPad(28, -83, 12),              // shift to finish pad zone (x 22..34, z -76..-90)
      tile(28, -71, 8, 10, 0),             // bridge corner->pad (x 24..32, z -66..-76)
    ],
    traps: [
      cannon(6, -10, -1, 0, 1.8, 9, 0.0, true),
      cube(-1.4, -32, 1.4, -32, 2.2, 1.4),           // narrow patrol
      cannon(5, -42, -1, 0, 1.8, 9, 0.5, true),
      cube(-3, -55, 3, -55, 2.4, 1.5, 0.2),          // wide patrol
      cube(15, -67, 33, -67, 2.6, 1.5, 0.3),         // patrol guarding the turn leg
      cannon(28, -78, 0, -1, 1.7, 9, 0.2, true),
    ],
  },

  // 5 — THE SAW : chasing chainsaw forces motion past axes; a valley + a turn.
  {
    name: "THE SAW",
    start: [0, 1, 8],
    finish: finishAt(-26, -100),
    killY: -14,
    platforms: [
      leg(0, 10, 56, 5, 0),                // 10 .. -46  (axes)
      leg(0, -46, 14, 5, -1.2),            // -46 .. -60 valley drop
      ...ramp(0, -60, 14, 5, -1.2, 0),     // -60 .. -74 climb out
      tile(-13, -74, 27, 6, 0),            // band left (x -26.5..0.5, z -71..-77)
      leg(-26, -74, 23, 5, 0),             // -Z leg (x -28.5..-23.5, z -74..-97; real overlap w/ band)
      finishPad(-26, -100, 12),            // -93 .. -107
    ],
    traps: [
      saw(0, 19, 3.4, 1.9),
      axis(0, -12, 4.8, 0.6, 0, true),
      axis(0, -30, 4.8, -0.7, 0.7, true),
      cube(-1.6, -38, 1.6, -38, 3.0, 1.4),           // on the flat first leg (clear of the valley)
      cube(-23, -74, -3, -74, 2.5, 1.4, 0.2),        // patrol across the corner band
      axis(-26, -88, 4.4, -0.8, 0.2, true),          // on the -X leg
    ],
  },

  // 6 — GAUNTLET : narrow winding, every trap, a hill + two turns. Harder.
  {
    name: "GAUNTLET",
    start: [0, 1, 6],
    finish: finishAt(0, -112),
    killY: -14,
    platforms: [
      leg(0, 9, 41, 4.5, 0),               //  9 .. -32  (spears, cube, cannons)
      ...ramp(0, -32, 12, 4.5, 0, 0.8),    // -32 .. -44 hill up
      leg(0, -44, 18, 4.5, 0),             // -44 .. -62 drop to 0
      tile(9, -62, 26, 4.5, 0),            // band right (x -4..22, z -59.75..-64.25)
      leg(18, -62, 20, 4.5, 0),            // -Z leg (x 15.75..20.25, z -62..-82)
      tile(9, -82, 26, 4.5, 0),            // band left (x -4..22, z -79.75..-84.25)
      leg(0, -82, 24, 4.5, 0),             // -Z leg back at center (-82..-106)
      finishPad(0, -112, 12),              // -105 .. -119
    ],
    traps: [
      spears(0, -8, 4.0, 3.5, 1.8, 0.6, 0.0, true),
      cube(-1.0, -18, 1.0, -18, 2.5, 1.4),
      cannon(4, -28, -1, 0, 1.7, 10, 0.0, true),
      cannon(-4, -28, 1, 0, 1.7, 10, 0.85, true),
      cube(2, -62, 16, -62, 2.5, 1.4, 0.2),          // patrol guarding the first turn
      axis(18, -72, 4.0, 1.3, 0, true),              // on the +X-offset -Z leg
      spears(0, -94, 4.0, 4, 1.7, 0.6, 0.5, true),
      cube(-1.0, -100, 1.0, -100, 2.6, 1.4, 0.4),
    ],
  },

  // 7 — CHASE : chainsaw + pits + cannons + cross-axe, zig-zag with two turns.
  {
    name: "CHASE",
    start: [0, 1, 8],
    finish: finishAt(24, -78),
    killY: -14,
    platforms: [
      leg(0, 10, 44, 4.5, 0),              // 10 .. -34
      pit(0, -37, 4.5, 6, 2.6, 0.8, 0.0),  // -34 .. -40
      leg(0, -40, 18, 4.5, 0),             // -40 .. -58
      tile(-9, -58, 26, 4.5, 0),           // band left (x -22..4, z -55.75..-60.25)
      leg(-18, -58, 20, 5.0, 0),           // -Z leg WIDENED to 5.0 for the cross-axe (x -20.5..-15.5)
      tile(-9, -78, 26, 4.5, 0),           // band right (x -22..4, z -75.75..-80.25)
      tile(14, -78, 28, 4.5, 0),           // +X leg (x 0..28, z -75.75..-80.25)
      finishPad(24, -78, 12),              // x 18..30, z -71..-85
    ],
    traps: [
      saw(0, 20, 3.7, 1.9),
      cannon(4, -12, -1, 0, 1.7, 10, 0.0, true),
      cannon(-4, -22, 1, 0, 1.7, 10, 0.6, true),
      crossAxis(-18, -68, 3.0, 0.8, 0, true),        // cross-axe (shorter/slower so it's passable on the 5.0 leg)
      cannon(-15, -78, 1, 0, 1.6, 10, 0.3, true),    // crossfire on the band
      cube(8, -78, 24, -78, 2.4, 1.4, 0.2),          // patrol on the +X leg
    ],
  },

  // 8 — FINALE : longest, every trap incl. cross-axe, hill + valley + two turns.
  {
    name: "FINALE",
    start: [0, 1, 8],
    finish: finishAt(-30, -140),
    killY: -14,
    platforms: [
      leg(0, 10, 46, 4.6, 0),              // 10 .. -36  (spears, axis, cannon)
      pit(0, -39, 4.6, 6, 2.4, 0.75, 0.0), // -36 .. -42
      leg(0, -42, 18, 4.6, 0),             // -42 .. -60  (cube)
      ...ramp(0, -60, 12, 4.6, 0, 0.9),    // -60 .. -72 hill up
      leg(0, -72, 16, 4.6, 0),             // -72 .. -88 drop to 0  (axis)
      tile(-9, -88, 24, 4.6, 0),           // band left (x -21..3, z -85.7..-90.3)
      leg(-18, -88, 18, 5.2, 0),           // -Z leg WIDENED to 5.2 for the cross-axe (x -20.6..-15.4)
      leg(-18, -106, 14, 4.6, -1.3),       // valley drop (-106..-120)
      ...ramp(-18, -120, 12, 4.6, -1.3, 0),// climb out (-120..-132)
      tile(-26, -132, 22, 4.6, 0),         // band left (x -37..-15, z -129.7..-134.3)
      finishPad(-30, -140, 12),            // x -36..-24, z -133..-147
    ],
    traps: [
      saw(0, 20, 3.95, 1.9),
      spears(0, -10, 4.0, 3, 1.7, 0.6, 0.0, true),
      axis(0, -22, 4.2, 1.0, 0, true),
      cannon(4, -30, -1, 0, 1.6, 10, 0.0, true),
      cube(-1.4, -50, 1.4, -50, 2.0, 1.4),
      axis(0, -80, 4.2, -1.0, 0.4, true),            // was -1.4 — eased before the cross-axe
      crossAxis(-18, -97, 3.0, 0.8, 0, true),        // cross-axe (shorter/slower; passable on the 5.2 leg)
      cube(-19.4, -101, -16.6, -101, 2.2, 1.4, 0.3), // on the -Z leg
      axis(-26, -132, 4.0, 1.2, 0.2, true),          // guarding the last corner
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
