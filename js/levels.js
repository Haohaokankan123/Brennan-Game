// Level definitions for Brennan Game (Marble Trap).
// The track runs STRAIGHT in the -Z direction (away from the camera). +X is right.
// Platforms are flat boxes; topY sets the top surface height (0 = ground).
//
// DESIGN RULES (learned the hard way):
//  - Levels run straight ahead so the fixed camera always shows the path AND the
//    finish. No hidden-corner turns (those caused "can't find the finish / fall off"
//    bugs). Variety comes from WIDTH changes and UP/DOWN elevation, not turns.
//  - Every level ENDS on a wide, flat, obvious FINISH PAD with the finish gate on it.
//  - Terrain: the marble can climb steps up to ~0.35 and fall down any drop. So
//    "hills" = gentle up-stairs then a drop ledge; "valleys" = a drop then up-stairs.
//  - Traps assume floor y=0 (their hit tests are floor-relative), so trap zones stay
//    FLAT at topY 0. Elevation features live on the trap-free connector stretches.
//  - Traps are randomized ({random:true}) so timing varies; still human-beatable.

// ---- authoring helpers -------------------------------------------------------

// Flat tile centered at (cx,cz), width w (x), depth d (z), top surface at topY.
function tile(cx, cz, w, d, topY = 0) {
  return { pos: [cx, topY - 0.5, cz], size: [w, 1, d] };
}

// Pit-trap tile: drops away on a cycle, leaving a deadly gap. Always at floor 0.
function pit(cx, cz, w, d, period, downTime, offset = 0) {
  return { pos: [cx, -0.5, cz], size: [w, 1, d], drop: { period, down: downTime, offset } };
}

// Straight run along -Z: a single tile from z0 (near) to z0-len (far), top at topY.
function leg(cx, z0, len, w, topY = 0) {
  return tile(cx, z0 - len / 2, w, len, topY);
}

// A staircase from topY a to topY b over depth `len` (z0 near -> z0-len far).
// Each step rises <= 0.3 so the marble can roll UP it; descending is always fine.
// Spread into the platforms array with `...ramp(...)`.
function ramp(cx, z0, len, w, a, b, topYsuppress) {
  const n = Math.max(1, Math.ceil(Math.abs(b - a) / 0.3));
  const seg = len / n, out = [];
  for (let i = 0; i < n; i++) {
    const ty = a + (b - a) * (i + 1) / n;
    out.push(tile(cx, z0 - seg * (i + 0.5), w, seg + 0.12, ty));
  }
  return out;
}

// ---- traps -------------------------------------------------------------------

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

// A wide flat finish pad centered at (0, z). Returned as a tile; pair with finishAt.
const finishPad = (z, w = 11) => tile(0, z, w, 16, 0);

// ---- the 8 levels ------------------------------------------------------------

