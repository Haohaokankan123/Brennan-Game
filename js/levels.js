// Level definitions for Brennan Game (Marble Trap).
// The track winds in -Z and turns along ±X. A fixed isometric-style camera shows
// turns; controls are world-aligned.
//
// LONG COURSES via a PATH BUILDER: instead of hand-computing every tile span (which
// caused gap bugs), a Path builder lays overlapping segments by construction, so the
// course is ALWAYS connected. Turns drop a generous corner band that overlaps both
// legs. Elevation (hills) lives on trap-free stretches; trap zones stay flat (y=0)
// because trap hit-tests are floor-relative.
//
// Difficulty = LENGTH + many obstacles with GENEROUS, readable windows (so a human
// beats it through endurance + learning, not razor timing) + breather stretches.
// Verified by connectivity/traversal sims + a fairness analyzer.

// ---- raw tiles ---------------------------------------------------------------
function rawTile(cx, cz, w, d, topY = 0) { return { pos: [cx, topY - 0.5, cz], size: [w, 1, d] }; }
function rawPit(cx, cz, w, d, period, down, offset = 0) {
  return { pos: [cx, -0.5, cz], size: [w, 1, d], drop: { period, down, offset } };
}

// ---- trap defs ---------------------------------------------------------------
const tAxis = (x, z, length, speed, phase, random, cross) =>
  ({ type: "axis", pos: [x, z], length, thickness: 0.7, speed, phase: phase || 0, cross: !!cross,
     random: random ? { min: 0.8, max: 1.3 } : null });
const tSpears = (x, z, w, d, period, up, offset, random) =>
  ({ type: "spears", pos: [x, z], area: [w, d], period, up, offset: offset || 0, random: !!random });
const tCube = (fx, fz, tx, tz, speed, size, offset) =>
  ({ type: "spikecube", from: [fx, fz], to: [tx, tz], speed, size: size || 1.4, offset: offset || 0 });
const tCannon = (x, z, dx, dz, period, speed, offset, random) =>
  ({ type: "cannon", pos: [x, z], dir: [dx, dz], period, speed, offset: offset || 0, range: 30, random: !!random });
const tSaw = (x, z, speed, size) => ({ type: "chainsaw", start: [x, z], speed, size: size || 1.9 });

// ---- the Path builder --------------------------------------------------------
// Headings: S = -Z (forward/away), E = +X (right), W = -X (left).
const DV = { S: [0, -1], E: [1, 0], W: [-1, 0] };

