import { useEffect, useRef, type RefObject } from "react";
import {
  createViewportLock,
  viewportResize,
  scrollReset,
  focusIntercept,
} from "./index";

// ---------------------------------------------------------------------------
// Primitive hooks
// ---------------------------------------------------------------------------

/**
 * Resizes the referenced element's height to match `visualViewport.height`.
 *
 * @param containerRef Ref to the container element.
 * @param onResize     Optional callback. When provided the hook will **not**
 *                     set `container.style.height` — you own the side-effect.
 */
export function useViewportResize(
  containerRef: RefObject<HTMLElement | null>,
  onResize?: (height: number, container: HTMLElement) => void,
): void {
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    return viewportResize(
      container,
      onResize ? (h, c) => onResizeRef.current?.(h, c) : undefined,
    );
  }, [containerRef, !!onResize]);
}

/**
 * Resets layout viewport scroll when the visual viewport scrolls.
 *
 * @param onScroll Optional callback. When provided the hook will **not** call
 *                 `window.scrollTo(0, 0)` — you own the side-effect.
 */
export function useScrollReset(onScroll?: () => void): void {
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;

  useEffect(() => {
    return scrollReset(
      onScroll ? () => onScrollRef.current?.() : undefined,
    );
  }, [!!onScroll]);
}

/**
 * Intercepts `touchend` on focusable elements and calls
 * `preventDefault()` + `focus({ preventScroll: true })`.
 *
 * @param targetRef Ref to the element on which to listen for `touchend`.
 */
export function useFocusIntercept(
  targetRef: RefObject<HTMLElement | Document | null>,
): void {
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    return focusIntercept(target);
  }, [targetRef]);
}

// ---------------------------------------------------------------------------
// Bundled convenience hook
// ---------------------------------------------------------------------------

export interface UseViewportLockOptions {
  /**
   * Whether the lock is enabled. Defaults to `true`.
   */
  enabled?: boolean;
  /**
   * Custom handler called with the new viewport height on every resize.
   * When provided the hook will **not** set `container.style.height`.
   */
  onResize?: (height: number, container: HTMLElement) => void;
  /**
   * Custom handler called when the visual viewport scrolls.
   * When provided the hook will **not** call `window.scrollTo(0, 0)`.
   */
  onScroll?: () => void;
  /**
   * Ref to the element on which to listen for `touchend` focus interception.
   * Defaults to the container ref.
   */
  eventTargetRef?: RefObject<HTMLElement | Document | null>;
}

/**
 * React hook that locks the viewport so fixed headers/footers stay in place
 * when the virtual keyboard opens.
 *
 * @param containerRef Ref to the container element.
 * @param options      Optional configuration.
 *
 * @example
 * ```tsx
 * function App() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   useViewportLock(containerRef);
 *
 *   return (
 *     <div ref={containerRef} style={{ position: "fixed", inset: 0 }}>
 *       <input type="text" />
 *     </div>
 *   );
 * }
 * ```
 */
export function useViewportLock(
  containerRef: RefObject<HTMLElement | null>,
  options?: UseViewportLockOptions,
): void {
  const enabled = options?.enabled ?? true;
  const onResizeRef = useRef(options?.onResize);
  const onScrollRef = useRef(options?.onScroll);
  onResizeRef.current = options?.onResize;
  onScrollRef.current = options?.onScroll;

  const eventTargetRef = options?.eventTargetRef ?? containerRef;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    return createViewportLock({
      container,
      enabled,
      onResize: options?.onResize
        ? (h, c) => onResizeRef.current?.(h, c)
        : undefined,
      onScroll: options?.onScroll
        ? () => onScrollRef.current?.()
        : undefined,
      eventTarget: eventTargetRef.current ?? container,
    });
  }, [containerRef, eventTargetRef, enabled, !!options?.onResize, !!options?.onScroll]);
}
