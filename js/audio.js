// Procedural audio for Brennan Game — pure WebAudio, NO asset files (so it loads
// behind school firewalls). A looping synthwave bed + one-shot SFX. Everything is
// generated from oscillators/noise at runtime.
//
// Browser autoplay policy: an AudioContext can't make sound until a user gesture.
// Call audio.resumeOnGesture() once at boot; the first keydown/click starts it.

const MUTE_KEY = "brennan_muted_v1";
const VOL_KEY = "brennan_vol_v1";

let ctx = null;
let master = null;       // master gain (volume)
let musicGain = null;    // music bus
let sfxGain = null;      // sfx bus
let started = false;     // music running
let rollOsc = null, rollGain = null, rollFilter = null;
let schedTimer = null;
let step = 0;            // sequencer step
let nextNoteTime = 0;

let muted = false;
let volume = 0.7;

// ---- persistence ----
try {
  const m = localStorage.getItem(MUTE_KEY);
  if (m != null) muted = m === "1";
  const v = parseFloat(localStorage.getItem(VOL_KEY));
  if (!Number.isNaN(v)) volume = Math.min(1, Math.max(0, v));
} catch { /* ignore */ }

function ensureCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(master);
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

// ---- synthwave sequencer ------------------------------------------------------
// A i–VI–III–VII vibe in A minor: chords as root frequencies (one chord per bar).
const A2 = 110.0;
const CHORDS = [
  // [bass root, [chord note freqs]]
  [110.00, [220.0, 261.63, 329.63]], // Am
  [174.61, [174.61, 220.0, 261.63]], // F
  [130.81, [196.0, 261.63, 329.63]], // C
  [196.00, [196.0, 246.94, 293.66]], // G
];
const BPM = 112;
const SIXTEENTH = 60 / BPM / 4; // seconds per 16th note
const LEAD_SCALE = [440.0, 523.25, 587.33, 659.25, 783.99]; // A minor pentatonic-ish

function blip(dest, freq, t, dur, type, peak, glideTo) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

function scheduleStep(t) {
  const bar = Math.floor(step / 16) % CHORDS.length;
  const inBar = step % 16;
  const [bassRoot, chord] = CHORDS[bar];

  // bass: drive on every 8th, arpeggiate
  if (inBar % 2 === 0) {
    const bf = bassRoot * (inBar % 8 === 4 ? 1.5 : 1); // little 5th lift mid-bar
    blip(musicGain, bf, t, SIXTEENTH * 1.8, "sawtooth", 0.16);
  }
  // pad: soft chord stab at the start of each bar
  if (inBar === 0) {
    for (const cf of chord) blip(musicGain, cf, t, SIXTEENTH * 14, "triangle", 0.05);
  }
  // lead: sparse plucks in the back half of bars 2 and 4
  if ((bar === 1 || bar === 3) && inBar % 4 === 2) {
    const lf = LEAD_SCALE[(step * 7) % LEAD_SCALE.length];
    blip(musicGain, lf, t, SIXTEENTH * 2.2, "square", 0.045);
  }
  // hi-hat-ish tick (filtered noise) on offbeats
  if (inBar % 2 === 1) {
    const dur = 0.03;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
    const g = ctx.createGain(); g.gain.value = 0.03;
    src.connect(hp); hp.connect(g); g.connect(musicGain);
    src.start(t);
    src.stop(t + dur + 0.02);
    src.onended = () => { src.disconnect(); hp.disconnect(); g.disconnect(); };
  }
}

function scheduler() {
  if (!ctx) return;
  const lookahead = 0.12;
  while (nextNoteTime < ctx.currentTime + lookahead) {
    scheduleStep(nextNoteTime);
    nextNoteTime += SIXTEENTH;
    step++;
  }
}

// ---- public API ---------------------------------------------------------------
export const audio = {
  resumeOnGesture() {
    const go = () => {
      const c = ensureCtx();
      if (c && c.state === "suspended") c.resume();
      this.startMusic();
      window.removeEventListener("keydown", go);
      window.removeEventListener("pointerdown", go);
    };
    window.addEventListener("keydown", go);
    window.addEventListener("pointerdown", go);
  },

  startMusic() {
    if (!ensureCtx() || started) return;
    started = true;
    nextNoteTime = ctx.currentTime + 0.08;
    step = 0;
    schedTimer = setInterval(scheduler, 25);
  },
  stopMusic() {
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    started = false;
  },

  setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch {}
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02);
  },
  isMuted() { return muted; },
  toggleMute() { this.setMuted(!muted); return muted; },

  setVolume(v) {
    volume = Math.min(1, Math.max(0, v));
    try { localStorage.setItem(VOL_KEY, String(volume)); } catch {}
    if (master && ctx && !muted) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
  },
  getVolume() { return volume; },

  // --- continuous rolling rumble; call each frame with the marble's speed ---
  roll(speed) {
    if (!ctx || ctx.state !== "running") return;
    if (!rollOsc) {
      rollOsc = ctx.createOscillator();
      rollFilter = ctx.createBiquadFilter();
      rollGain = ctx.createGain();
      rollOsc.type = "sawtooth";
      rollFilter.type = "lowpass";
      rollFilter.frequency.value = 420;
      rollGain.gain.value = 0.0001;
      rollOsc.connect(rollFilter); rollFilter.connect(rollGain); rollGain.connect(sfxGain);
      rollOsc.start();
    }
    const s = Math.min(1, speed / 14);
    rollOsc.frequency.setTargetAtTime(60 + s * 90, ctx.currentTime, 0.05);
    rollFilter.frequency.setTargetAtTime(300 + s * 700, ctx.currentTime, 0.05);
    rollGain.gain.setTargetAtTime(s * 0.05, ctx.currentTime, 0.05);
  },
  rollStop() {
    if (rollGain && ctx) rollGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
  },

  // --- one-shot SFX ---
  drop() {
    if (!ensureCtx() || ctx.state !== "running") return;
    blip(sfxGain, 320, ctx.currentTime, 0.18, "sine", 0.12, 120);
  },
  death() {
    if (!ensureCtx() || ctx.state !== "running") return;
    const t = ctx.currentTime;
    // downward saw sweep + noise burst
    blip(sfxGain, 300, t, 0.5, "sawtooth", 0.18, 60);
    const dur = 0.4;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.12;
    src.connect(g); g.connect(sfxGain); src.start(t);
  },
  win() {
    if (!ensureCtx() || ctx.state !== "running") return;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C — bright arpeggio
    notes.forEach((f, i) => blip(sfxGain, f, t + i * 0.09, 0.3, "square", 0.12));
  },
  levelStart() {
    if (!ensureCtx() || ctx.state !== "running") return;
    blip(sfxGain, 440, ctx.currentTime, 0.16, "triangle", 0.1, 660);
  },
  uiClick() {
    if (!ensureCtx() || ctx.state !== "running") return;
    blip(sfxGain, 660, ctx.currentTime, 0.06, "square", 0.06);
  },
};