function Path(start) {
  const OVER = 3;                 // every segment overlaps the previous by this much
  const sx0 = start[0], sz0 = start[1];   // start is [x, z]
  let hx = sx0, hz = sz0;
  let dir = "S", w = 6, curTy = 0;
  const tiles = [], traps = [];
  const gems = [], boosts = [], ramps = []; // collectibles + speed/launch decorations
  let seg = { sx: hx, sz: hz, ex: hx, ez: hz, dir, ty: 0, w };

  function box(L, ty, pitArgs) {
    const [dx, dz] = DV[dir];
    const nx = hx - dx * OVER, nz = hz - dz * OVER;       // near (overlaps previous)
    const ex = hx + dx * L, ez = hz + dz * L;             // far
    const cx = (nx + ex) / 2, cz = (nz + ez) / 2;
    const sx = dx !== 0 ? Math.abs(ex - nx) : w;
    const sz = dz !== 0 ? Math.abs(ez - nz) : w;
    if (pitArgs) tiles.push(rawPit(cx, cz, sx, sz, pitArgs[0], pitArgs[1], pitArgs[2]));
    else tiles.push(rawTile(cx, cz, sx, sz, ty));
    seg = { sx: hx, sz: hz, ex, ez, dir, ty, w };
    hx = ex; hz = ez; curTy = ty;
  }

  const P = {
    width(nw) { w = nw; return P; },
    run(L, ty = 0) { box(L, ty); return P; },
    pit(L, period, down, offset = 0) { box(L, 0, [period, down, offset]); return P; },
    ramp(L, toTy) {
      const from = curTy, n = Math.max(1, Math.ceil(Math.abs(toTy - from) / 0.3)), sL = L / n;
      for (let i = 0; i < n; i++) box(sL, from + (toTy - from) * (i + 1) / n);
      return P;
    },
    hill(height) { P.ramp(height / 0.28 + 6, height); P.run(8, height); P.run(10, 0); return P; },
    turn(nd) { const s = Math.max(w, 5.5) + 1.5; tiles.push(rawTile(hx, hz, s, s, 0)); dir = nd; return P; },

    at(f) { return [seg.sx + (seg.ex - seg.sx) * f, seg.sz + (seg.ez - seg.sz) * f]; },
    axis(f, length, speed, phase, random = true, cross = false) {
      const [x, z] = P.at(f); traps.push(tAxis(x, z, length, speed, phase, random, cross)); return P;
    },
    spears(f, sw, sd, period, up, offset, random = true) {
      const [x, z] = P.at(f); traps.push(tSpears(x, z, sw, sd, period, up, offset, random)); return P;
    },
    cube(f, amp, speed, size, offset) {
      const [x, z] = P.at(f);
      if (seg.dir === "S") traps.push(tCube(x - amp, z, x + amp, z, speed, size, offset));
      else traps.push(tCube(x, z - amp, x, z + amp, speed, size, offset));
      return P;
    },
    cannon(f, side, period, speed, offset, random = true) {
      const [x, z] = P.at(f), m = w / 2 + 0.6;
      if (seg.dir === "S") traps.push(tCannon(x + side * m, z, -side, 0, period, speed, offset, random));
      else traps.push(tCannon(x, z + side * m, 0, -side, period, speed, offset, random));
      return P;
    },
    saw(speed, behind = 12) { traps.push(tSaw(sx0, sz0 + behind, speed)); return P; },

    // ---- addiction decorations (no kill; deterministic, applied in World.update) ----
    // perpendicular unit vector for the current heading (lateral offset for gems)
    _perp() { const [dx, dz] = DV[seg.dir]; return [-dz, dx]; },
    // collectible gem at fraction f, offset `lateral` world-units sideways, floating at y.
    gem(f, lateral = 0, y = 1.3) {
      const [x, z] = P.at(f), [px, pz] = P._perp();
      gems.push([x + px * lateral, y, z + pz * lateral]);
      return P;
    },
    // speed pad: a brief surge that aligns + over-caps the marble along the track heading.
    boost(f, strength = 9) {
      const [x, z] = P.at(f), [dx, dz] = DV[seg.dir];
      boosts.push({ pos: [x, z], dir: [dx, dz], strength });
      return P;
    },
    // jump ramp: launches the marble up + forward when crossed grounded along the heading.
    jump(f, power = 13) {
      const [x, z] = P.at(f), [dx, dz] = DV[seg.dir];
      ramps.push({ pos: [x, z], dir: [dx, dz], power });
      return P;
    },

    finish(padW = 12) {
      const [dx, dz] = DV[dir];
      const nx = hx - dx * OVER, nz = hz - dz * OVER;
      const ex = hx + dx * 10, ez = hz + dz * 10;
      const cx = (nx + ex) / 2, cz = (nz + ez) / 2;
      const sx = dx !== 0 ? Math.abs(ex - nx) : padW;
      const sz = dz !== 0 ? Math.abs(ez - nz) : padW;
      tiles.push(rawTile(cx, cz, sx, sz, 0));
      P._finish = [hx + dx * 4, 0, hz + dz * 4];
      hx = ex; hz = ez;
      return P;
    },
    build(name, killY = -14) {
      return { name, start: [sx0, 1, sz0], finish: P._finish, killY, platforms: tiles, traps, gems, boosts, ramps };
    },
  };
  return P;
}

