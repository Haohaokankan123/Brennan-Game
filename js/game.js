// Game state: a World that loads one level into the scene, steps physics + traps,
// and reports playing/dead/won; plus localStorage persistence for best times and
// which levels are unlocked.

import * as THREE from "three";
import { LEVELS } from "./levels.js";
import { stepMarble, makeMarble, platformSolid, platformDropY, MARBLE_RADIUS } from "./physics.js";
import { makeTrap } from "./traps.js";
import { buildPlatforms, buildFinish, buildMarble, buildGems, buildBoostPads, buildRamps, buildGhostMarble } from "./builder.js";

// ---------------- persistence ----------------
const BEST_KEY = "brennan_best_v1";
const UNLOCK_KEY = "brennan_unlocked_v1";
const GHOST_KEY = "brennan_ghost_v1";
const GEMS_KEY = "brennan_gems_v1";
const GHOST_DT = 0.05; // ghost path is sampled every 50ms

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
export function getBest(i) {
  const all = readJSON(BEST_KEY, {});
  return all[i] ?? null;
}
export function setBest(i, seconds) {
  const all = readJSON(BEST_KEY, {});
  if (all[i] == null || seconds < all[i]) {
    all[i] = seconds;
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
    return true; // new record
  }
  return false;
}
export function getUnlocked() {
  return readJSON(UNLOCK_KEY, 0); // index of highest unlocked level (0-based)
}
export function unlock(i) {
  if (i > getUnlocked()) localStorage.setItem(UNLOCK_KEY, JSON.stringify(i));
}
// best gem count per level (0..3); used for the "perfect" star
export function getGemsBest(i) { return readJSON(GEMS_KEY, {})[i] ?? 0; }
export function setGemsBest(i, count) {
  const all = readJSON(GEMS_KEY, {});
  if (count > (all[i] ?? 0)) { all[i] = count; localStorage.setItem(GEMS_KEY, JSON.stringify(all)); }
}
// ghost replay path per level: { dt, pts:[[x,y,z],...] } stored on a new best run
export function getGhost(i) { return readJSON(GHOST_KEY, {})[i] ?? null; }
export function setGhost(i, path) {
  const all = readJSON(GHOST_KEY, {});
  all[i] = path;
  try { localStorage.setItem(GHOST_KEY, JSON.stringify(all)); } catch { /* quota */ }
}

// ---------------- World ----------------
export class World {
  constructor(scene) {
    this.scene = scene;
    this.levelIndex = 0;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.platforms = [];   // physics platform defs
    this.pitTiles = [];    // {def, mesh} for visual sinking
    this.traps = [];
    this.finishGroup = null;
    this.marbleGroup = null;
    this.marble = null;    // physics state
    this.time = 0;         // level clock (drives traps + timer)
    this.status = "playing";

    // addiction features
    this.gems = [];        // [{pos:[x,y,z], mesh, baseY, collected}]
    this.gemCount = 0;     // gems collected this run
    this.boosts = [];      // [{def, mesh}]
    this.ramps = [];       // [{def, mesh, cool}]
    this.ghostGroup = null;
    this.ghostPath = null; // {dt, pts:[[x,y,z],...]} or null
    this.recordPath = [];  // samples of the current run (saved if it's a new best)
    this._recAcc = 0;      // sampler accumulator
  }

  load(index) {
    this.dispose();
    this.levelIndex = index;
    const level = LEVELS[index];
    this.level = level;
    this.time = 0;
    this.status = "playing";
    this._splashTimer = -1;
    this._splashed = false;

    // platforms
    const { group, pitTiles } = buildPlatforms(level);
    this.root.add(group);
    this._platformGroup = group;
    this.pitTiles = pitTiles;
    this.platforms = level.platforms;

    // finish
    this.finishGroup = buildFinish(level);
    this.root.add(this.finishGroup);

    // traps
    this.traps = [];
    for (const def of level.traps) {
      const t = makeTrap(def);
      if (t) { this.traps.push(t); this.root.add(t.group); }
    }

    // gems / boost pads / jump ramps
    const gemBuild = buildGems(level);
    this.root.add(gemBuild.group);
    this.gems = gemBuild.items.map((g) => ({ ...g, collected: false }));
    this.gemCount = 0;
    const boostBuild = buildBoostPads(level);
    this.root.add(boostBuild.group);
    this.boosts = boostBuild.items;
    const rampBuild = buildRamps(level);
    this.root.add(rampBuild.group);
    this.ramps = rampBuild.items.map((r) => ({ ...r, cool: 0 }));

    // ghost replay (best run for this level, if any)
    this.ghostGroup = buildGhostMarble();
    this.root.add(this.ghostGroup);
    this.ghostPath = getGhost(index);
    this.recordPath = [];
    this._recAcc = 0;

    // marble
    this.marbleGroup = buildMarble();
    this.root.add(this.marbleGroup);
    this.marble = makeMarble(level.start, level.killY);
    this._syncMarble();
  }

