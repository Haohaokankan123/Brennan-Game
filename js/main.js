// Entry point: sets up Three.js (renderer + bloom), runs the game loop and the
// MENU -> PLAYING -> COMPLETE/DEAD -> FINISH state machine, follows the marble
// with the camera, and wires the HTML overlays/buttons.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { keys, onAction } from "./input.js";
import { LEVELS, LEVEL_COUNT } from "./levels.js";
import { World, getBest, setBest, getUnlocked, unlock } from "./game.js";

// ---------------- Three.js setup ----------------
const mount = document.getElementById("scene");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0420);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 16, 22);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
mount.appendChild(renderer.domElement);

// bloom post-processing (graceful fallback to plain render if it fails)
let composer = null;
try {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.9,   // strength
    0.6,   // radius
    0.15   // threshold
  );
  composer.addPass(bloom);
} catch (err) {
  console.warn("Bloom unavailable, falling back to plain render:", err);
  composer = null;
}

import { buildEnvironment } from "./builder.js";
buildEnvironment(scene);

const world = new World(scene);

// ---------------- UI references ----------------
const el = (id) => document.getElementById(id);
const ui = {
  hud: el("hud"), hint: el("hint"),
  hudLevel: el("hud-level"), hudTime: el("hud-time"), hudBest: el("hud-best"), hudDeaths: el("hud-deaths"),
  menu: el("overlay-menu"), complete: el("overlay-complete"), dead: el("overlay-dead"), finish: el("overlay-finish"),
  pause: el("overlay-pause"), btnPause: el("btn-pause"),
  levelSelect: el("level-select"),
  completeTime: el("complete-time"), completeBest: el("complete-best"), completeRecord: el("complete-record"),
  deadReason: el("dead-reason"), finishTotal: el("finish-total"),
  loading: el("loading"),
};

// ---------------- game state ----------------
const STATE = { MENU: "menu", PLAYING: "playing", COMPLETE: "complete", DEAD: "dead", FINISH: "finish", PAUSED: "paused" };
let state = STATE.MENU;
let currentLevel = 0;
let deaths = 0;
let runTotal = 0; // cumulative winning time for this playthrough

function fmt(s) { return s.toFixed(2); }

function hideOverlays() {
  ui.menu.classList.add("hidden");
  ui.complete.classList.add("hidden");
  ui.dead.classList.add("hidden");
  ui.finish.classList.add("hidden");
  ui.pause.classList.add("hidden");
}

function showHud(show) {
  ui.hud.classList.toggle("hidden", !show);
  ui.hint.classList.toggle("hidden", !show);
  ui.btnPause.classList.toggle("hidden", !show);
}

function pauseGame() {
  if (state !== STATE.PLAYING) return;
  state = STATE.PAUSED;
  ui.btnPause.classList.add("hidden");
  ui.pause.classList.remove("hidden");
}

function resumeGame() {
  if (state !== STATE.PAUSED) return;
  state = STATE.PLAYING;
  ui.pause.classList.add("hidden");
  ui.btnPause.classList.remove("hidden");
  last = performance.now(); // avoid a huge dt jump after the pause
}

function buildLevelSelect() {
  ui.levelSelect.innerHTML = "";
  const unlocked = getUnlocked();
  LEVELS.forEach((lv, i) => {
    const b = document.createElement("button");
    b.className = "lvl-btn";
    const best = getBest(i);
    if (best != null) b.classList.add("cleared");
    const locked = i > unlocked;
    b.disabled = locked;
    b.innerHTML = `${i + 1}<span class="lock">${locked ? "LOCKED" : (best != null ? fmt(best) + "s" : lv.name)}</span>`;
    b.addEventListener("click", () => { runTotal = 0; startLevel(i); });
    ui.levelSelect.appendChild(b);
  });
}

function goMenu() {
  state = STATE.MENU;
  hideOverlays();
  showHud(false);
  buildLevelSelect();
  ui.menu.classList.remove("hidden");
  // load level 0 (or current) as an animated backdrop
  world.load(currentLevel);
}

function startLevel(i) {
  currentLevel = i;
  deaths = 0;
  world.load(i);
  state = STATE.PLAYING;
  hideOverlays();
  showHud(true);
  updateHud();
  // snap camera near the marble so the first frame isn't a fly-in
  const m = world.marble.pos;
  camera.position.set(m.x, m.y + 16, m.z + 22);
}

function retryLevel() {
  deaths += 1;
  world.respawn();
  state = STATE.PLAYING;
  hideOverlays();
  showHud(true);
  updateHud();
}

function onWin() {
  const t = world.time;
  runTotal += t;
  const record = setBest(currentLevel, t);
  unlock(Math.min(currentLevel + 1, LEVEL_COUNT - 1));

  if (currentLevel >= LEVEL_COUNT - 1) {
    state = STATE.FINISH;
    showHud(false);
    hideOverlays();
    ui.finishTotal.textContent = fmt(runTotal);
    ui.finish.classList.remove("hidden");
  } else {
    state = STATE.COMPLETE;
    showHud(false);
    hideOverlays();
    ui.completeTime.textContent = fmt(t);
    ui.completeBest.textContent = fmt(getBest(currentLevel));
    ui.completeRecord.classList.toggle("hidden", !record);
    ui.complete.classList.remove("hidden");
  }
}