// ---- composable legs (each adds several flat trap-segments; generous windows) -
// `i` index varies offsets so cycles desync. One obstacle per ~15 units.
// Each leg = several obstacle segments + a trap-free rest run (length + breathing).
function legAxis(p, n, w, axlen, base) {
  p.width(w);
  for (let i = 0; i < n; i++) p.run(19).axis(0.5, axlen, (i % 2 ? -base : base), (i * 0.27) % 1, true);
  p.run(12); return p;
}
function legSpears(p, n, w) {
  p.width(w);
  for (let i = 0; i < n; i++) p.run(18).spears(0.5, Math.min(w - 0.6, 6.5), 4, 2.0, 0.75, (i * 0.4) % 1, true);
  p.run(12); return p;
}
function legCannons(p, n, w) {
  p.width(w);
  for (let i = 0; i < n; i++) p.run(18).cannon(0.5, i % 2 ? 1 : -1, 1.8, 9, (i * 0.5) % 1);
  p.run(12); return p;
}
function legCubes(p, n, w, amp) {
  p.width(w);
  for (let i = 0; i < n; i++) p.run(18).cube(0.5, amp, 2.4, 1.4, (i * 0.33) % 1);
  p.run(12); return p;
}
function legPits(p, n, w) {
  p.width(w);
  for (let i = 0; i < n; i++) { p.run(11).pit(6, 2.5, 0.8, (i * 0.4) % 1); }
  p.run(14); return p;
}
function legMixed(p, n, w) {
  p.width(w);
  for (let i = 0; i < n; i++) {
    if (i % 3 === 0) p.run(18).spears(0.5, Math.min(w - 0.6, 6.5), 4, 2.0, 0.75, (i * 0.3) % 1, true);
    else if (i % 3 === 1) p.run(18).axis(0.5, Math.min(w - 0.5, 4.6), (i % 2 ? -1 : 1) * 1.0, (i * 0.3) % 1, true);
    else p.run(18).cannon(0.5, i % 2 ? 1 : -1, 1.8, 9, (i * 0.5) % 1);
  }
  p.run(12); return p;
}
// widened leg (5.6) with a cross-axe — short/slow so the wall-hug corridor is real
function legCross(p, dir) {
  p.width(5.6).run(24).axis(0.5, 3.0, dir * 0.8, 0, true, true).run(14);
  return p;
}
function breather(p, w) { p.width(w).run(22); return p; }  // trap-free rest stretch

// ---- the 8 levels (each ~4x the old length; snaking with turns) --------------

function L1() {
  const p = Path([0, 6]);
  legAxis(p, 3, 8, 7.0, 0.8).gem(0.3, -2.4).gem(0.55, 2.4).gem(0.8, 0); breather(p, 8);
  p.turn("E"); legCubes(p, 3, 8, 3.2);
  p.turn("S"); p.hill(0.9); legSpears(p, 3, 7);
  p.turn("W"); legAxis(p, 3, 8, 7.0, 0.8);
  p.turn("S"); legCubes(p, 3, 8, 3.0); breather(p, 8);
  p.turn("E"); legSpears(p, 3, 7);
  p.turn("S"); legAxis(p, 3, 8, 7.0, 0.7);
  p.run(12); p.finish();
  return p.build("WARM UP");
}

function L2() {
  const p = Path([0, 6]);
  legSpears(p, 4, 6).gem(0.3, -2).gem(0.6, 2).gem(0.85, 0); p.turn("E"); legAxis(p, 3, 6, 5.4, 1.0);
  p.turn("S"); legSpears(p, 4, 6); p.turn("W"); legCannons(p, 3, 6);
  p.turn("S"); p.hill(0.8); legAxis(p, 4, 6, 5.4, 1.0);
  p.turn("E"); legSpears(p, 3, 6); p.turn("S"); legAxis(p, 4, 6, 5.4, 1.0);
  p.turn("W"); legSpears(p, 3, 6); p.turn("S"); legSpears(p, 3, 6);
  p.run(12); p.finish();
  return p.build("SPIKE FIELD");
}

function L3() {
  const p = Path([0, 6]);
  legPits(p, 3, 6); legCannons(p, 2, 6).gem(0.3, -2).gem(0.6, 2).gem(0.85, 0);
  p.turn("E"); legPits(p, 3, 6); p.turn("S"); legCannons(p, 3, 6);
  p.turn("W"); legPits(p, 3, 6); p.turn("S"); legCubes(p, 3, 6, 2.4);
  p.turn("E"); legPits(p, 3, 6); p.turn("S"); legCannons(p, 3, 6);
  p.turn("W"); legPits(p, 3, 6); p.turn("S"); legCannons(p, 2, 6);
  p.run(12); p.finish();
  return p.build("PIT STOP");
}

function L4() {
  const p = Path([0, 6]);
  legCannons(p, 3, 7).gem(0.3, -2.6).gem(0.6, 2.6).gem(0.85, 0); breather(p, 4.4); legCubes(p, 3, 4.4, 1.4);
  p.turn("E"); legCannons(p, 3, 7); p.turn("S"); legCubes(p, 3, 8, 3.0);
  p.turn("W"); legCannons(p, 3, 7); p.turn("S"); legCubes(p, 3, 4.4, 1.4);
  p.turn("E"); legCannons(p, 3, 7); p.turn("S"); legCubes(p, 3, 6, 2.6);
  p.turn("W"); legCannons(p, 3, 7); p.turn("S"); legCubes(p, 2, 6, 2.4);
  p.run(12); p.finish();
  return p.build("CROSSFIRE");
}

