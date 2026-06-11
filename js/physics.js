// Marble physics: gravity + momentum + friction, sphere-vs-box collision against
// platforms, pit-trap timing, and falling-into-the-void detection.
// Kept custom (no engine) so level difficulty is precisely tunable.

import * as THREE from "three";

export const MARBLE_RADIUS = 0.6;

// Tuning constants (units are world-units and seconds).
const GRAVITY = 28;       // softer gravity (was 42) — marble feels weightier, less floaty
const ACCEL = 28;         // slow initial acceleration (was 70) — builds up like a real ball
const AIR_ACCEL = 8;      // weaker air control (was 22)
const MAX_SPEED = 12;     // slightly lower top speed (was 15)
const GROUND_DAMP = 1.4;  // gentler braking (was 2.2) — momentum carries more
const AIR_DAMP = 0.05;    // almost no air drag (was 0.15) — ball arcs naturally

// Returns true if a pit-trap platform is solid right now (false = gap is open).
export function platformSolid(p, time) {
  if (!p.drop) return true;
  const { period, down, offset } = p.drop;
  const t = ((time + offset) % period + period) % period;
  return t >= down; // open (deadly) for the first `down` seconds of each cycle
}

// Visual y-offset for a dropping pit tile (so it visibly sinks when open).
export function platformDropY(p, time) {
  if (!p.drop) return 0;
  return platformSolid(p, time) ? 0 : -6;
}

// One physics step. Mutates `m` (the marble state: {pos:Vector3, vel:Vector3, grounded}).
// `move` is {x,z} in [-1,1] from input. Returns { fell:boolean }.
export function stepMarble(m, move, platforms, time, dt) {
  // ---- horizontal input -> acceleration ----
  const a = m.grounded ? ACCEL : AIR_ACCEL;
  m.vel.x += move.x * a * dt;
  m.vel.z += move.z * a * dt;

  // ---- friction / drag ----
  const noInput = move.x === 0 && move.z === 0;
  if (m.grounded && noInput) {
    const damp = Math.exp(-GROUND_DAMP * dt);
    m.vel.x *= damp;
    m.vel.z *= damp;
  } else if (!m.grounded) {
    const damp = Math.exp(-AIR_DAMP * dt);
    m.vel.x *= damp;
    m.vel.z *= damp;
  }

  // ---- cap horizontal speed ----
  const hs = Math.hypot(m.vel.x, m.vel.z);
  if (hs > MAX_SPEED) {
    const s = MAX_SPEED / hs;
    m.vel.x *= s;
    m.vel.z *= s;
  }

  // ---- gravity ----
  m.vel.y -= GRAVITY * dt;

  // ---- integrate ----
  m.pos.x += m.vel.x * dt;
  m.pos.y += m.vel.y * dt;
  m.pos.z += m.vel.z * dt;

  // ---- collide against platforms (sphere vs AABB), resolve penetration ----
  m.grounded = false;
  const r = MARBLE_RADIUS;
  for (const p of platforms) {
    if (!platformSolid(p, time)) continue;

    const [cx, cy, cz] = p.pos;
    const [sx, sy, sz] = p.size;
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;

    // closest point on the box to the sphere center
    const qx = Math.max(cx - hx, Math.min(m.pos.x, cx + hx));
    const qy = Math.max(cy - hy, Math.min(m.pos.y, cy + hy));
    const qz = Math.max(cz - hz, Math.min(m.pos.z, cz + hz));

    let nx = m.pos.x - qx;
    let ny = m.pos.y - qy;
    let nz = m.pos.z - qz;
    let d2 = nx * nx + ny * ny + nz * nz;

    if (d2 < r * r) {
      let d = Math.sqrt(d2);
      if (d > 1e-6) {
        // push out along the surface normal
        const push = (r - d) / d;
        m.pos.x += nx * push;
        m.pos.y += ny * push;
        m.pos.z += nz * push;
        nx /= d; ny /= d; nz /= d;
      } else {
        // center inside the box — push straight up (typical for resting)
        m.pos.y = cy + hy + r;
        ny = 1; nx = 0; nz = 0;
      }
      // kill the velocity component into the surface
      const vn = m.vel.x * nx + m.vel.y * ny + m.vel.z * nz;
      if (vn < 0) {
        m.vel.x -= vn * nx;
        m.vel.y -= vn * ny;
        m.vel.z -= vn * nz;
      }
      if (ny > 0.5) m.grounded = true; // landed on a top surface
    }
  }

  // rolling spin is purely visual — handled in main.js from velocity.
  return { fell: m.pos.y < -8 || m.pos.y < (m.killY ?? -12) };
}

// Convenience: make a fresh marble state at a spawn position.
export function makeMarble(start, killY) {
  return {
    pos: new THREE.Vector3(start[0], start[1], start[2]),
    vel: new THREE.Vector3(0, 0, 0),
    grounded: false,
    killY,
  };
}
