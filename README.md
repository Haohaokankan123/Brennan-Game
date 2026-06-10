# Brennan Game — Marble Trap

A neon synthwave **3D marble-trap game** for the browser. Roll the marble to the glowing
finish gate, dodge the traps, and beat the clock across **8 escalating levels**. Inspired by
[Marble Trap](https://nannings.itch.io/marble-trap).

🎮 **Play it here:** https://haohaokankan123.github.io/Brennan-Game/

## How to play

- **Move:** Arrow keys or **WASD**
- **Restart level:** **R**
- **Back to menu:** **Esc**
- **Confirm menus:** **Enter**

Reach the yellow finish gate without touching a trap or falling off the edge. Your best time
per level is saved automatically. Levels unlock as you clear them.

## The traps

Rotating axes · rising spears · patrolling spike cubes · dropping pit traps · cannons ·
and a **chasing chainsaw** that forces you to keep moving. Levels 1–2 ease you in; 7–8 stack
everything on the narrowest tracks — hard but beatable.

## Tech

- **Three.js** for 3D rendering, with **UnrealBloom** post-processing for the neon glow.
- Custom lightweight physics (gravity, momentum, sphere-vs-box collision) — no physics engine.
- **Zero external/CDN requests.** Three.js, the bloom addons, and the arcade font are all
  vendored in `js/vendor/`, so the game loads even behind strict school firewalls.
- Plain static files — no build step.

## Run locally

ES modules must be served over HTTP (opening `index.html` directly with `file://` won't work):

```bash
cd Brennan_Game
python3 -m http.server 8000
# then open http://localhost:8000
```

## Project structure

```
index.html        # canvas + UI overlays, import map -> local Three.js
styles.css        # neon synthwave HUD/menus
js/
  main.js         # scene, bloom, game loop, state machine, camera, UI wiring
  game.js         # World (loads a level), progression + best-time persistence
  physics.js      # marble integrator + sphere-AABB collision + fall detection
  traps.js        # all trap types (build + animate + hit test)
  levels.js       # the 8 level layouts (data)
  builder.js      # level data -> neon meshes + environment
  input.js        # keyboard
  vendor/         # Three.js, bloom addons, arcade font (all local)
```
