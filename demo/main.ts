import { createViewportLock } from "../src/index.ts";

const app = document.getElementById("app")!;
const toggle = document.getElementById("toggle") as HTMLInputElement;
const toggleLabel = document.getElementById("toggle-label")!;
let cleanup: (() => void) | null = null;

function enable() {
  cleanup?.();
  cleanup = createViewportLock({
    container: app,
    eventTarget: document,
  });
}

function disable() {
  cleanup?.();
  cleanup = null;
}

toggle.addEventListener("change", () => {
  if (toggle.checked) {
    enable();
    toggleLabel.textContent = "locked";
  } else {
    disable();
    toggleLabel.textContent = "unlocked";
  }
});

enable();
