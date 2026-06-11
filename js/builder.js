// Builds the visible 3D world for a level: neon platforms (with glowing edges),
// the finish gate, the marble, and the synthwave environment (grid + sun).

import * as THREE from "three";
import { MARBLE_RADIUS } from "./physics.js";

const COL = {
  magenta: 0xf07030,  // warm orange (replaces eye-searing magenta)
  cyan:    0x4a9eff,  // soft electric blue (replaces blinding cyan)
  purple:  0x8855dd,  // muted violet
  yellow:  0xffd966,  // soft gold
  deep:    0x0c1020,  // dark navy
};

function neon(color, intensity = 1.0) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    metalness: 0.2,
    roughness: 0.5,
  });
}

// Build all platform meshes. Pit-trap tiles get a reference back to their def so
// main.js can sink them visually when the gap opens.
//
// Graphics notes (fixing the "glitchy stripes"):
//  - The dark stripe artifacts were z-fighting: adjacent tiles share an exact
//    boundary plane at the same Y, so their top faces and edge lines overlapped.
//  - Fix: the solid body sits slightly BELOW y=0 (top face at y=0), and the glowing
//    surface is a single thin plane rendered with polygonOffset so it never fights
//    the body. Edge frames use a tube-like inset so neighboring tiles don't overlap.
export function buildPlatforms(level) {
  const group = new THREE.Group();
  const pitTiles = [];

  for (const p of level.platforms) {
    const [w, h, d] = p.size;
    const tile = new THREE.Group();
    tile.position.set(p.pos[0], p.pos[1], p.pos[2]);

    const isPit = !!p.drop;
    const edgeCol = isPit ? COL.magenta : COL.cyan;

    // solid body (slightly shrunk in X/Z so adjacent tiles never share a face)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.04, h, d - 0.04),
      new THREE.MeshStandardMaterial({
        color: isPit ? 0x2a0a26 : 0x0c0526,
        emissive: new THREE.Color(isPit ? 0x3a0a28 : 0x0a0322),
        emissiveIntensity: 0.5,
        metalness: 0.4,
        roughness: 0.55,
      })
    );
    tile.add(body);

    // glowing top surface: one flat plane just above the body's top face.
    // polygonOffset pushes it in depth so it can't z-fight with the body.
    const surfMat = new THREE.MeshStandardMaterial({
      color: isPit ? 0x6a1540 : 0x10204a,
      emissive: new THREE.Color(edgeCol),
      emissiveIntensity: isPit ? 0.18 : 0.12,
      metalness: 0.3,
      roughness: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.08, d - 0.08), surfMat);
    surf.rotation.x = -Math.PI / 2;
    surf.position.y = h / 2 + 0.012;
    tile.add(surf);

    // bright neon border framing the surface (4 thin glowing bars, inset)
    const bw = 0.12;                  // bar thickness
    const inset = 0.04;
    const yTop = h / 2 + 0.02;
    const barMat = neon(edgeCol, 0.9);
    const addBar = (bx, bz, lx, lz) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(lx, 0.08, lz), barMat);
      bar.position.set(bx, yTop, bz);
      tile.add(bar);
    };
    const innerW = w - inset * 2, innerD = d - inset * 2;
    addBar(0, innerD / 2 - bw / 2, innerW, bw);   // far edge
    addBar(0, -innerD / 2 + bw / 2, innerW, bw);  // near edge
    addBar(innerW / 2 - bw / 2, 0, bw, innerD);   // right edge
    addBar(-innerW / 2 + bw / 2, 0, bw, innerD);  // left edge

    group.add(tile);
    if (isPit) pitTiles.push({ def: p, mesh: tile });
  }

  return { group, pitTiles };
}

// The finish gate: a glowing ring/pad you roll into.
export function buildFinish(level) {
  const group = new THREE.Group();
  const [x, , z] = level.finish;
  group.position.set(x, 0, z);

  // big glowing landing disc you roll onto
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 0.2, 36),
    neon(COL.yellow, 1.7)
  );
  pad.position.y = 0.12;
  group.add(pad);

  // a bright ring around the disc so it reads as the goal from far away
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.7, 0.18, 12, 40),
    neon(COL.cyan, 2.2)
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.2;
  group.add(ring);

  // two tall glowing posts + a double arch (a clear gateway)
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, 4.2, 0.34), neon(COL.cyan, 1.9));
    post.position.set(s * 2.6, 2.1, 0);
    group.add(post);
  }
  for (const ay of [4.0, 4.6]) {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.3, 0.3), neon(COL.magenta, 1.9));
    arch.position.y = ay;
    group.add(arch);
  }

  // a strong point light so the goal glows as "the destination"
  const light = new THREE.PointLight(COL.yellow, 26, 22, 2);
  light.position.set(0, 2.5, 0);
  group.add(light);

  group.userData.spin = pad;
  return group;
}

// The player's marble — emissive so it glows, with a wireframe overlay so spin reads.
export function buildMarble() {
  const group = new THREE.Group();

  // glossy chrome-neon core
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(MARBLE_RADIUS, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0xeaffff,
      emissive: new THREE.Color(COL.cyan),
      emissiveIntensity: 0.55,
      metalness: 0.85,
      roughness: 0.12,
    })
  );
  group.add(ball);

  // a couple of clean banding rings (read spin without the noisy full wireframe)
  const ringMat = new THREE.MeshBasicMaterial({ color: COL.magenta });
  for (const rot of [0, Math.PI / 2]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(MARBLE_RADIUS * 1.004, 0.035, 8, 40),
      ringMat
    );
    ring.rotation.y = rot;
    group.add(ring);
  }

  const glow = new THREE.PointLight(COL.cyan, 9, 9, 2);
  group.add(glow);

  // meshes that should visibly roll (the point light should NOT)
  group.userData.spin = [ball, ...group.children.filter((c) => c.geometry?.type === "TorusGeometry")];
  return group;
}

// The synthwave backdrop: ground grid, horizon sun, and fog. Added once, reused.
export function buildEnvironment(scene) {
  scene.fog = new THREE.Fog(0x0a0420, 34, 130);

  // big neon grid far below the track (deep enough that it never overlaps the path)
  const grid = new THREE.GridHelper(600, 120, COL.magenta, COL.purple);
  grid.position.y = -14;
  grid.material.opacity = 0.28;
  grid.material.transparent = true;
  grid.material.depthWrite = false;
  scene.add(grid);

  // a second grid for depth
  const grid2 = new THREE.GridHelper(600, 60, COL.cyan, 0x220044);
  grid2.position.y = -14.06;
  grid2.material.opacity = 0.15;
  grid2.material.transparent = true;
  grid2.material.depthWrite = false;
  scene.add(grid2);


  // ambient + key light so standard materials are visible
  scene.add(new THREE.AmbientLight(0x6644aa, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(10, 30, 10);
  scene.add(key);

  return { grid, grid2 };
}

// ---------------------------------------------------------------- Juice: particles
// A pooled additive point cloud for death/win bursts. burst() spawns, update() ages.
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
// A fading additive streak that follows the marble.
export function makeTrail(scene, len = 24, colorHex = COL.cyan) {
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