export const LEVELS = [
  // 1 — WARM UP : wide rolling hills, a couple of gentle traps. Easy intro.
  {
    name: "WARM UP",
    start: [0, 1, 6],
    finish: finishAt(0, -158),
    killY: -14,
    platforms: [
      leg(0, 9, 30, 9, 0),                 //   9 .. -21  flat wide
      leg(0, -21, 18, 9, 0),               // -21 .. -39  flat
      ...ramp(0, -39, 12, 9, 0, 0.9),      // -39 .. -51  hill UP to 0.9
      leg(0, -51, 10, 9, 0.9),             // -51 .. -61  peak
      leg(0, -61, 20, 9, 0),               // -61 .. -81  DROP back to 0
      leg(0, -81, 18, 9, 0),               // -81 .. -99  flat
      leg(0, -99, 16, 9, -1.1),            // -99 .. -115 valley floor (drop)
      ...ramp(0, -115, 12, 9, -1.1, 0),    // -115 .. -127 climb back UP
      leg(0, -127, 23, 9, 0),              // -127 .. -150 flat run-in
      finishPad(-158),                     // -150 .. -166 finish pad
    ],
    traps: [
      axis(0, -10, 8.0, 0.9, 0, false),
      cube(-3.2, -30, 3.2, -30, 3.0, 1.5),
      axis(0, -72, 8.0, -0.8, 0, true),
      cube(-3.2, -88, 3.2, -88, 3.2, 1.5, 0.4),
      spears(0, -136, 7.0, 4, 2.0, 0.7, 0.0, true),
    ],
  },

  // 2 — SPIKE FIELD : medium width, spear bands + axes, one hill. Flat trap zones.
  {
    name: "SPIKE FIELD",
    start: [0, 1, 6],
    finish: finishAt(0, -176),
    killY: -14,
    platforms: [
      leg(0, 9, 56, 6, 0),                 //   9 .. -47  flat (spears+axis)
      ...ramp(0, -47, 10, 6, 0, 0.6),      // -47 .. -57  small hill up
      leg(0, -57, 12, 6, 0.6),             // -57 .. -69  raised flat
      leg(0, -69, 18, 6, 0),               // -69 .. -87  drop to 0
      leg(0, -87, 50, 6, 0),               // -87 .. -137 flat (spears+axis)
      leg(0, -137, 16, 4.2, 0),            // -137 .. -153 NARROW bridge
      leg(0, -153, 15, 6, 0),              // -153 .. -168 widen run-in
      finishPad(-176),                     // -168 .. -184 finish pad
    ],
    traps: [
      spears(0, -12, 5.4, 4, 2.0, 0.7, 0.0, true),
      axis(0, -26, 5.6, 1.6, 0, true),
      spears(0, -40, 5.4, 4, 1.9, 0.65, 0.5, true),
      axis(0, -92, 5.6, -1.5, 0.4, true),
      spears(0, -108, 5.4, 4, 1.9, 0.65, 0.2, true),
      axis(0, -124, 5.6, 1.5, 0, true),
      spears(0, -145, 3.6, 4, 1.8, 0.65, 0.7, true), // on the narrow bridge
    ],
  },

  // 3 — PIT STOP : dropping pit tiles + side cannons, narrow/wide mix. Flat (pits).
  {
    name: "PIT STOP",
    start: [0, 1, 6],
    finish: finishAt(0, -153),
    killY: -14,
    platforms: [
      tile(0, 1, 6, 12),                   //   7 .. -5
      pit(0, -8, 6, 6, 2.6, 0.8, 0.0),     //  -5 .. -11
      tile(0, -16, 6, 10),                 // -11 .. -21
      pit(0, -24, 6, 6, 2.6, 0.8, 0.6),    // -21 .. -27
      tile(0, -34, 6, 14),                 // -27 .. -41
      pit(0, -44, 6, 6, 2.5, 0.8, 1.1),    // -41 .. -47
      tile(0, -52, 4.2, 10),               // -47 .. -57  NARROW
      pit(0, -60, 4.2, 6, 2.5, 0.8, 0.3),  // -57 .. -63  narrow pit
      tile(0, -70, 6, 14),                 // -63 .. -77
      pit(0, -80, 6, 6, 2.6, 0.8, 0.9),    // -77 .. -83
      tile(0, -92, 9, 18),                 // -83 .. -101 WIDE arena
      pit(0, -104, 6, 6, 2.5, 0.8, 0.5),   // -101 .. -107
      tile(0, -114, 6, 14),                // -107 .. -121
      pit(0, -124, 6, 6, 2.4, 0.8, 0.2),   // -121 .. -127
      tile(0, -136, 6, 18),                // -127 .. -145
      finishPad(-153),                     // -145 .. -161 finish pad
    ],
    traps: [
      cannon(5, -16, -1, 0, 1.8, 8, 0.0, true),
      cannon(-5, -34, 1, 0, 1.8, 8, 0.8, true),
      cannon(5, -70, -1, 0, 1.7, 9, 0.3, true),
      cannon(-5, -92, 1, 0, 1.7, 9, 0.5, true),
      cannon(5, -114, -1, 0, 1.7, 9, 0.2, true),
      cannon(-5, -136, 1, 0, 1.6, 9, 0.6, true),
    ],
  },

  // 4 — CROSSFIRE : wide<->narrow, crossfiring cannons + patrol cubes. Flat.
  {
    name: "CROSSFIRE",
    start: [0, 1, 6],
    finish: finishAt(0, -172),
    killY: -14,
    platforms: [
      leg(0, 9, 40, 7, 0),                 //   9 .. -31
      leg(0, -31, 26, 4.2, 0),             // -31 .. -57  NARROW
      leg(0, -57, 34, 8, 0),               // -57 .. -91  WIDE
      leg(0, -91, 26, 4.2, 0),             // -91 .. -117 NARROW
      leg(0, -117, 47, 7, 0),              // -117 .. -164
      finishPad(-172),                     // -164 .. -180 finish pad
    ],
    traps: [
      cannon(6, -10, -1, 0, 1.8, 9, 0.0, true),
      cube(-2.2, -24, 2.2, -24, 2.0, 1.5),
      cube(-1.4, -44, 1.4, -44, 2.2, 1.4, 0.3), // narrow
      cannon(7, -64, -1, 0, 1.8, 9, 0.4, true),
      cube(-3, -78, 3, -78, 2.4, 1.5, 0.2),     // wide patrol
      cannon(-7, -84, 1, 0, 1.7, 9, 0.7, true),
      cube(-1.4, -104, 1.4, -104, 2.4, 1.4, 0.5), // narrow
      cannon(6, -130, -1, 0, 1.7, 9, 0.1, true),
      cube(-2.4, -148, 2.4, -148, 2.6, 1.5, 0.3),
    ],
  },

  // 5 — THE SAW : chasing chainsaw forces motion past axes; one valley.
  {
    name: "THE SAW",
    start: [0, 1, 8],
    finish: finishAt(0, -176),
    killY: -14,
    platforms: [
      leg(0, 10, 60, 5, 0),                //  10 .. -50  flat (axes)
      leg(0, -50, 16, 5, -1.2),            // -50 .. -66  valley drop
      ...ramp(0, -66, 14, 5, -1.2, 0),     // -66 .. -80  climb out
      leg(0, -80, 56, 5, 0),               // -80 .. -136 flat (axes)
      leg(0, -136, 16, 4, 0),              // -136 .. -152 NARROW
      leg(0, -152, 16, 5, 0),              // -152 .. -168
      finishPad(-176),                     // -168 .. -184 finish pad
    ],
    traps: [
      saw(0, 19, 3.4, 1.9),
      axis(0, -10, 4.8, 0.6, 0, true),
      axis(0, -26, 4.8, -0.7, 0.7, true),
      cube(-1.6, -40, 1.6, -40, 3.0, 1.4),
      axis(0, -90, 4.8, 0.8, 0.3, true),
      axis(0, -106, 4.8, -0.7, 0, true),
      cube(-1.6, -122, 1.6, -122, 3.0, 1.4, 0.4),
      axis(0, -144, 4.0, 0.9, 0.3, true),   // on narrow
    ],
  },

  // 6 — GAUNTLET : narrow winding-feel via width pulses, every trap, a hill.
  {
    name: "GAUNTLET",
    start: [0, 1, 6],
    finish: finishAt(0, -182),
    killY: -14,
    platforms: [
      leg(0, 9, 49, 4.5, 0),               //   9 .. -40  narrow (spears/cube/cannons)
      ...ramp(0, -40, 12, 4.5, 0, 0.8),    // -40 .. -52  hill up
      leg(0, -52, 10, 4.5, 0.8),           // -52 .. -62  peak
      leg(0, -62, 18, 4.5, 0),             // -62 .. -80  drop to 0
      leg(0, -80, 52, 4.5, 0),             // -80 .. -132 flat (axis/spears/cube)
      leg(0, -132, 14, 3.6, 0),            // -132 .. -146 EXTRA NARROW
      leg(0, -146, 28, 4.5, 0),            // -146 .. -174
      finishPad(-182),                     // -174 .. -190 finish pad
    ],
    traps: [
      spears(0, -8, 4.0, 3.5, 1.8, 0.6, 0.0, true),
      cube(-1.0, -18, 1.0, -18, 2.5, 1.4),
      cannon(4, -30, -1, 0, 1.7, 10, 0.0, true),
      cannon(-4, -30, 1, 0, 1.7, 10, 0.85, true),
      axis(0, -90, 4.3, 1.3, 0, true),
      spears(0, -104, 4.0, 4, 1.7, 0.6, 0.5, true),
      cube(-1.0, -118, 1.0, -118, 2.6, 1.4, 0.4),
      axis(0, -139, 3.2, 1.2, 0.3, true),  // on extra-narrow
      cannon(4, -158, -1, 0, 1.7, 10, 0.3, true),
      cannon(-4, -158, 1, 0, 1.7, 10, 0.7, true),
    ],
  },

  // 7 — CHASE : chainsaw + pits + cannons, wide<->narrow, a valley.
  {
    name: "CHASE",
    start: [0, 1, 8],
    finish: finishAt(0, -178),
    killY: -14,
    platforms: [
      leg(0, 10, 44, 5, 0),                //  10 .. -34  flat
      pit(0, -37, 5, 6, 2.6, 0.8, 0.0),    // -34 .. -40
      leg(0, -40, 20, 5, 0),               // -40 .. -60
      leg(0, -60, 16, 5, -1.2),            // -60 .. -76  valley
      ...ramp(0, -76, 14, 5, -1.2, 0),     // -76 .. -90  climb out
      leg(0, -90, 22, 4.2, 0),             // -90 .. -112 NARROW
      pit(0, -115, 4.2, 6, 2.5, 0.8, 0.4), // -112 .. -118 narrow pit
      leg(0, -118, 24, 5, 0),              // -118 .. -142
      leg(0, -142, 28, 5, 0),              // -142 .. -170
      finishPad(-178),                     // -170 .. -186 finish pad
    ],
    traps: [
      saw(0, 20, 3.7, 1.9),
      cannon(4, -12, -1, 0, 1.7, 10, 0.0, true),
      cannon(-4, -22, 1, 0, 1.7, 10, 0.6, true),
      cube(-1.6, -48, 1.6, -48, 2.2, 1.4),
      axis(0, -100, 3.6, 1.2, 0, true),    // on narrow
      cannon(4, -126, -1, 0, 1.6, 10, 0.3, true),
      cube(-1.8, -134, 1.8, -134, 2.4, 1.4, 0.2),
      axis(0, -154, 4.4, -1.2, 0.4, true),
    ],
  },

  // 8 — FINALE : longest, every trap, a hill AND a valley, big width swings.
  {
    name: "FINALE",
    start: [0, 1, 8],
    finish: finishAt(0, -226),
    killY: -14,
    platforms: [
      leg(0, 10, 46, 4.6, 0),              //  10 .. -36  flat (spears/axis/cannon)
      pit(0, -39, 4.6, 6, 2.4, 0.75, 0.0), // -36 .. -42
      leg(0, -42, 22, 4.6, 0),             // -42 .. -64  (cube/axis)
      ...ramp(0, -64, 12, 4.6, 0, 0.9),    // -64 .. -76  hill up
      leg(0, -76, 10, 4.6, 0.9),           // -76 .. -86  peak
      leg(0, -86, 18, 4.6, 0),             // -86 .. -104 drop to 0
      leg(0, -104, 40, 4.6, 0),            // -104 .. -144 flat (spears/cube/axis)
      leg(0, -144, 16, 3.6, 0),            // -144 .. -160 EXTRA NARROW
      leg(0, -160, 14, 4.6, -1.3),         // -160 .. -174 valley drop
      ...ramp(0, -174, 14, 4.6, -1.3, 0),  // -174 .. -188 climb out
      pit(0, -191, 4.6, 6, 2.3, 0.7, 0.5), // -188 .. -194
      leg(0, -194, 24, 4.6, 0),            // -194 .. -218
      finishPad(-226),                     // -218 .. -234 finish pad
    ],
    traps: [
      saw(0, 20, 3.95, 1.9),
      spears(0, -10, 4.0, 3, 1.7, 0.6, 0.0, true),
      axis(0, -22, 4.2, 1.0, 0, true),
      cannon(4, -30, -1, 0, 1.6, 10, 0.0, true),
      cube(-1.4, -52, 1.4, -52, 2.0, 1.4),
      axis(0, -114, 4.2, -1.4, 0.4, true),
      spears(0, -128, 4.0, 4, 1.6, 0.6, 0.3, true),
      axis(0, -150, 3.2, 1.3, 0, true),     // extra-narrow
      cube(-1.8, -204, 1.8, -204, 2.4, 1.4, 0.3),
      cannon(4, -212, -1, 0, 1.6, 10, 0.3, true),
    ],
  },
];

export const LEVEL_COUNT = LEVELS.length;
