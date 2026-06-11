// Entry point: sets up Three.js (renderer + bloom), runs the game loop and the
// MENU -> PLAYING -> COMPLETE/DEAD -> FINISH state machine, follows the marble
// with the camera, and wires the HTML overlays/buttons.

import * as THREE from "three";

import { keys, onAction } from "./input.js";
import { LEVELS, LEVEL_COUNT } from "./levels.js";
import { World, getBest, setBest, getUnlocked, unlock, setGhost, getGemsBest, setGemsBest } from "./game.js";

// ---------------- Three.js setup ----------------
const mount = document.getElementById("scene");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x29bfbf); // turquoise water (Marble Trap style)

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 16, 22);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x29bfbf, 1); // turquoise water — belt-and-suspenders with scene.background
mount.appendChild(renderer.domElement);

// No bloom — Marble Trap uses plain rendering; bloom caused white washout on sky.
let composer = null;

import { buildEnvironment, makeParticles, makeTrail } from "./builder.js";
import { audio } from "./audio.js";
const env = buildEnvironment(scene); // ocean + clouds + islands; env.update(dt) each frame

const world = new World(scene);

// juice: particle bursts (death/win) + a fading marble trail
const particles = makeParticles(scene);
const trail = makeTrail(scene);

// start audio on the first user gesture (browser autoplay policy)
audio.resumeOnGesture();

// ---------------- UI references ----------------
const el = (id) => document.getElementById(id);
const ui = {
  hud: el("hud"), hint: el("hint"),
  hudLevel: el("hud-level"), hudTime: el("hud-time"), hudBest: el("hud-best"), hudDeaths: el("hud-deaths"),
  hudTotal: el("hud-total"), hudGems: el("hud-gems"),
  completeGems: el("complete-gems"),
  menu: el("overlay-menu"), complete: el("overlay-complete"), dead: el("overlay-dead"), finish: el("overlay-finish"),
  pause: el("overlay-pause"), btnPause: el("btn-pause"),
  levelSelect: el("level-select"),
  completeTime: el("complete-time"), completeBest: el("complete-best"), completeRecord: el("complete-record"),
  deadReason: el("dead-reason"), finishTotal: el("finish-total"),
  loading: el("loading"),
  levelCard: el("level-card"), levelCardNum: el("level-card-num"), levelCardName: el("level-card-name"),
  fade: el("fade"),
  btnMute: el("btn-mute"), volSlider: el("vol-slider"),
};

// ---------------- game state ----------------
const STATE = { MENU: "menu", PLAYING: "playing", COMPLETE: "complete", DEAD: "dead", FINISH: "finish", PAUSED: "paused" };
let state = STATE.MENU;
let currentLevel = 0;
let deaths = 0;
let runTotal = 0; // cumulative winning time for this playthrough
let lastGemCount = 0; // for detecting a gem pickup this frame (sound + burst)

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
  audio.rollStop();
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
  audio.rollStop();
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
  lastGemCount = 0;
  world.load(i);
  state = STATE.PLAYING;
  hideOverlays();
  showHud(true);
  updateHud();
  // snap camera near the marble so the first frame isn't a fly-in
  shakeAmt = 0;
  const m = world.marble.pos;
  camera.position.set(m.x + camOffset.x, m.y + camOffset.y, m.z + camOffset.z);
  trail.reset(m);
  showLevelCard(i);
  audio.levelStart();
  flash();
}

// brief level-intro card ("LEVEL 5 — THE SAW")
function showLevelCard(i) {
  if (!ui.levelCard) return;
  ui.levelCardNum.textContent = "LEVEL " + (i + 1);
  ui.levelCardName.textContent = LEVELS[i].name;
  ui.levelCard.classList.remove("show");
  void ui.levelCard.offsetWidth; // restart the CSS animation
  ui.levelCard.classList.add("show");
}

// quick screen flash (transition feel)
function flash() {
  if (!ui.fade) return;
  ui.fade.classList.remove("show");
  void ui.fade.offsetWidth;
  ui.fade.classList.add("show");
}

function retryLevel() {
  deaths += 1;
  lastGemCount = 0;
  _splashFired = false;
  audio.rollStop();
  shakeAmt = 0;
  world.respawn();
  trail.reset(world.marble.pos);
  state = STATE.PLAYING;
  hideOverlays();
  showHud(true);
  updateHud();
}

function onWin() {
  const t = world.time;
  particles.burst(world.marble.pos, 0xffe66d, 70, 11); // golden celebration
  addShake(0.5);
  audio.rollStop();
  audio.win();
  runTotal += t;
  const record = setBest(currentLevel, t);
  if (record) setGhost(currentLevel, world.getRunPath()); // save this best run as the replay ghost
  setGemsBest(currentLevel, world.gemCount);
  unlock(Math.min(currentLevel + 1, LEVEL_COUNT - 1));

  const totalGems = (world.level?.gems || []).length;
  const perfect = totalGems > 0 && world.gemCount >= totalGems;

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
    if (ui.completeGems) ui.completeGems.textContent = (perfect ? "★ PERFECT ★  " : "") + "💎 " + world.gemCount + " / " + totalGems;
    ui.completeRecord.classList.toggle("hidden", !record);
    ui.complete.classList.remove("hidden");
  }
}

let _splashFired = false;
function onSplash() {
  if (_splashFired) return; // only burst once per fall
  _splashFired = true;
  // blue-white water splash at the marble's current position
  particles.burst(world.marble.pos, 0x29bfbf, 55, 7);
  particles.burst(world.marble.pos, 0xffffff, 25, 5);
  audio.rollStop();
  audio.drop(); // splash sound
}