function onDead() {
  state = STATE.DEAD;
  showHud(false);
  hideOverlays();
  ui.deadReason.textContent = world.deathReason || "The trap got you.";
  ui.dead.classList.remove("hidden");
}

function updateHud() {
  ui.hudLevel.textContent = currentLevel + 1;
  const best = getBest(currentLevel);
  ui.hudBest.textContent = best != null ? fmt(best) + "s" : "—";
  ui.hudDeaths.textContent = "DEATHS: " + deaths;
}

// ---------------- input -> world axes ----------------
function readInput() {
  let x = 0, z = 0;
  if (keys.up) z -= 1;
  if (keys.down) z += 1;
  if (keys.left) x -= 1;
  if (keys.right) x += 1;
  if (x !== 0 && z !== 0) { const l = Math.SQRT1_2; x *= l; z *= l; }
  return { x, z };
}

// ---------------- camera follow ----------------
const camOffset = new THREE.Vector3(0, 15, 18);
const lookTarget = new THREE.Vector3();
function followCamera(dt, instant = false) {
  const m = world.marble ? world.marble.pos : new THREE.Vector3();
  const desired = new THREE.Vector3(m.x + camOffset.x, m.y + camOffset.y, m.z + camOffset.z);
  const k = instant ? 1 : 1 - Math.exp(-7 * dt);
  camera.position.lerp(desired, k);
  lookTarget.set(m.x, m.y + 1, m.z - 4); // look slightly ahead (into upcoming traps)
  camera.lookAt(lookTarget);
}

// menu backdrop: slow drifting camera
let menuAngle = 0;
function menuCamera(dt) {
  menuAngle += dt * 0.18;
  const r = 26;
  const m = world.marble ? world.marble.pos : new THREE.Vector3();
  camera.position.set(Math.sin(menuAngle) * r + m.x, 14, Math.cos(menuAngle) * r + m.z + 6);
  camera.lookAt(m.x, 1, m.z - 6);
}

// ---------------- loop ----------------
let last = performance.now();
function loop(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05; // clamp big frame gaps (tab switch) so physics stays stable

  if (state === STATE.PLAYING) {
    const status = world.update(readInput(), dt);
    ui.hudTime.textContent = fmt(world.time);
    followCamera(dt);
    if (status === "won") onWin();
    else if (status === "dead") onDead();
  } else if (state === STATE.MENU) {
    world.idleUpdate(dt);
    menuCamera(dt);
  } else if (state === STATE.PAUSED) {
    // freeze the world; just hold the camera steady on the marble
    followCamera(dt);
  } else {
    // overlays up (complete/dead/finish): keep traps animating, hold camera
    world.idleUpdate(dt);
    followCamera(dt);
  }

  if (composer) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ---------------- wiring ----------------
el("btn-start").addEventListener("click", () => { runTotal = 0; startLevel(0); });
el("btn-next").addEventListener("click", () => startLevel(currentLevel + 1));
el("btn-retry").addEventListener("click", retryLevel);
el("btn-retry-c").addEventListener("click", () => startLevel(currentLevel));
el("btn-menu-c").addEventListener("click", goMenu);
el("btn-menu-d").addEventListener("click", goMenu);
el("btn-menu-f").addEventListener("click", goMenu);
el("btn-replay").addEventListener("click", () => { runTotal = 0; startLevel(0); });

// pause button + pause overlay
ui.btnPause.addEventListener("click", pauseGame);
el("btn-resume").addEventListener("click", resumeGame);
el("btn-restart-p").addEventListener("click", () => { hideOverlays(); startLevel(currentLevel); });
el("btn-menu-p").addEventListener("click", goMenu);

// keyboard actions
onAction("restart", () => { if (state === STATE.PLAYING) retryLevel(); });
onAction("menu", () => {
  if (state === STATE.PLAYING) pauseGame();
  else if (state === STATE.PAUSED) resumeGame();
  else if (state !== STATE.MENU) goMenu();
});
onAction("confirm", () => {
  if (state === STATE.DEAD) retryLevel();
  else if (state === STATE.COMPLETE) startLevel(currentLevel + 1);
  else if (state === STATE.FINISH) goMenu();
  else if (state === STATE.MENU) { runTotal = 0; startLevel(0); }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------- boot ----------------
ui.loading.classList.add("hidden");
goMenu();
requestAnimationFrame(loop);

// Dev/test hook — only active with ?test in the URL; inert in normal play.
if (location.search.includes("test")) {
  window.__brennan = {
    get state() { return state; },
    get world() { return world; },
    start: (i) => { runTotal = 0; startLevel(i); },
    // teleport the marble next to the finish gate to verify the win flow
    toFinish: () => {
      const f = world.level.finish;
      world.marble.pos.set(f[0], 1, f[2] + 0.5);
      world.marble.vel.set(0, 0, 0);
    },
  };
}
