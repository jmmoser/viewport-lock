# viewport-lock

**Prevent the mobile keyboard from pushing your layout off-screen.**

[![npm](https://img.shields.io/npm/v/viewport-lock)](https://www.npmjs.com/package/viewport-lock)
[![bundle size](https://img.shields.io/bundlephobia/minzip/viewport-lock)](https://bundlephobia.com/package/viewport-lock)
[![license](https://img.shields.io/npm/l/viewport-lock)](./LICENSE)

---

## The problem

On iOS Safari, opening the virtual keyboard shrinks the **visual viewport** but the browser scrolls the **layout viewport** to keep the focused input visible — pushing fixed headers and footers off-screen.

`viewport-lock` fixes this by resizing your container to the visual viewport and intercepting focus events — no browser hacks, no `100vh` workarounds.

## Features

- **Small** — Zero dependencies
- **Vanilla + React** — first-class support for both
- **Composable** — use the bundled lock or pick individual primitives
- **Customizable** — override any behavior with callbacks
- **TypeScript** — fully typed API
- **Tree-shakeable** — ESM with `sideEffects: false`

## Install

```sh
npm install viewport-lock
```

```sh
# or
bun add viewport-lock
# or
pnpm add viewport-lock
# or
yarn add viewport-lock
```

## Quick start

### Vanilla

```ts
import { createViewportLock } from "viewport-lock";

const unlock = createViewportLock({
  container: document.getElementById("app")!,
});

// later:
unlock();
```

### React

```tsx
import { useRef } from "react";
import { useViewportLock } from "viewport-lock/react";

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  useViewportLock(containerRef);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "clip",
        touchAction: "none",
      }}
    >
      <header>Fixed header</header>
      <main style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <input type="text" />
      </main>
      <footer>Fixed footer</footer>
    </div>
  );
}
```

## How it works

`viewport-lock` composes three independent behaviors:

| Step | What it does | Why |
|------|-------------|-----|
| **1. Resize** | Sets `container.style.height` to `visualViewport.height` on every viewport resize | Keeps your layout sized to the visible area when the keyboard opens/closes |
| **2. Focus intercept** | Catches `touchend` on inputs and calls `focus({ preventScroll: true })` | Stops the browser from scrolling your layout to bring the input into view |
| **3. Scroll reset** | Calls `window.scrollTo(0, 0)` on `visualViewport` scroll events | Safety net in case the viewport drifts from scroll chaining or app backgrounding |

## Required CSS: `touch-action: none`

You **must** set `touch-action: none` on your container element. Without it, the user can drag the visual viewport when the keyboard is open, causing `visualViewport.offsetTop` to become positive and shifting your layout.

`viewport-lock` includes a safety net that calls `window.scrollTo(0, 0)` on visual viewport scroll events, but this alone causes visible flashing. `touch-action: none` prevents the gesture from reaching the viewport in the first place.

Re-enable scrolling on children explicitly:

```css
.container {
  touch-action: none;
}

/* Scrollable children */
.vertical-scroll  { touch-action: pan-y; }
.horizontal-scroll { touch-action: pan-x; }
```

## Composable primitives

The bundled `createViewportLock` / `useViewportLock` composes three independent primitives. Import them individually for full control:

### Vanilla

```ts
import { viewportResize, scrollReset, focusIntercept } from "viewport-lock";

const cleanupResize = viewportResize(document.getElementById("app")!);
const cleanupScroll = scrollReset();
const cleanupFocus = focusIntercept(document.getElementById("app")!);

// Clean up individually
cleanupResize();
cleanupScroll();
cleanupFocus();
```

### React

```tsx
import { useRef } from "react";
import {
  useViewportResize,
  useScrollReset,
  useFocusIntercept,
} from "viewport-lock/react";

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useViewportResize(containerRef);
  useScrollReset();
  useFocusIntercept(containerRef);

  return <div ref={containerRef}>...</div>;
}
```

## Custom callbacks

Override the default behavior of any primitive:

### Vanilla

```ts
const unlock = createViewportLock({
  container: el,
  // Animate height instead of setting it directly
  onResize: (height, container) => {
    container.animate([{ height: `${height}px` }], {
      duration: 200,
      fill: "forwards",
    });
  },
  // Custom scroll handling
  onScroll: () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  },
});
```

### React

```tsx
useViewportResize(containerRef, (height, container) => {
  setKeyboardOpen(height < window.innerHeight);
});
```

## Broadening focus interception

By default, focus interception only applies to elements inside the container. To intercept all focusable elements on the page:

### Vanilla

```ts
createViewportLock({
  container: el,
  eventTarget: document,
});
```

### React

```tsx
const containerRef = useRef<HTMLDivElement>(null);
const documentRef = useRef(document);

useViewportLock(containerRef, { eventTargetRef: documentRef });
```

## Platform gating

This library is primarily useful on iOS Safari. You can conditionally enable it:

```ts
createViewportLock({
  container: el,
  enabled: /iPhone|iPad/.test(navigator.userAgent),
});
```

```tsx
// React
useViewportLock(containerRef, {
  enabled: /iPhone|iPad/.test(navigator.userAgent),
});
```

## API reference

### Vanilla

#### `createViewportLock(options): () => void`

All-in-one lock composing all three primitives.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | `HTMLElement` | *required* | Element to resize with the visual viewport |
| `enabled` | `boolean` | `true` | Whether the lock is active |
| `onResize` | `(height: number, container: HTMLElement) => void` | — | Custom resize handler (replaces default `style.height` update) |
| `onScroll` | `() => void` | — | Custom scroll handler (replaces default `window.scrollTo(0, 0)`) |
| `eventTarget` | `HTMLElement \| Document` | `container` | Where to listen for `touchend` focus interception |

Returns a cleanup function that removes all listeners and restores the container.

#### `viewportResize(container, onResize?): () => void`

Syncs `container.style.height` to `visualViewport.height` on every resize. Pass `onResize` to handle the height yourself. Returns a cleanup function.

#### `scrollReset(onScroll?): () => void`

Calls `window.scrollTo(0, 0)` on every `visualViewport` scroll event. Pass `onScroll` to handle it yourself. Returns a cleanup function.

#### `focusIntercept(target): () => void`

Listens for `touchend` on `target` and intercepts focus on `input`, `textarea`, and `[contenteditable]` elements with `preventDefault()` + `focus({ preventScroll: true })`. Returns a cleanup function.

### React

#### `useViewportLock(containerRef, options?): void`

Hook composing all three primitives. Same options as `createViewportLock` except `eventTarget` becomes `eventTargetRef` (a `RefObject`).

#### `useViewportResize(containerRef, onResize?): void`

Hook wrapping `viewportResize`.

#### `useScrollReset(onScroll?): void`

Hook wrapping `scrollReset`.

#### `useFocusIntercept(targetRef): void`

Hook wrapping `focusIntercept`.

## Browser support

| Browser | Support |
|---------|---------|
| iOS Safari 15.5+ | Full support |
| Chrome Android | Works but less necessary (Chrome handles fixed elements better) |
| Desktop browsers | No-op (no `visualViewport` resize from keyboard) |

The library gracefully degrades — if `visualViewport` is not available, all functions return no-op cleanup functions. Safe to import in SSR environments (Next.js, Remix, etc.) — all browser API access is deferred and guarded.

## Known limitations

- **Accessibility trade-off**: This library is designed for native-app-like experiences where the viewport is fully controlled. Combined with `touch-action: none` on your container, it suppresses scroll behaviors that assistive technologies (VoiceOver, TalkBack, Switch Access) may rely on. If your app needs to support these, set `enabled: false` or gate on user preference.

- **`<select>` excluded**: `<select>` elements are intentionally excluded from focus interception because they need the native picker.

- **`click` events suppressed on inputs**: Focus interception calls `preventDefault()` on `touchend`, which suppresses the synthetic `click` event browsers normally fire after a touch sequence. Any `click` handlers on intercepted elements (`input`, `textarea`, `[contenteditable]`) won't fire from touch interactions.

## FAQ

<details>
<summary><strong>Do I need this on Android?</strong></summary>

Usually not. Chrome on Android handles fixed-position elements much better when the keyboard opens. However, `viewport-lock` works on Android too if you want consistent behavior across platforms.
</details>

<details>
<summary><strong>Why not use <code>100dvh</code> / <code>100svh</code>?</strong></summary>

`dvh` and `svh` track the viewport size but don't account for the visual viewport shrinking when the keyboard opens on iOS. They reflect the layout viewport, not the visual viewport. `viewport-lock` uses the `visualViewport` API to get the actual visible area.
</details>

<details>
<summary><strong>Can I use this with a CSS-in-JS library?</strong></summary>

Yes. Use the `onResize` callback to sync the height however you'd like — state, CSS variables, animation, etc. The library won't touch `style.height` when you provide a callback.
</details>

<details>
<summary><strong>Why does focus interception use <code>touchend</code> instead of <code>focus</code>?</strong></summary>

By the time a `focus` event fires, the browser has already decided to scroll. Intercepting at `touchend` — before focus occurs — lets us call `focus({ preventScroll: true })` to prevent the scroll entirely.
</details>

<details>
<summary><strong>What happens when the library is disabled or cleaned up?</strong></summary>

The cleanup function removes all event listeners and restores the container's original `style.height` value (unless you provided a custom `onResize`).
</details>

## License

MIT