  respawn() {
    const level = this.level;
    this.time = 0;
    this.status = "playing";
    this._splashTimer = -1;
    this._splashed = false;
    this.marble = makeMarble(level.start, level.killY);
    for (const t of this.traps) t.reset();
    // restore gems + reset run-scoped state
    for (const g of this.gems) { g.collected = false; g.mesh.visible = true; }
    this.gemCount = 0;
    for (const r of this.ramps) r.cool = 0;
    this.recordPath = [];
    this._recAcc = 0;
    if (this.ghostGroup) this.ghostGroup.visible = false;
    this._syncMarble();
  }

  _syncMarble() {
    this.marbleGroup.position.copy(this.marble.pos);
  }

  // input: {x, z} each in [-1,1] (world axes). dt seconds.
  update(input, dt) {
    if (this.status !== "playing") return this.status;

    this.time += dt;

    // step physics
    const { fell } = stepMarble(this.marble, input, this.platforms, this.time, dt);

    // boost pads + jump ramps (deterministic, no kill — applied to velocity post-step)
    this._applyPads(dt);

    // animate traps + visual pit sinking
    for (const t of this.traps) t.update(dt, this.time, this.marble.pos);
    for (const pt of this.pitTiles) pt.mesh.position.y = pt.def.pos[1] + platformDropY(pt.def, this.time);

    // spin the finish pad
    if (this.finishGroup?.userData.spin) this.finishGroup.userData.spin.rotation.y += dt * 1.5;

    // keep the rendered marble in sync with physics BEFORE any death/win early-return,
    // so death/win particle bursts spawn exactly where the marble is shown.
    this._syncMarble();

    // gems, ghost replay, and best-run path recording
    this._collectGems();
    this._updateGhost();
    this._recordSample(dt);

    // death checks — falling into water: splash first, die after 0.7s
    if (fell && !this._splashed) {
      this._splashed = true;
      this._splashTimer = 0.7;
      this.status = "splash"; // signal main.js to show water particles
      return "splash";
    }
    if (this._splashTimer > 0) {
      this._splashTimer -= dt;
      if (this._splashTimer <= 0) {
        this.status = "dead";
        this.deathReason = "You fell into the water!";
        return "dead";
      }
      return "splash"; // still sinking
    }
    for (const t of this.traps) {
      if (t.hits(this.marble.pos, MARBLE_RADIUS)) {
        this.status = "dead";
        this.deathReason = "A trap got you!";
        return this.status;
      }
    }

    // win check (reach the finish gate near the floor)
    const f = this.level.finish;
    const dx = this.marble.pos.x - f[0];
    const dz = this.marble.pos.z - f[2];
    if (dx * dx + dz * dz < 2.4 * 2.4 && this.marble.pos.y < 3.0) {
      this.status = "won";
      return this.status;
    }

    // proximity transparency: fade any trap that overlaps the marble's view
    this._updateTrapOpacity();

    // visuals: roll the marble based on velocity
    this._rollMarble(dt);
    this._syncMarble();
    return this.status;
  }

