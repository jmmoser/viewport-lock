import { createViewportLock } from "../src/index.ts";

const app = document.getElementById("app")!;
const toggle = document.getElementById("toggle") as HTMLInputElement;
let cleanup: (() => void) | null = null;

function enable() {
  cleanup?.();
  cleanup = createViewportLock({ container: app, eventTarget: document });
}

function disable() {
  cleanup?.();
  cleanup = null;
}

toggle.addEventListener("change", () => {
  if (toggle.checked) {
    enable();
  } else {
    disable();
  }
});

enable();
