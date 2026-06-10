// Keyboard input — tracks which movement keys are held, plus one-shot action keys.
// Arrow keys + WASD move the marble. R restarts, Escape opens the menu, Enter confirms.

export const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
};

// Action callbacks set by the game (so a key press fires once, not every frame).
const actions = {
  restart: null,
  menu: null,
  confirm: null,
};

export function onAction(name, fn) {
  actions[name] = fn;
}

function setMove(e, isDown) {
  switch (e.code) {
    case "ArrowUp":
    case "KeyW": keys.up = isDown; break;
    case "ArrowDown":
    case "KeyS": keys.down = isDown; break;
    case "ArrowLeft":
    case "KeyA": keys.left = isDown; break;
    case "ArrowRight":
    case "KeyD": keys.right = isDown; break;
    default: return false;
  }
  return true;
}

window.addEventListener("keydown", (e) => {
  // Stop arrow keys from scrolling the page.
  if (setMove(e, true)) { e.preventDefault(); return; }

  if (e.repeat) return; // action keys fire once per physical press
  if (e.code === "KeyR" && actions.restart) actions.restart();
  else if (e.code === "Escape" && actions.menu) actions.menu();
  else if (e.code === "Enter" && actions.confirm) actions.confirm();
});

window.addEventListener("keyup", (e) => {
  setMove(e, false);
});

// If the window loses focus, drop all held keys so the marble doesn't drift.
window.addEventListener("blur", () => {
  keys.up = keys.down = keys.left = keys.right = false;
});
