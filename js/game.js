// Game state: a World that loads one level into the scene, steps physics + traps,
// and reports playing/dead/won; plus localStorage persistence for best times and
// which levels are unlocked.

import * as THREE from "three";
import { LEVELS } from "./levels.js";
import { stepMarble, makeMarble, platformSolid, platformDropY, MARBLE_RADIUS } from "./physics.js";
import { makeTrap } from "./traps.js";
import { buildPlatforms, buildFinish, buildMarble } from "./builder.js";

// ---------------- persistence ----------------
const BEST_KEY = "brennan_best_v1";
const UNLOCK_KEY = "brennan_unlocked_v1";

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
  }

  load(index) {
    this.dispose();
    this.levelIndex = index;
    const level = LEVELS[index];
    this.level = level;
    this.time = 0;
    this.status = "playing";

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
    this.marble = makeMarble(level.start, level.killY);
    for (const t of this.traps) t.reset();
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

    // animate traps + visual pit sinking
    for (const t of this.traps) t.update(dt, this.time, this.marble.pos);
    for (const pt of this.pitTiles) pt.mesh.position.y = pt.def.pos[1] + platformDropY(pt.def, this.time);

    // spin the finish pad
    if (this.finishGroup?.userData.spin) this.finishGroup.userData.spin.rotation.y += dt * 1.5;

    // death checks
    if (fell) { this.status = "dead"; this.deathReason = "You fell into the void!"; return this.status; }
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
    if (dx * dx + dz * dz < 1.7 * 1.7 && this.marble.pos.y < 2.0) {
      this.status = "won";
      return this.status;
    }

    // visuals: roll the marble based on velocity
    this._rollMarble(dt);
    this._syncMarble();
    return this.status;
  }

  // Animate traps/scenery without running physics or death checks (menu backdrop).
  idleUpdate(dt) {
    this.time += dt;
    for (const t of this.traps) t.update(dt, this.time, null);
    for (const pt of this.pitTiles) pt.mesh.position.y = pt.def.pos[1] + platformDropY(pt.def, this.time);
    if (this.finishGroup?.userData.spin) this.finishGroup.userData.spin.rotation.y += dt * 1.5;
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
