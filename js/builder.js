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
  tuft:       0x6fc24a,  // bright grass tuft
  tuft_dark:  0x4f9a32,
  gem:        0x39e0ff,  // cyan collectible gem
  gem_core:   0xffffff,
  boost:      0xffd23d,  // yellow speed pad
  boost_edge: 0xff8a1e,
  ramp:       0xb0b6c4,  // light gray launch ramp
  ramp_edge:  0xffd23d,
  cloud:      0xffffff,
  island_grass: 0x57b23e,
  island_dirt:  0x9a6a3c,
  sea:        0x1fb6c8,  // deep turquoise water
  sea_lo:     0x179aae,  // trough shade
  foam:       0xffffff,  // whitecap
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
  const matTuft      = flat(COL.tuft);
  const matTuftDark  = flat(COL.tuft_dark);
  const tuftGeo      = new THREE.ConeGeometry(0.16, 0.6, 5);

  // deterministic [0,1) hash so tufts are placed the same way every load
  const h01 = (n) => { const s = Math.sin(n * 91.7 + 13.3) * 43758.5; return s - Math.floor(s); };

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

    // --- grass tufts: small decorative blades scattered on solid grass tops ---
    if (!isPit) {
      const area = w * d;
      const n = Math.min(10, Math.floor(area / 26));
      for (let t = 0; t < n; t++) {
        const seed = p.pos[0] * 7.1 + p.pos[2] * 3.7 + t * 17.3;
        const gx = (h01(seed) - 0.5) * (w - 1.2);
        const gz = (h01(seed + 5.5) - 0.5) * (d - 1.2);
        const tuft = new THREE.Mesh(tuftGeo, h01(seed + 9.9) > 0.5 ? matTuft : matTuftDark);
        const sc = 0.7 + h01(seed + 2.2) * 0.7;
        tuft.scale.set(sc, sc, sc);
        tuft.position.set(gx, yTop + 0.3 * sc, gz);
        tuft.rotation.y = h01(seed + 3.3) * Math.PI;
        tile.add(tuft);
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

// Daylight environment — bright sky, sun, light, animated ocean, clouds, islands.
// Returns an `env` object with update(dt) that THRASHES the ocean + drifts clouds
// every frame (called from the main loop in all states). No neon, no fog, no bloom.
export function buildEnvironment(scene) {
  // turquoise sky fallback (stays in sync with CSS --bg + renderer.setClearColor)
  scene.background = new THREE.Color(0x29bfbf);
  scene.fog = null;

  // bright daylight: strong ambient + angled sun
  scene.add(new THREE.AmbientLight(0xffffff, 0.78));
  const sun = new THREE.DirectionalLight(0xfff5e0, 1.25);
  sun.position.set(12, 28, 14);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc8dff0, 0.35);
  fill.position.set(-8, 10, -6);
  scene.add(fill);

  // ---------------------------------------------------------- animated ocean
  const SEA_Y = -18;                 // water sits far below the track
  const SEG = 80;                    // grid resolution (SEG x SEG quads)
  const SIZE = 1600;
  const oceanGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  oceanGeo.rotateX(-Math.PI / 2);    // lie flat (normals point +Y)
  const pos = oceanGeo.attributes.position;
  const baseX = new Float32Array(pos.count);
  const baseZ = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { baseX[i] = pos.getX(i); baseZ[i] = pos.getZ(i); }
  // per-vertex colour: turquoise body, white foam on the crests
  const colCount = pos.count * 3;
  const oceanColors = new Float32Array(colCount);
  oceanGeo.setAttribute("color", new THREE.BufferAttribute(oceanColors, 3));
  const seaCol = new THREE.Color(COL.sea), seaLo = new THREE.Color(COL.sea_lo), foamCol = new THREE.Color(COL.foam);
  const ocean = new THREE.Mesh(
    oceanGeo,
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
  );
  ocean.position.y = SEA_Y;
  ocean.frustumCulled = false;
  scene.add(ocean);

  // ---------------------------------------------------------- drifting clouds
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshLambertMaterial({ color: COL.cloud, transparent: true, opacity: 0.92 });
  const ch = (n) => { const s = Math.sin(n * 53.7 + 7.1) * 9281.3; return s - Math.floor(s); };
  for (let i = 0; i < 16; i++) {
    const puff = new THREE.Group();
    const blobs = 3 + Math.floor(ch(i) * 3);
    for (let b = 0; b < blobs; b++) {
      const r = 3 + ch(i * 3 + b) * 4;
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), cloudMat);
      s.position.set((ch(i + b) - 0.5) * 14, (ch(i * 2 + b) - 0.5) * 3, (ch(i * 5 + b) - 0.5) * 8);
      s.scale.y = 0.6;
      puff.add(s);
    }
    puff.position.set((ch(i) - 0.5) * 460, 48 + ch(i * 7) * 36, -60 - ch(i * 9) * 420);
    puff.userData.speed = 2 + ch(i * 11) * 3;
    clouds.add(puff);
  }
  scene.add(clouds);

  // ---------------------------------------------------------- distant islands
  const islands = new THREE.Group();
  const grassMat = new THREE.MeshLambertMaterial({ color: COL.island_grass });
  const dirtMat = new THREE.MeshLambertMaterial({ color: COL.island_dirt });
  const ih = (n) => { const s = Math.sin(n * 71.3 + 19.7) * 3771.9; return s - Math.floor(s); };
  for (let i = 0; i < 10; i++) {
    const isle = new THREE.Group();
    const r = 8 + ih(i) * 16;
    const base = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.3, 7), dirtMat);
    base.position.y = -r * 0.2;
    isle.add(base);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), grassMat);
    cap.position.y = r * 0.34;
    isle.add(cap);
    const ang = (i / 10) * Math.PI * 2 + ih(i * 2);
    const dist = 230 + ih(i * 3) * 180;
    isle.position.set(Math.cos(ang) * dist, SEA_Y + r * 0.6, -120 + Math.sin(ang) * dist);
    islands.add(isle);
  }
  scene.add(islands);

  let t = 0;
  return {
    ocean, clouds, islands,
    update(dt) {
      t += dt;
      // ---- ocean: layered sine vertex displacement + foam colouring ----
      for (let i = 0; i < pos.count; i++) {
        const x = baseX[i], z = baseZ[i];
        const h =
          Math.sin(x * 0.045 + t * 1.6) * 1.5 +
          Math.cos(z * 0.05 + t * 1.2) * 1.5 +
          Math.sin((x + z) * 0.08 + t * 2.3) * 0.8;
        pos.setY(i, h);
        const f = Math.min(1, Math.max(0, (h + 1.3) / 3.8)); // crest factor
        const c = seaLo.clone().lerp(seaCol, Math.min(1, f * 1.5));
        if (f > 0.78) c.lerp(foamCol, (f - 0.78) / 0.22); // whitecaps on the peaks
        oceanColors[i * 3] = c.r; oceanColors[i * 3 + 1] = c.g; oceanColors[i * 3 + 2] = c.b;
      }
      pos.needsUpdate = true;
      oceanGeo.attributes.color.needsUpdate = true;
      oceanGeo.computeVertexNormals();
      // ---- clouds drift along +X and wrap ----
      for (const puff of clouds.children) {
        puff.position.x += puff.userData.speed * dt;
        if (puff.position.x > 320) puff.position.x = -320;
      }
    },
  };
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

