// Traps for Brennan Game. Each trap factory returns an object with:
//   group  : THREE.Object3D to add to the scene
//   update(dt, time, marblePos) : animate
//   hits(marblePos, r) -> boolean : did it just kill the marble?
//   reset() : restore to initial state (called on respawn)
// The floor surface is y = 0 for every level.

import * as THREE from "three";

const FLOOR = 0;

// --- shared neon materials (emissive so the bloom pass makes them glow) ---
const mat = (color, emissiveBoost = 1.4) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: emissiveBoost,
    metalness: 0.3,
    roughness: 0.4,
  });

const COL = {
  magenta: 0xff2e88,
  cyan: 0x00f0ff,
  purple: 0xb24bff,
  yellow: 0xffe66d,
  red: 0xff3355,
  orange: 0xff8a3d,
};

function spikeCone(color, h = 0.7, rad = 0.22) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 6), mat(color, 1.2));
  return m;
}

// triangle wave in [0,1] for ping-pong motion
function pingpong(t) {
  const x = t % 1;
  return x < 0.5 ? x * 2 : 2 - x * 2;
}

// Deterministic hash -> [0,1). Same input always gives the same output, so the
// visual update() and the hits() test agree on "random" values frame to frame.
function hash01(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// A randomized cycle clock. Splits `time` into back-to-back cycles whose individual
// DURATIONS vary (between minDur and maxDur) and returns:
//   { idx, local, dur, rnd }  where rnd is a stable per-cycle random in [0,1).
// Because durations come from hash01(idx), this is fully deterministic from time.
function randCycle(time, seed, minDur, maxDur) {
  // walk forward cycle by cycle from t=0 until we pass `time`.
  // cycles are short and levels are seconds long, so this loop is cheap.
  let t = ((time % 100000) + 100000) % 100000; // guard against negatives
  let idx = 0, start = 0;
  // fast-forward using average duration to avoid long loops on big times
  const avg = (minDur + maxDur) / 2;
  const skip = Math.max(0, Math.floor(t / avg) - 2);
  idx = skip;
  // reconstruct start time for `skip` cycles (approx then correct by walking)
  start = 0;
  for (let k = 0; k < idx; k++) start += minDur + (maxDur - minDur) * hash01(seed + k * 7.13);
  // walk to the real cycle containing t
  for (let guard = 0; guard < 100000; guard++) {
    const dur = minDur + (maxDur - minDur) * hash01(seed + idx * 7.13);
    if (t < start + dur) {
      return { idx, local: t - start, dur, rnd: hash01(seed + idx * 13.31) };
    }
    start += dur;
    idx++;
  }
  return { idx, local: 0, dur: maxDur, rnd: 0.5 };
}

// ---------------------------------------------------------------- Rotating axis
function makeAxis(def) {
  const { pos, length, thickness, speed, phase } = def;
  const [x, z] = pos;
  const group = new THREE.Group();
  group.position.set(x, FLOOR + 0.6, z);

  const cross = !!def.cross; // a second perpendicular beam (4-arm "cross axe")

  const beam = new THREE.Mesh(new THREE.BoxGeometry(length, 1.1, thickness), mat(COL.magenta));
  group.add(beam);
  if (cross) {
    const beam2 = new THREE.Mesh(new THREE.BoxGeometry(length, 1.1, thickness), mat(COL.magenta));
    beam2.rotation.y = Math.PI / 2;
    group.add(beam2);
  }
  // glowing hub
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.4, 12), mat(COL.purple, 1.6));
  group.add(hub);
  // end caps (all 4 arm tips when cross)
  const caps = cross ? [[-1, 0], [1, 0], [0, -1], [0, 1]] : [[-1, 0], [1, 0]];
  for (const [sx, sz] of caps) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), mat(COL.cyan, 1.6));
    cap.position.set(sx * length / 2, 0, sz * length / 2);
    group.add(cap);
  }

  // randomized rotation: angle is a deterministic function of time so update()
  // and hits() always agree. Each "cycle" is a quarter-ish sweep whose angular
  // speed is randomized (sometimes whips fast, sometimes crawls).
  const rnd = def.random;                 // { min, max } speed multipliers, or undefined
  const seed = Math.abs(x * 12.9 + z * 78.2 + length * 3.7) + 1;

  // total rotation angle at a given time (integral of the per-cycle speed).
  function angleAt(time) {
    if (!rnd) return phase + speed * time;
    // each cycle lasts a base of ~0.9s; speed multiplier varies per cycle.
    let a = phase, t = ((time % 100000) + 100000) % 100000, base = 0.9;
    let idx = 0, acc = 0;
    for (let guard = 0; guard < 100000; guard++) {
      const mult = rnd.min + (rnd.max - rnd.min) * hash01(seed + idx * 5.17);
      const dir = Math.sign(speed) || 1;
      const dur = base;
      if (t < acc + dur) { a += dir * Math.abs(speed) * mult * (t - acc); return a; }
      a += dir * Math.abs(speed) * mult * dur;
      acc += dur; idx++;
    }
    return a;
  }

  let curAngle = phase;

  return {
    group,
    update(dt, time) {
      curAngle = angleAt(time);
      group.rotation.y = curAngle;
    },
    hits(p, r) {
      // world -> beam-local: rotate by -angle around Y (matches group.rotation.y)
      const dx = p.x - x, dz = p.z - z;
      const c = Math.cos(curAngle), s = Math.sin(curAngle);
      const lx = dx * c - dz * s;          // along the beam
      const lz = dx * s + dz * c;          // across the beam
      const onBeam = Math.abs(lx) < length / 2 + r * 0.5 && Math.abs(lz) < thickness / 2 + r;
      if (onBeam) return true;
      // the perpendicular arm (swap roles of lx/lz)
      if (cross) return Math.abs(lz) < length / 2 + r * 0.5 && Math.abs(lx) < thickness / 2 + r;
      return false;
    },
    reset() { curAngle = phase; group.rotation.y = curAngle; },
  };
}