function L5() {
  const p = Path([0, 8]).saw(3.3);
  legAxis(p, 4, 5, 4.6, 0.7).gem(0.3, -1.6).gem(0.6, 1.6).gem(0.85, 0); p.turn("E"); legAxis(p, 3, 5, 4.6, 0.7);
  p.turn("S"); legCubes(p, 3, 5, 1.6); p.hill(0.8);
  p.turn("W"); legAxis(p, 4, 5, 4.6, 0.7); p.turn("S"); legAxis(p, 3, 5, 4.6, 0.7);
  p.turn("E"); legCubes(p, 3, 5, 1.6); p.turn("S"); legAxis(p, 4, 5, 4.6, 0.7);
  p.turn("W"); legAxis(p, 3, 5, 4.6, 0.7); p.turn("S"); legAxis(p, 3, 5, 4.6, 0.7);
  p.run(12); p.finish();
  return p.build("THE SAW");
}

function L6() {
  const p = Path([0, 6]);
  legMixed(p, 4, 4.6).gem(0.3, -1.4).gem(0.6, 1.4).gem(0.85, 0); p.turn("E"); legCannons(p, 3, 4.6);
  p.turn("S"); p.hill(0.8); legSpears(p, 3, 4.6);
  p.turn("W"); legCross(p, 1); p.turn("S"); legMixed(p, 4, 4.6);
  p.turn("E"); legCubes(p, 3, 4.6, 1.0); p.turn("S"); legSpears(p, 3, 4.6);
  p.turn("W"); legAxis(p, 3, 4.6, 4.2, 1.1); p.turn("S"); legMixed(p, 3, 4.6);
  p.run(12); p.finish();
  return p.build("GAUNTLET");
}

function L7() {
  const p = Path([0, 8]).saw(3.6);
  legCannons(p, 3, 4.6).gem(0.3, -1.4).gem(0.6, 1.4).gem(0.85, 0); legPits(p, 2, 4.6);
  p.turn("E"); legAxis(p, 3, 4.6, 4.2, 1.0); p.turn("S"); legCross(p, 1);
  p.turn("W"); legCubes(p, 3, 4.6, 1.0); p.turn("S"); legPits(p, 2, 4.6);
  p.turn("E"); legCannons(p, 3, 4.6); p.turn("S"); legMixed(p, 4, 4.6);
  p.turn("W"); legAxis(p, 3, 4.6, 4.2, 1.0); p.turn("S"); legSpears(p, 3, 4.6);
  p.run(12); p.finish();
  return p.build("CHASE");
}

function L8() {
  const p = Path([0, 8]).saw(3.9);
  legSpears(p, 3, 4.6).gem(0.3, -1.4).gem(0.6, 1.4).gem(0.85, 0); legAxis(p, 3, 4.6, 4.2, 1.0);
  p.turn("E"); legPits(p, 2, 4.6); legCannons(p, 2, 4.6);
  p.turn("S"); p.hill(0.9); legCross(p, 1);
  p.turn("W"); legMixed(p, 4, 4.6); p.turn("S"); legCubes(p, 3, 4.6, 1.0);
  p.turn("E"); legCross(p, -1); p.turn("S"); legSpears(p, 3, 4.6);
  p.turn("W"); legCannons(p, 3, 4.6); p.turn("S"); legAxis(p, 3, 4.6, 4.2, 1.0);
  p.turn("E"); legMixed(p, 3, 4.6); p.turn("S"); legSpears(p, 3, 4.6);
  p.run(12); p.finish();
  return p.build("FINALE");
}

// ---- L9–L13: harder tier. Narrower corridors, denser obstacles, chasing saws,
//      plus boost pads (surge) + jump ramps (launch) + 3 gems each. Escalates gradually.

function L9() {
  const p = Path([0, 8]).saw(4.0);
  legMixed(p, 4, 4.4).gem(0.4, -1.3).gem(0.75, 1.3); p.boost(0.5, 11);
  p.turn("E"); legCubes(p, 3, 4.4, 1.0); p.turn("S"); legCannons(p, 3, 4.4);
  p.turn("W"); legCross(p, 1); p.turn("S"); legSpears(p, 3, 4.4).gem(0.6, 0);
  p.turn("E"); legAxis(p, 3, 4.4, 4.0, 1.1); p.turn("S"); legPits(p, 2, 4.4); p.jump(0.5, 13);
  p.turn("W"); legMixed(p, 3, 4.4); p.turn("S"); legCannons(p, 3, 4.4);
  p.run(12); p.finish();
  return p.build("OVERDRIVE");
}