// ---------------------------------------------------------------- Collectible gems
// Returns { group, items:[{pos:[x,y,z], mesh}] }. World handles collect + spin/bob.
export function buildGems(level) {
  const group = new THREE.Group();
  const items = [];
  const gemGeo = new THREE.OctahedronGeometry(0.55, 0);
  const coreGeo = new THREE.OctahedronGeometry(0.24, 0);
  for (const g of level.gems || []) {
    const mesh = new THREE.Group();
    const shell = new THREE.Mesh(gemGeo, new THREE.MeshLambertMaterial({
      color: COL.gem, transparent: true, opacity: 0.85, emissive: new THREE.Color(COL.gem), emissiveIntensity: 0.25,
    }));
    const core = new THREE.Mesh(coreGeo, flat(COL.gem_core));
    mesh.add(shell); mesh.add(core);
    mesh.position.set(g[0], g[1], g[2]);
    group.add(mesh);
    items.push({ pos: [g[0], g[1], g[2]], mesh, baseY: g[1] });
  }
  return { group, items };
}

// ---------------------------------------------------------------- Boost pads
// Flat glowing chevron pad that surges the marble along `dir`.
export function buildBoostPads(level) {
  const group = new THREE.Group();
  const items = [];
  for (const b of level.boosts || []) {
    const pad = new THREE.Group();
    const [x, z] = b.pos, [dx, dz] = b.dir;
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 3.4), flat(COL.boost_edge));
    base.position.y = 0.06;
    pad.add(base);
    // three forward chevrons
    for (let i = 0; i < 3; i++) {
      const chev = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.5), flat(COL.boost));
      chev.position.set(0, 0.14, -0.9 + i * 0.9);
      pad.add(chev);
    }
    pad.position.set(x, 0.02, z);
    pad.rotation.y = Math.atan2(dx, dz); // point chevrons along travel dir
    pad.userData.spinY = 0;
    group.add(pad);
    items.push({ def: b, mesh: pad });
  }
  return { group, items };
}

// ---------------------------------------------------------------- Jump ramps
// A wedge the marble visibly rolls up; the launch impulse is applied in physics.
export function buildRamps(level) {
  const group = new THREE.Group();
  const items = [];
  for (const r of level.ramps || []) {
    const [x, z] = r.pos, [dx, dz] = r.dir;
    const ramp = new THREE.Group();
    // wedge = a box tilted so its leading edge is low, trailing edge high
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.4, 3.4), flat(COL.ramp));
    wedge.rotation.x = -0.5;
    wedge.position.y = 0.7;
    ramp.add(wedge);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.4), flat(COL.ramp_edge));
    lip.position.set(0, 1.35, -1.5);
    ramp.add(lip);
    ramp.position.set(x, 0, z);
    ramp.rotation.y = Math.atan2(dx, dz);
    group.add(ramp);
    items.push({ def: r, mesh: ramp });
  }
  return { group, items };
}

// ---------------------------------------------------------------- Ghost marble
// A translucent copy of the player marble that replays the best run.
export function buildGhostMarble() {
  const group = new THREE.Group();
  const ghostMat = new THREE.MeshLambertMaterial({
    color: 0x9fe9ff, transparent: true, opacity: 0.32, depthWrite: false,
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(MARBLE_RADIUS, 20, 20), ghostMat);
  group.add(ball);
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(MARBLE_RADIUS * 1.002, MARBLE_RADIUS * 0.28, 6, 24),
    new THREE.MeshLambertMaterial({ color: 0x4ab6ff, transparent: true, opacity: 0.32, depthWrite: false })
  );
  group.add(band);
  group.visible = false;
  return group;
}