// ---------------------------------------------------------------- Rising spears
function makeSpears(def) {
  const { pos, area, period, up, offset } = def;
  const [x, z] = pos;
  const [w, d] = area;
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // base pad so the field is visible even when spikes are down
  const pad = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), mat(COL.purple, 0.7));
  pad.position.y = FLOOR + 0.06;
  group.add(pad);

  const cols = Math.max(2, Math.round(w / 0.9));
  const rows = Math.max(2, Math.round(d / 0.9));
  const cones = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const c = spikeCone(COL.cyan, 0.8, 0.2);
      c.position.x = -w / 2 + (i + 0.5) * (w / cols);
      c.position.z = -d / 2 + (j + 0.5) * (d / rows);
      group.add(c);
      cones.push(c);
    }
  }

  let raised = 0; // 0 = hidden, 1 = fully up

  const rnd = def.random;          // { } -> randomize period + up-time per cycle
  const seed = Math.abs(x * 9.1 + z * 41.3 + w * 2.2) + 3;

  const compute = (time) => {
    if (!rnd) {
      const t = (((time + offset) % period) + period) % period;
      if (t < up) raised = Math.min(1, t / 0.15);
      else raised = Math.max(0, 1 - (t - up) / 0.3);
      return;
    }
    // randomized: cycle length varies; up-time varies within the cycle.
    const cyc = randCycle(time + offset, seed, period * 0.7, period * 1.5);
    const upDur = up * (0.7 + 0.9 * cyc.rnd);   // 0.7x .. 1.6x the base up-time
    const t = cyc.local;
    if (t < upDur) raised = Math.min(1, t / 0.15);
    else raised = Math.max(0, 1 - (t - upDur) / 0.3);
  };

  return {
    group,
    update(dt, time) {
      compute(time);
      const y = FLOOR - 0.5 + raised * 0.95; // base of cone (cone center offset below)
      for (const c of cones) c.position.y = y;
    },
    hits(p, r) {
      if (raised < 0.6) return false; // spikes must be visibly up to hurt
      return Math.abs(p.x - x) < w / 2 && Math.abs(p.z - z) < d / 2;
    },
    reset() { raised = 0; },
  };
}

