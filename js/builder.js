// Builds the visible 3D world: platforms (grass top / dirt sides), finish gate,
// marble, and environment. Visual style matches Marble Trap — clean low-poly,
// bright daylight, no neon glow or bloom.

import * as THREE from "three";
import { MARBLE_RADIUS } from "./physics.js";

// Flat Lambert material — fast, no bloom bleed, matches Marble Trap's look
function flat(color) {
  return new THREE.MeshLambertMaterial({ color });
}

const COL = {
  grass:      0x5aab3c,
  grass_dark: 0x4a9230,
  grass_pit:  0xc0783a,  // reddish-brown top on pit tiles (danger signal)
  dirt:       0x8B5E3C,
  dirt_dark:  0x6b4423,
  white:      0xffffff,
  finish_grn: 0x3dbb3d,
  finish_yel: 0xffd700,
  trap_body:  0x333344,
  trap_spike: 0x888899,
  marble_whi: 0xffffff,
  marble_blu: 0x3a7fd5,
  marble_red: 0xdd2222,
};

// Build all platform meshes.
export function buildPlatforms(level) {
  const group = new THREE.Group();
  const pitTiles = [];

  // shared materials (reused across all tiles for draw-call efficiency)
  const matGrass     = flat(COL.grass);
  const matGrassDark = flat(COL.grass_dark);
  const matGrassPit  = flat(COL.grass_pit);
  const matDirt      = flat(COL.dirt);
  const matDirtDark  = flat(COL.dirt_dark);

  for (const p of level.platforms) {
    const [w, h, d] = p.size;
    const tile = new THREE.Group();
    tile.position.set(p.pos[0], p.pos[1], p.pos[2]);

    const isPit = !!p.drop;

    // --- sides: one box the full size, using dirt material ---
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.04, h, d - 0.04),
      isPit ? matDirtDark : matDirt
    );
    tile.add(body);

    // --- top: checkerboard of small quads ---
    const cols = Math.max(1, Math.round(w));
    const rows = Math.max(1, Math.round(d));
    const cw = w / cols, cr = d / rows;
    const topMat0 = isPit ? matGrassPit : matGrass;
    const topMat1 = isPit ? flat(0xa06030) : matGrassDark;
    const yTop = h / 2 + 0.005;

    for (let ci = 0; ci < cols; ci++) {
      for (let ri = 0; ri < rows; ri++) {
        const m = (ci + ri) % 2 === 0 ? topMat0 : topMat1;
        const sq = new THREE.Mesh(new THREE.PlaneGeometry(cw - 0.02, cr - 0.02), m);
        sq.rotation.x = -Math.PI / 2;
        sq.position.set(
          -w / 2 + (ci + 0.5) * cw,
          yTop,
          -d / 2 + (ri + 0.5) * cr
        );
        tile.add(sq);
      }
    }

    group.add(tile);
    if (isPit) pitTiles.push({ def: p, mesh: tile });
  }

  return { group, pitTiles };
}

// The finish gate: a bright flag-style goal marker.
export function buildFinish(level) {
  const group = new THREE.Group();
  const [x, , z] = level.finish;
  group.position.set(x, 0, z);

  // spinning green pad
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 0.22, 36),
    flat(COL.finish_grn)
  );
  pad.position.y = 0.12;
  group.add(pad);

  // yellow ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.7, 0.2, 12, 40),
    flat(COL.finish_yel)
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.22;
  group.add(ring);

  // two white posts
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 4.4, 0.34),
      flat(COL.white)
    );
    post.position.set(s * 2.6, 2.2, 0);
    group.add(post);
  }

  // yellow arch beams
  for (const ay of [4.1, 4.7]) {
    const arch = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.3, 0.3),
      flat(COL.finish_yel)
    );
    arch.position.y = ay;
    group.add(arch);
  }

  // soft point light so the goal is readable at a distance
  const light = new THREE.PointLight(0xffd700, 6, 18, 2);
  light.position.set(0, 2.5, 0);
  group.add(light);

  group.userData.spin = pad;
  return group;
}