  _updateTrapOpacity() {
    const px = this.marble.pos.x, pz = this.marble.pos.z;
    for (const t of this.traps) {
      const dx = px - t.group.position.x;
      const dz = pz - t.group.position.z;
      const near = dx * dx + dz * dz < 64; // 8-unit radius
      t.group.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          m.transparent = near;
          m.opacity = near ? 0.18 : 1.0;
        }
      });
    }
  }

  // Animate traps/scenery without running physics or death checks (menu backdrop).
  idleUpdate(dt) {
    this.time += dt;
    for (const t of this.traps) t.update(dt, this.time, null);
    for (const pt of this.pitTiles) pt.mesh.position.y = pt.def.pos[1] + platformDropY(pt.def, this.time);
    if (this.finishGroup?.userData.spin) this.finishGroup.userData.spin.rotation.y += dt * 1.5;
    for (const g of this.gems) { g.mesh.rotation.y += 0.04; g.mesh.position.y = g.baseY + Math.sin(this.time * 2 + g.pos[0]) * 0.18; }
    this._updateGhost();
  }

  _rollMarble(dt) {
    const v = this.marble.vel;
    const speed = Math.hypot(v.x, v.z);
    if (speed < 1e-3) return;
    const axis = new THREE.Vector3(v.z, 0, -v.x).normalize();
    const angle = (speed * dt) / MARBLE_RADIUS;
    const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    for (const mesh of this.marbleGroup.userData.spin) {
      mesh.quaternion.premultiply(q);
    }
  }

  // ---- boost pads (forward surge) + jump ramps (launch) ----
  _applyPads(dt) {
    const m = this.marble;
    for (const b of this.boosts) {
      const dx = m.pos.x - b.def.pos[0], dz = m.pos.z - b.def.pos[1];
      if (dx * dx + dz * dz < 2.0 * 2.0 && m.grounded) {
        const [ux, uz] = b.def.dir, s = b.def.strength;
        const along = m.vel.x * ux + m.vel.z * uz;
        if (along < s) { m.vel.x = ux * s; m.vel.z = uz * s; } // snap to a forward surge lane
      }
    }
    for (const r of this.ramps) {
      if (r.cool > 0) r.cool -= dt;
      const dx = m.pos.x - r.def.pos[0], dz = m.pos.z - r.def.pos[1];
      const [ux, uz] = r.def.dir;
      const along = m.vel.x * ux + m.vel.z * uz;
      if (r.cool <= 0 && dx * dx + dz * dz < 2.2 * 2.2 && m.grounded && along > 1) {
        m.vel.y = r.def.power;        // launch up
        m.vel.x += ux * 3; m.vel.z += uz * 3; // + a forward nudge
        r.cool = 0.8;                 // debounce so one pass = one launch
      }
    }
  }

  // ---- gems: spin/bob + collect on contact ----
  _collectGems() {
    const m = this.marble, R = 0.6 + 0.7;
    for (const g of this.gems) {
      g.mesh.rotation.y += 0.04;
      g.mesh.position.y = g.baseY + Math.sin(this.time * 2 + g.pos[0]) * 0.18;
      if (g.collected) continue;
      const dx = m.pos.x - g.pos[0], dy = m.pos.y - g.pos[1], dz = m.pos.z - g.pos[2];
      if (dx * dx + dy * dy + dz * dz < R * R) {
        g.collected = true;
        g.mesh.visible = false;
        this.gemCount++;
      }
    }
  }

  // ---- ghost replay: position the translucent marble along the saved best path ----
  _updateGhost() {
    const gp = this.ghostPath;
    if (!gp || !gp.pts || !gp.pts.length) { if (this.ghostGroup) this.ghostGroup.visible = false; return; }
    const dt = gp.dt || GHOST_DT;
    const f = this.time / dt;
    const i = Math.floor(f);
    if (i >= gp.pts.length - 1) { this.ghostGroup.visible = false; return; }
    const a = gp.pts[i], b = gp.pts[i + 1], k = f - i;
    this.ghostGroup.visible = true;
    this.ghostGroup.position.set(
      a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k
    );
    this.ghostGroup.rotation.y += 0.05;
  }

  // ---- record the current run so a new best can be saved as the ghost ----
  _recordSample(dt) {
    this._recAcc += dt;
    if (this._recAcc < GHOST_DT) return;
    this._recAcc -= GHOST_DT;
    if (this.recordPath.length < 2000) {
      const p = this.marble.pos;
      this.recordPath.push([Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.z * 100) / 100]);
    }
  }

  // snapshot of the run path in ghost-storage format (called by main.js on a new best)
  getRunPath() { return { dt: GHOST_DT, pts: this.recordPath.slice() }; }

  dispose() {
    // remove and free everything under root
    while (this.root.children.length) {
      const c = this.root.children.pop();
      c.traverse?.((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
      this.root.remove(c);
    }
    this.traps = [];
    this.pitTiles = [];
  }
}