// ---------------------------------------------------------------- Spike cube
function makeCube(def) {
  const { from, to, speed, size, offset } = def;
  const half = size / 2;
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat(COL.orange, 1.3));
  group.add(body);
  // spikes on the 4 side faces
  for (const [ax, az, ry] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]) {
    const sp = spikeCone(COL.magenta, 0.6, 0.25);
    sp.position.set(ax * half, 0, az * half);
    sp.rotation.z = ax !== 0 ? -ax * Math.PI / 2 : 0;
    sp.rotation.x = az !== 0 ? az * Math.PI / 2 : 0;
    group.add(sp);
  }

  let cx = from[0], cz = from[1];

  const place = (time) => {
    // pingpong has slope 2, so divide by 2*dist: authored speed = real units/sec
    const t = pingpong((time + offset) * speed / (2 * dist()));
    cx = from[0] + (to[0] - from[0]) * t;
    cz = from[1] + (to[1] - from[1]) * t;
    group.position.set(cx, FLOOR + half, cz);
  };
  function dist() {
    return Math.max(0.001, Math.hypot(to[0] - from[0], to[1] - from[1]));
  }

  return {
    group,
    update(dt, time) {
      place(time);
      group.rotation.y += dt * 2.5;
    },
    hits(p, r) {
      const qx = Math.max(cx - half, Math.min(p.x, cx + half));
      const qz = Math.max(cz - half, Math.min(p.z, cz + half));
      const qy = Math.max(FLOOR, Math.min(p.y, FLOOR + size));
      const dx = p.x - qx, dy = p.y - qy, dz = p.z - qz;
      return dx * dx + dy * dy + dz * dz < r * r;
    },
    reset() { cx = from[0]; cz = from[1]; },
  };
}

// ---------------------------------------------------------------- Cannon
function makeCannon(def) {
  const { pos, dir, period, speed, offset, range } = def;
  const [x, z] = pos;
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const dx = dir[0] / len, dz = dir[1] / len;

  const group = new THREE.Group();
  // barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.4, 12), mat(COL.purple, 1.2));
  barrel.position.set(x, FLOOR + 0.7, z);
  barrel.rotation.z = Math.PI / 2;
  barrel.rotation.y = Math.atan2(dx, dz);
  group.add(barrel);

  const bulletR = 0.45;
  const bullets = []; // {x,z,life}
  const meshes = [];  // reuse pool
  const pool = [];

  const rnd = def.random;       // truthy -> randomize fire interval + bullet speed
  let lastFire = -1e9;
  let nextGap = period;         // time until the next shot (re-rolled each fire)
  let fireSeed = 0;

  function getMesh() {
    let m = pool.pop();
    if (!m) {
      m = new THREE.Mesh(new THREE.SphereGeometry(bulletR, 12, 12), mat(COL.magenta, 1.8));
      group.add(m);
    }
    m.visible = true;
    return m;
  }

  return {
    group,
    update(dt, time) {
      // fire on schedule. With randomness, the gap and the bullet speed vary shot to shot.
      const due = rnd
        ? (time - lastFire >= nextGap)
        : (() => { const phase = (((time + offset) % period) + period) % period; return phase < dt && time - lastFire > period * 0.5; })();
      if (due && time > 0.05) {
        lastFire = time;
        if (rnd) {
          fireSeed++;
          nextGap = period * (0.7 + 0.9 * hash01(fireSeed * 3.7 + x + z)); // 0.7x .. 1.6x
        }
        const m = getMesh();
        const bSpeed = rnd ? speed * (0.8 + 0.6 * hash01(fireSeed * 9.1 + 0.3)) : speed; // 0.8x .. 1.4x
        const b = { x, z, dist: 0, mesh: m, sp: bSpeed };
        m.position.set(x + dx * 0.8, FLOOR + 0.7, z + dz * 0.8);
        bullets.push(b);
      }
      // move bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        const sp = b.sp || speed;
        b.x += dx * sp * dt;
        b.z += dz * sp * dt;
        b.dist += sp * dt;
        b.mesh.position.set(b.x, FLOOR + 0.7, b.z);
        if (b.dist > range) {
          b.mesh.visible = false;
          pool.push(b.mesh);
          bullets.splice(i, 1);
        }
      }
    },
    hits(p, r) {
      const rr = (r + bulletR) * (r + bulletR);
      for (const b of bullets) {
        const ddx = p.x - b.x, ddz = p.z - b.z, ddy = p.y - (FLOOR + 0.7);
        if (ddx * ddx + ddz * ddz + ddy * ddy < rr) return true;
      }
      return false;
    },
    reset() {
      for (const b of bullets) { b.mesh.visible = false; pool.push(b.mesh); }
      bullets.length = 0;
      lastFire = -1e9;
      nextGap = period;
      fireSeed = 0;
    },
  };
}