// The player's marble — Marble Trap style: white with blue and red stripes.
export function buildMarble() {
  const group = new THREE.Group();

  // white base sphere
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(MARBLE_RADIUS, 28, 28),
    new THREE.MeshStandardMaterial({
      color: COL.marble_whi,
      metalness: 0.05,
      roughness: 0.35,
    })
  );
  group.add(ball);

  // blue equatorial band
  const blue = new THREE.Mesh(
    new THREE.TorusGeometry(MARBLE_RADIUS * 1.002, MARBLE_RADIUS * 0.32, 8, 36),
    new THREE.MeshLambertMaterial({ color: COL.marble_blu })
  );
  group.add(blue);

  // red stripe (tilted 45°)
  const red = new THREE.Mesh(
    new THREE.TorusGeometry(MARBLE_RADIUS * 1.002, MARBLE_RADIUS * 0.13, 8, 36),
    new THREE.MeshLambertMaterial({ color: COL.marble_red })
  );
  red.rotation.z = Math.PI / 4;
  group.add(red);

  // meshes that should visibly roll
  group.userData.spin = [ball, blue, red];
  return group;
}

// Daylight environment — bright sky, sun, directional light. No neon, no fog.
export function buildEnvironment(scene) {
  // clear sky background
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = null;

  // bright daylight: strong ambient + angled sun
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xfff5e0, 1.3);
  sun.position.set(12, 28, 14);
  scene.add(sun);

  // soft fill from the opposite side (avoids pitch-black shadows)
  const fill = new THREE.DirectionalLight(0xc8dff0, 0.35);
  fill.position.set(-8, 10, -6);
  scene.add(fill);

  return {};
}

// ---------------------------------------------------------------- Juice: particles
export function makeParticles(scene, max = 180) {
  const positions = new Float32Array(max * 3);
  const colors = new Float32Array(max * 3);
  for (let i = 0; i < max; i++) positions[i * 3 + 1] = -9999;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.45, vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);

  const P = [];
  for (let i = 0; i < max; i++) P.push({ life: 0, max: 1, x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, r: 0, g: 0, b: 0 });
  let cursor = 0;

  return {
    object: pts,
    burst(pos, colorHex, count = 46, spd = 9) {
      const c = new THREE.Color(colorHex);
      for (let n = 0; n < count; n++) {
        const p = P[cursor]; cursor = (cursor + 1) % max;
        const a = Math.random() * Math.PI * 2;
        const el = Math.random() * Math.PI - Math.PI / 2;
        const v = spd * (0.4 + Math.random() * 0.9);
        p.x = pos.x; p.y = pos.y; p.z = pos.z;
        p.vx = Math.cos(a) * Math.cos(el) * v;
        p.vy = Math.sin(el) * v + 4;
        p.vz = Math.sin(a) * Math.cos(el) * v;
        p.max = 0.5 + Math.random() * 0.6; p.life = p.max;
        p.r = c.r; p.g = c.g; p.b = c.b;
      }
    },
    update(dt) {
      for (let i = 0; i < max; i++) {
        const p = P[i];
        if (p.life > 0) {
          p.life -= dt;
          p.vy -= 24 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          const f = Math.max(0, p.life / p.max);
          positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
          colors[i * 3] = p.r * f; colors[i * 3 + 1] = p.g * f; colors[i * 3 + 2] = p.b * f;
        } else if (positions[i * 3 + 1] !== -9999) {
          positions[i * 3 + 1] = -9999;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- Juice: marble trail
export function makeTrail(scene, len = 24, colorHex = 0xffffff) {
  const positions = new Float32Array(len * 3);
  const colors = new Float32Array(len * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  scene.add(line);
  const c = new THREE.Color(colorHex);
  const pts = [];
  let inited = false;

  return {
    object: line,
    reset(pos) { pts.length = 0; for (let i = 0; i < len; i++) pts.push({ x: pos.x, y: pos.y, z: pos.z }); inited = true; },
    update(pos) {
      if (!inited) this.reset(pos);
      pts.unshift({ x: pos.x, y: pos.y, z: pos.z }); pts.pop();
      for (let i = 0; i < len; i++) {
        positions[i * 3] = pts[i].x; positions[i * 3 + 1] = pts[i].y; positions[i * 3 + 2] = pts[i].z;
        const f = (1 - i / len) * 0.9;
        colors[i * 3] = c.r * f; colors[i * 3 + 1] = c.g * f; colors[i * 3 + 2] = c.b * f;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    hide() { for (let i = 0; i < len; i++) positions[i * 3 + 1] = -9999; geo.attributes.position.needsUpdate = true; inited = false; },
  };
}
