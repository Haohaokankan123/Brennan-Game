// Builds the visible 3D world for a level: neon platforms (with glowing edges),
// the finish gate, the marble, and the synthwave environment (grid + sun).

import * as THREE from "three";
import { MARBLE_RADIUS } from "./physics.js";

const COL = {
  magenta: 0xff2e88,
  cyan: 0x00f0ff,
  purple: 0xb24bff,
  yellow: 0xffe66d,
  deep: 0x1a0a3a,
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
export function buildPlatforms(level) {
  const group = new THREE.Group();
  const pitTiles = [];

  for (const p of level.platforms) {
    const [w, h, d] = p.size;
    const tile = new THREE.Group();
    tile.position.set(p.pos[0], p.pos[1], p.pos[2]);

    // solid dark top
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color: p.drop ? 0x3a1330 : COL.deep,
        emissive: new THREE.Color(p.drop ? 0x551133 : 0x140428),
        emissiveIntensity: 0.6,
        metalness: 0.3,
        roughness: 0.6,
      })
    );
    tile.add(top);

    // glowing neon edge frame around the top surface
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
      new THREE.LineBasicMaterial({ color: p.drop ? COL.magenta : COL.cyan })
    );
    tile.add(edges);

    group.add(tile);
    if (p.drop) pitTiles.push({ def: p, mesh: tile });
  }

  return { group, pitTiles };
}

// The finish gate: a glowing ring/pad you roll into.
export function buildFinish(level) {
  const group = new THREE.Group();
  const [x, , z] = level.finish;
  group.position.set(x, 0, z);

  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 0.2, 28),
    neon(COL.yellow, 1.6)
  );
  pad.position.y = 0.11;
  group.add(pad);

  // two glowing posts + arch
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), neon(COL.cyan, 1.8));
    post.position.set(s * 1.5, 1.5, 0);
    group.add(post);
  }
  const arch = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.3, 0.3), neon(COL.magenta, 1.8));
  arch.position.y = 3;
  group.add(arch);

  // a soft point light so the goal reads as "the destination"
  const light = new THREE.PointLight(COL.yellow, 18, 16, 2);
  light.position.set(0, 2, 0);
  group.add(light);

  group.userData.spin = pad;
  return group;
}

// The player's marble — emissive so it glows, with a wireframe overlay so spin reads.
export function buildMarble() {
  const group = new THREE.Group();
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(MARBLE_RADIUS, 28, 28),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(COL.cyan),
      emissiveIntensity: 0.9,
      metalness: 0.6,
      roughness: 0.15,
    })
  );
  group.add(ball);

  const wire = new THREE.Mesh(
    new THREE.SphereGeometry(MARBLE_RADIUS * 1.02, 12, 8),
    new THREE.MeshBasicMaterial({ color: COL.magenta, wireframe: true })
  );
  group.add(wire);

  const glow = new THREE.PointLight(COL.cyan, 12, 10, 2);
  group.add(glow);

  // meshes that should visibly roll (the point light should NOT)
  group.userData.spin = [ball, wire];
  return group;
}

// The synthwave backdrop: ground grid, horizon sun, and fog. Added once, reused.
export function buildEnvironment(scene) {
  scene.fog = new THREE.Fog(0x0a0420, 30, 120);

  // big neon grid far below the track
  const grid = new THREE.GridHelper(400, 100, COL.magenta, COL.purple);
  grid.position.y = -12;
  grid.material.opacity = 0.35;
  grid.material.transparent = true;
  scene.add(grid);

  // a second grid for depth
  const grid2 = new THREE.GridHelper(400, 50, COL.cyan, 0x220044);
  grid2.position.y = -12.05;
  grid2.material.opacity = 0.2;
  grid2.material.transparent = true;
  scene.add(grid2);

  // glowing "sun" on the horizon
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(40, 48),
    new THREE.MeshBasicMaterial({ color: 0xff5fa2 })
  );
  sun.position.set(0, 8, -160);
  scene.add(sun);
  const sun2 = new THREE.Mesh(
    new THREE.CircleGeometry(55, 48),
    new THREE.MeshBasicMaterial({ color: 0x6a1f6a, transparent: true, opacity: 0.4 })
  );
  sun2.position.set(0, 8, -161);
  scene.add(sun2);

  // ambient + key light so standard materials are visible
  scene.add(new THREE.AmbientLight(0x6644aa, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(10, 30, 10);
  scene.add(key);

  return { grid, grid2 };
}