// ---------------------------------------------------------------- Chasing chainsaw
function makeSaw(def) {
  const { start, speed, size } = def;
  const half = size / 2;
  const group = new THREE.Group();
  group.position.set(start[0], FLOOR + half, start[1]);

  // saw blade: a flat disc + ring of teeth, glowing red
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(half, half, 0.35, 24), mat(COL.red, 1.7));
  blade.rotation.x = Math.PI / 2;
  group.add(blade);
  const teeth = new THREE.Group();
  const n = 12;
  for (let i = 0; i < n; i++) {
    const tooth = spikeCone(COL.yellow, 0.5, 0.18);
    const a = (i / n) * Math.PI * 2;
    tooth.position.set(Math.cos(a) * half, 0, Math.sin(a) * half);
    tooth.rotation.z = -a + Math.PI / 2;
    teeth.add(tooth);
  }
  teeth.rotation.x = Math.PI / 2;
  group.add(teeth);

  let cx = start[0], cz = start[1];

  return {
    group,
    update(dt, time, marblePos) {
      // home toward the marble on the x-z plane. Speed pulses gently over time so
      // it sometimes surges (adds pressure) and sometimes eases — never stops.
      if (marblePos) {
        const dx = marblePos.x - cx, dz = marblePos.z - cz;
        const dlen = Math.hypot(dx, dz);
        if (dlen > 1e-3) {
          // 0.85x .. 1.25x smooth speed pulse via layered sines (deterministic)
          const pulse = 1.05 + 0.2 * Math.sin(time * 1.7) * Math.cos(time * 0.6 + 1.1);
          const step = Math.min(speed * pulse * dt, dlen);
          cx += (dx / dlen) * step;
          cz += (dz / dlen) * step;
        }
      }
      group.position.set(cx, FLOOR + half, cz);
      group.rotation.y += dt * 14;
    },
    hits(p, r) {
      const dx = p.x - cx, dz = p.z - cz;
      return dx * dx + dz * dz < (half * 0.85 + r) * (half * 0.85 + r);
    },
    reset() { cx = start[0]; cz = start[1]; group.position.set(cx, FLOOR + half, cz); },
  };
}

// ---------------------------------------------------------------- factory
export function makeTrap(def) {
  switch (def.type) {
    case "axis": return makeAxis(def);
    case "spears": return makeSpears(def);
    case "spikecube": return makeCube(def);
    case "cannon": return makeCannon(def);
    case "chainsaw": return makeSaw(def);
    default: console.warn("unknown trap", def.type); return null;
  }
}
