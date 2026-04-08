// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Resizes an element's height to match `visualViewport.height` whenever the
 * visual viewport changes (e.g. when the virtual keyboard opens or closes).
 *
 * @param container The element whose `style.height` will be kept in sync.
 * @param onResize  Optional callback invoked with the new height on every
 *                  resize. When provided the library will **not** set
 *                  `container.style.height` — you own the side-effect.
 * @returns A cleanup function that removes the listener and restores the
 *          original height (only when no custom `onResize` was provided).
 */
const managedContainers = new WeakMap<HTMLElement, string>();

export function viewportResize(
  container: HTMLElement,
  onResize?: (height: number, container: HTMLElement) => void,
): () => void {
  const vv = globalThis.visualViewport;
  if (!vv) return () => {};

  if (!onResize && !managedContainers.has(container)) {
    managedContainers.set(container, container.style.height);
  }

  const handler = () => {
    if (onResize) {
      onResize(vv.height, container);
    } else {
      container.style.height = `${vv.height}px`;
    }
  };

  vv.addEventListener("resize", handler, { passive: true });
  handler();

  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    vv.removeEventListener("resize", handler);
    if (!onResize) {
      const original = managedContainers.get(container);
      managedContainers.delete(container);
      if (original !== undefined) {
        container.style.height = original;
      }
    }
  };
}

/**
 * Resets the layout viewport scroll position whenever the visual viewport
 * scrolls (e.g. due to scroll chaining or app backgrounding/foregrounding).
 *
 * @param onScroll Optional callback invoked on every visual viewport scroll.
 *                 When provided the library will **not** call
 *                 `window.scrollTo` — you own the side-effect.
 * @returns A cleanup function that removes the listener.
 */
export function scrollReset(onScroll?: () => void): () => void {
  const vv = globalThis.visualViewport;
  if (!vv) return () => {};

  const handler = () => {
    if (onScroll) {
      onScroll();
    } else if (window.scrollX !== 0 || window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
  };

  vv.addEventListener("scroll", handler, { passive: true });

  return () => {
    vv.removeEventListener("scroll", handler);
  };
}

/**
 * Intercepts `touchend` on focusable elements (`input`, `textarea`,
 * `[contenteditable]`) and calls `preventDefault()` +
 * `focus({ preventScroll: true })` to stop the browser from scrolling
 * the layout viewport to the focused input.
 *
 * `<select>` elements are intentionally excluded because they need the
 * native picker.
 *
 * @param target The element (or `document`) on which to listen for `touchend`.
 * @returns A cleanup function that removes the listener.
 */
export function focusIntercept(
  target: HTMLElement | Document,
): () => void {
  const handler = (e: Event) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    const focusTarget = getFocusTarget(el);
    if (focusTarget) {
      e.preventDefault();
      focusTarget.focus({ preventScroll: true });
      // In iOS standalone/PWA mode the browser sometimes initiates a native
      // scroll-into-view before our touchend handler wins the race.  Reset
      // immediately *and* on the next frame to undo any layout-viewport shift
      // that slipped through.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      requestAnimationFrame(() => {
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      });
    }
  };

  target.addEventListener("touchend", handler, { passive: false });

  return () => {
    target.removeEventListener("touchend", handler);
  };
}

// ---------------------------------------------------------------------------
// Bundled convenience
// ---------------------------------------------------------------------------

export interface ViewportLockOptions {
  /** The container element to resize with the visual viewport. */
  container: HTMLElement;
  /**
   * Whether the lock is enabled. Defaults to `true`.
   *
   * @example
   * ```ts
   * createViewportLock({
   *   container: el,
   *   enabled: /iPhone|iPad/.test(navigator.userAgent),
   * });
   * ```
   */
  enabled?: boolean;
  /**
   * Custom handler called with the new viewport height on every resize.
   * When provided the library will **not** set `container.style.height`.
   */
  onResize?: (height: number, container: HTMLElement) => void;
  /**
   * Custom handler called when the visual viewport scrolls.
   * When provided the library will **not** call `window.scrollTo(0, 0)`.
   */
  onScroll?: () => void;
  /**
   * The element on which to listen for `touchend` focus interception.
   * Defaults to `container`. Pass `document` to intercept all focusable
   * elements on the page.
   */
  eventTarget?: HTMLElement | Document;
}

/**
 * Locks the viewport so that fixed headers and footers stay in place when the
 * virtual keyboard opens on mobile browsers.
 *
 * Composes {@link viewportResize}, {@link scrollReset}, and
 * {@link focusIntercept} with sensible defaults.
 *
 * @returns A cleanup function that removes all listeners and restores the
 *          container.
 */
export function createViewportLock(options: ViewportLockOptions): () => void {
  const {
    container,
    enabled = true,
    onResize,
    onScroll,
    eventTarget = container,
  } = options;

  if (!enabled) return () => {};

  const cleanupResize = viewportResize(container, onResize);
  const cleanupScroll = scrollReset(onScroll);
  const cleanupFocus = focusIntercept(eventTarget);

  return () => {
    cleanupResize();
    cleanupScroll();
    cleanupFocus();
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KEYBOARD_INPUT_TYPES = new Set([
  "text", "search", "url", "tel", "email", "password", "number",
]);

function getFocusTarget(el: HTMLElement): HTMLElement | null {
  const tag = el.tagName;
  if (tag === "TEXTAREA") return el;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type.toLowerCase();
    return KEYBOARD_INPUT_TYPES.has(type) ? el : null;
  }
  if (tag === "LABEL") {
    const control = (el as HTMLLabelElement).control;
    if (control instanceof HTMLElement) return control;
  }
  const editable = el.closest("[contenteditable]");
  if (editable instanceof HTMLElement) {
    const val = editable.getAttribute("contenteditable");
    if (val !== "false") return editable;
  }
  return null;
}
