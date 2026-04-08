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
    onResize(height, container) {
      container.style.transition = "height 0.23s ease";
      container.style.height = `${height}px`;
    },
  });
}

function disable() {
  cleanup?.();
  cleanup = null;
  app.style.height = "";
  app.style.transition = "";
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