function L10() {
  const p = Path([0, 8]).saw(4.2);
  legCannons(p, 3, 4.3); legPits(p, 2, 4.3).gem(0.5, 0); p.jump(0.5, 13);
  p.turn("E"); legCross(p, 1); p.turn("S"); legMixed(p, 4, 4.3).gem(0.4, -1.2);
  p.turn("W"); legAxis(p, 3, 4.3, 4.0, 1.1); p.boost(0.5, 11); p.turn("S"); legCubes(p, 3, 4.3, 1.0);
  p.turn("E"); legSpears(p, 3, 4.3).gem(0.6, 1.2); p.turn("S"); legCross(p, -1);
  p.turn("W"); legCannons(p, 3, 4.3); p.turn("S"); legMixed(p, 4, 4.3);
  p.run(12); p.finish();
  return p.build("CROSS HAIRS");
}

function L11() {
  const p = Path([0, 8]).saw(4.4);
  legSpears(p, 3, 4.2).gem(0.4, -1.1).gem(0.75, 1.1); legAxis(p, 3, 4.2, 4.0, 1.2);
  p.turn("E"); legMixed(p, 4, 4.2); p.boost(0.5, 12); p.turn("S"); legPits(p, 3, 4.2); p.jump(0.5, 14);
  p.turn("W"); legCannons(p, 3, 4.2); p.turn("S"); legCross(p, 1);
  p.turn("E"); legCubes(p, 3, 4.2, 1.0).gem(0.6, 0); p.turn("S"); legSpears(p, 3, 4.2);
  p.turn("W"); legMixed(p, 4, 4.2); p.turn("S"); legAxis(p, 3, 4.2, 4.0, 1.2);
  p.run(12); p.finish();
  return p.build("PRESSURE");
}

function L12() {
  const p = Path([0, 8]).saw(4.6);
  legMixed(p, 5, 4.1).gem(0.35, -1.0).gem(0.7, 1.0); legCross(p, 1);
  p.turn("E"); legCannons(p, 4, 4.1); p.boost(0.5, 12); p.turn("S"); legPits(p, 3, 4.1); p.jump(0.5, 14);
  p.turn("W"); legSpears(p, 4, 4.1); p.turn("S"); legAxis(p, 4, 4.1, 4.0, 1.2);
  p.turn("E"); legCubes(p, 3, 4.1, 1.0).gem(0.6, 0); p.turn("S"); legCross(p, -1);
  p.turn("W"); legMixed(p, 5, 4.1); p.turn("S"); legCannons(p, 4, 4.1);
  p.turn("E"); legSpears(p, 4, 4.1); p.turn("S"); legAxis(p, 4, 4.1, 4.0, 1.2);
  p.run(12); p.finish();
  return p.build("MARATHON");
}

function L13() {
  const p = Path([0, 8]).saw(5.0);
  legMixed(p, 5, 4.0).gem(0.4, -0.9); p.boost(0.5, 12); legCross(p, 1);
  p.turn("E"); legSpears(p, 4, 4.0); p.turn("S"); legPits(p, 3, 4.0); p.jump(0.5, 15);
  p.turn("W"); legCannons(p, 4, 4.0); p.turn("S"); legAxis(p, 4, 4.0, 4.0, 1.3); p.boost(0.5, 13);
  p.turn("E"); legCubes(p, 4, 4.0, 1.0).gem(0.6, 0); p.turn("S"); legCross(p, -1);
  p.turn("W"); legMixed(p, 5, 4.0); p.turn("S"); legSpears(p, 4, 4.0).gem(0.5, 0.9);
  p.turn("E"); legCannons(p, 4, 4.0); p.turn("S"); legCross(p, 1);
  p.turn("W"); legAxis(p, 4, 4.0, 4.0, 1.3); p.turn("S"); legMixed(p, 5, 4.0);
  p.run(12); p.finish();
  return p.build("MARBLE TRAP");
}

export const LEVELS = [L1(), L2(), L3(), L4(), L5(), L6(), L7(), L8(), L9(), L10(), L11(), L12(), L13()];
export const LEVEL_COUNT = LEVELS.length;