function onDead() {
  _splashFired = false; // reset for next fall
  state = STATE.DEAD;
  particles.burst(world.marble.pos, 0xff2e88, 64, 10); // magenta splat
  addShake(1.1);
  trail.hide();
  audio.rollStop();
  audio.death();
  showHud(false);
  hideOverlays();
  ui.deadReason.textContent = world.deathReason || "The trap got you.";
  ui.dead.classList.remove("hidden");
}

function updateHud() {
  ui.hudLevel.textContent = currentLevel + 1;
  if (ui.hudTotal) ui.hudTotal.textContent = "/ " + LEVEL_COUNT;
  const best = getBest(currentLevel);
  ui.hudBest.textContent = best != null ? fmt(best) + "s" : "—";
  ui.hudDeaths.textContent = "DEATHS: " + deaths;
  const total = (world.level?.gems || []).length;
  if (ui.hudGems) ui.hudGems.textContent = "💎 " + world.gemCount + "/" + total;
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

// ---------------- camera follow (FIXED 3/4 view — never rotates) ----------------
// The camera sits at a constant offset above/behind the marble and always looks in
// the SAME world direction (down -Z). It only TRANSLATES with the marble; it never
// rotates with input. (A previous velocity-based "look-ahead" rotated the view on
// every left/right press, which made the track spin — removed.)
const camOffset = new THREE.Vector3(0, 24, 19);
// Aim is taken RELATIVE TO THE CAMERA (not the marble), so the camera's orientation
// is IDENTICAL every frame — zero yaw, ever — even while it lags the marble during
// lateral moves. This is the constant 3/4 "isometric" look. Derived so that when the
// camera is centered on the marble it points at ~(marble + (0,1,-6)).
const aimFromCamera = new THREE.Vector3(0, 1 - camOffset.y, -6 - camOffset.z); // (0,-23,-25)
const lookTarget = new THREE.Vector3();
const _desired = new THREE.Vector3();          // reused each frame (no per-frame GC)
const _origin = new THREE.Vector3();           // null-marble fallback
let shakeAmt = 0; // screen-shake magnitude, decays each frame
function addShake(a) { shakeAmt = Math.min(1.4, shakeAmt + a); }
function followCamera(dt, instant = false) {
  const m = world.marble ? world.marble.pos : _origin;
  _desired.set(m.x + camOffset.x, m.y + camOffset.y, m.z + camOffset.z);
  const k = instant ? 1 : 1 - Math.exp(-6 * dt);
  camera.position.lerp(_desired, k);
  // screen shake (small, decays fast)
  if (shakeAmt > 0.001) {
    camera.position.x += (Math.random() * 2 - 1) * shakeAmt;
    camera.position.y += (Math.random() * 2 - 1) * shakeAmt;
    camera.position.z += (Math.random() * 2 - 1) * shakeAmt;
    shakeAmt *= Math.exp(-9 * dt);
  }
  // fixed-orientation aim: target = camera.position + constant vector → never rotates
  lookTarget.set(
    camera.position.x + aimFromCamera.x,
    camera.position.y + aimFromCamera.y,
    camera.position.z + aimFromCamera.z
  );
  camera.lookAt(lookTarget);
}

// menu backdrop: slow drifting camera
let menuAngle = 0;
function menuCamera(dt) {
  menuAngle += dt * 0.18;
  const r = 26;
  const m = world.marble ? world.marble.pos : _origin;
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
    // juice: trail follows + rolling rumble scales with speed
    trail.update(world.marble.pos);
    audio.roll(Math.hypot(world.marble.vel.x, world.marble.vel.z));
    // gem pickup feedback (sound + sparkle) the frame the count rises
    if (world.gemCount > lastGemCount) {
      lastGemCount = world.gemCount;
      particles.burst(world.marble.pos, 0x39e0ff, 24, 6);
      audio.gem();
      updateHud();
    }
    if (status === "won") onWin();
    else if (status === "splash") onSplash();
    else if (status === "dead") onDead();
  } else if (state === STATE.MENU) {
    world.idleUpdate(dt);
    menuCamera(dt);
  } else if (state === STATE.PAUSED) {
    // freeze the world AND snap the camera (instant=true) so it doesn't keep lerping
    followCamera(dt, true);
  } else {
    // overlays up (complete/dead/finish): keep traps animating, hold camera
    world.idleUpdate(dt);
    followCamera(dt);
  }

  particles.update(dt); // bursts keep animating across all states
  env.update(dt);       // ocean thrashes + clouds drift in every state

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

// audio settings: mute button + volume slider (persisted in audio.js)
function refreshMuteBtn() {
  if (ui.btnMute) ui.btnMute.textContent = audio.isMuted() ? "🔇" : "🔊";
  if (ui.volSlider) ui.volSlider.value = String(audio.isMuted() ? 0 : Math.round(audio.getVolume() * 100));
}
if (ui.btnMute) {
  refreshMuteBtn();
  ui.btnMute.addEventListener("click", () => { audio.toggleMute(); refreshMuteBtn(); audio.uiClick(); });
}
if (ui.volSlider) {
  refreshMuteBtn();
  ui.volSlider.addEventListener("input", () => {
    audio.setVolume(ui.volSlider.value / 100);
    if (audio.isMuted() && ui.volSlider.value > 0) { audio.setMuted(false); refreshMuteBtn(); }
  });
}
// a soft click on any overlay button press
document.querySelectorAll(".btn").forEach((b) => b.addEventListener("click", () => audio.uiClick()));

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
    get camera() { return camera; },
    start: (i) => { runTotal = 0; startLevel(i); },
    // teleport the marble next to the finish gate to verify the win flow
    toFinish: () => {
      const f = world.level.finish;
      world.marble.pos.set(f[0], 1, f[2] + 0.5);
      world.marble.vel.set(0, 0, 0);
    },
  };
}
