import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  viewportResize,
  scrollReset,
  focusIntercept,
  createViewportLock,
} from "../src/index";

// ---------------------------------------------------------------------------
// visualViewport mock
// ---------------------------------------------------------------------------

type VVListener = (e: Event) => void;

function createMockViewport(initialHeight = 800) {
  const listeners: Record<string, VVListener[]> = {};
  const vv = {
    height: initialHeight,
    offsetTop: 0,
    addEventListener(type: string, fn: VVListener) {
      (listeners[type] ??= []).push(fn);
    },
    removeEventListener(type: string, fn: VVListener) {
      const arr = listeners[type];
      if (arr) listeners[type] = arr.filter((f) => f !== fn);
    },
    fire(type: string) {
      for (const fn of listeners[type] ?? []) fn(new Event(type));
    },
    listenerCount(type: string) {
      return (listeners[type] ?? []).length;
    },
  };
  return vv;
}

let originalVV: VisualViewport | null;
let originalScrollTo: typeof window.scrollTo;

beforeEach(() => {
  originalVV = globalThis.visualViewport;
  originalScrollTo = globalThis.window.scrollTo;
});

afterEach(() => {
  Object.defineProperty(globalThis, "visualViewport", {
    value: originalVV,
    configurable: true,
  });
  globalThis.window.scrollTo = originalScrollTo;
});

function setViewport(vv: ReturnType<typeof createMockViewport>) {
  Object.defineProperty(globalThis, "visualViewport", {
    value: vv,
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// viewportResize
// ---------------------------------------------------------------------------

describe("viewportResize", () => {
  test("sets container height to visualViewport.height immediately", () => {
    const vv = createMockViewport(600);
    setViewport(vv);
    const el = document.createElement("div");

    viewportResize(el);
    expect(el.style.height).toBe("600px");
  });

  test("updates container height on viewport resize", () => {
    const vv = createMockViewport(800);
    setViewport(vv);
    const el = document.createElement("div");

    viewportResize(el);
    expect(el.style.height).toBe("800px");

    vv.height = 400;
    vv.fire("resize");
    expect(el.style.height).toBe("400px");
  });

  test("restores original height on cleanup", () => {
    const vv = createMockViewport(600);
    setViewport(vv);
    const el = document.createElement("div");
    el.style.height = "100vh";

    const cleanup = viewportResize(el);
    expect(el.style.height).toBe("600px");

    cleanup();
    expect(el.style.height).toBe("100vh");
  });

  test("removes listener on cleanup", () => {
    const vv = createMockViewport(600);
    setViewport(vv);
    const el = document.createElement("div");

    const cleanup = viewportResize(el);
    expect(vv.listenerCount("resize")).toBe(1);

    cleanup();
    expect(vv.listenerCount("resize")).toBe(0);
  });

  test("calls onResize callback instead of setting height", () => {
    const vv = createMockViewport(600);
    setViewport(vv);
    const el = document.createElement("div");
    const onResize = mock(() => {});

    viewportResize(el, onResize);
    expect(onResize).toHaveBeenCalledWith(600, el);
    expect(el.style.height).toBe("");
  });

  test("does not restore height when custom onResize is provided", () => {
    const vv = createMockViewport(600);
    setViewport(vv);
    const el = document.createElement("div");
    el.style.height = "100vh";

    const cleanup = viewportResize(el, () => {});
    cleanup();
    expect(el.style.height).toBe("100vh");
  });

  test("preserves original height across multiple instances", () => {
    const vv = createMockViewport(600);
    setViewport(vv);
    const el = document.createElement("div");
    el.style.height = "100vh";

    const cleanup1 = viewportResize(el);
    expect(el.style.height).toBe("600px");

    const cleanup2 = viewportResize(el);
    expect(el.style.height).toBe("600px");

    cleanup2();
    cleanup1();
    expect(el.style.height).toBe("100vh");
  });

  test("returns no-op when visualViewport is unavailable", () => {
    Object.defineProperty(globalThis, "visualViewport", {
      value: null,
      configurable: true,
    });
    const el = document.createElement("div");

    const cleanup = viewportResize(el);
    expect(el.style.height).toBe("");
    cleanup(); // should not throw
  });
});

// ---------------------------------------------------------------------------
// scrollReset
// ---------------------------------------------------------------------------

describe("scrollReset", () => {
  test("calls window.scrollTo on viewport scroll", () => {
    const vv = createMockViewport();
    setViewport(vv);
    const scrollTo = mock(() => {});
    globalThis.window.scrollTo = scrollTo as any;
    Object.defineProperty(window, "scrollY", { value: 100, configurable: true });

    scrollReset();
    vv.fire("scroll");
    expect(scrollTo).toHaveBeenCalledWith(0, 0);

    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  test("calls custom onScroll instead of scrollTo", () => {
    const vv = createMockViewport();
    setViewport(vv);
    const onScroll = mock(() => {});

    scrollReset(onScroll);
    vv.fire("scroll");
    expect(onScroll).toHaveBeenCalledTimes(1);
  });

  test("removes listener on cleanup", () => {
    const vv = createMockViewport();
    setViewport(vv);

    const cleanup = scrollReset(() => {});
    expect(vv.listenerCount("scroll")).toBe(1);

    cleanup();
    expect(vv.listenerCount("scroll")).toBe(0);
  });

  test("returns no-op when visualViewport is unavailable", () => {
    Object.defineProperty(globalThis, "visualViewport", {
      value: null,
      configurable: true,
    });

    const cleanup = scrollReset();
    cleanup(); // should not throw
  });
});

// ---------------------------------------------------------------------------
// focusIntercept
// ---------------------------------------------------------------------------

describe("focusIntercept", () => {
  function fireTouchEnd(target: HTMLElement, container: HTMLElement) {
    const event = new Event("touchend", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: target });
    container.dispatchEvent(event);
    return event;
  }

  test("intercepts focus on input elements", () => {
    const container = document.createElement("div");
    const input = document.createElement("input");
    container.appendChild(input);
    const focusMock = mock(() => {});
    input.focus = focusMock;

    focusIntercept(container);
    const event = fireTouchEnd(input, container);

    expect(event.defaultPrevented).toBe(true);
    expect(focusMock).toHaveBeenCalledWith({ preventScroll: true });
  });

  test("intercepts focus on textarea elements", () => {
    const container = document.createElement("div");
    const textarea = document.createElement("textarea");
    container.appendChild(textarea);
    const focusMock = mock(() => {});
    textarea.focus = focusMock;

    focusIntercept(container);
    fireTouchEnd(textarea, container);

    expect(focusMock).toHaveBeenCalledWith({ preventScroll: true });
  });

  test("intercepts focus on contenteditable elements", () => {
    const container = document.createElement("div");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    container.appendChild(editable);
    const focusMock = mock(() => {});
    editable.focus = focusMock;

    focusIntercept(container);
    fireTouchEnd(editable, container);

    expect(focusMock).toHaveBeenCalledWith({ preventScroll: true });
  });

  test("intercepts focus on child of contenteditable", () => {
    const container = document.createElement("div");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const span = document.createElement("span");
    editable.appendChild(span);
    container.appendChild(editable);
    const focusMock = mock(() => {});
    editable.focus = focusMock;

    focusIntercept(container);
    fireTouchEnd(span, container);

    expect(focusMock).toHaveBeenCalledWith({ preventScroll: true });
  });

  test("intercepts focus on contenteditable with empty string", () => {
    const container = document.createElement("div");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "");
    container.appendChild(editable);
    const focusMock = mock(() => {});
    editable.focus = focusMock;

    focusIntercept(container);
    fireTouchEnd(editable, container);

    expect(focusMock).toHaveBeenCalledWith({ preventScroll: true });
  });

  test("intercepts focus on contenteditable='plaintext-only'", () => {
    const container = document.createElement("div");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "plaintext-only");
    container.appendChild(editable);
    const focusMock = mock(() => {});
    editable.focus = focusMock;

    focusIntercept(container);
    fireTouchEnd(editable, container);

    expect(focusMock).toHaveBeenCalledWith({ preventScroll: true });
  });

  test("does not intercept contenteditable='false'", () => {
    const container = document.createElement("div");
    const parent = document.createElement("div");
    parent.setAttribute("contenteditable", "true");
    const child = document.createElement("div");
    child.setAttribute("contenteditable", "false");
    parent.appendChild(child);
    container.appendChild(parent);

    focusIntercept(container);
    const event = fireTouchEnd(child, container);

    expect(event.defaultPrevented).toBe(false);
  });

  test("does not intercept select elements", () => {
    const container = document.createElement("div");
    const select = document.createElement("select");
    container.appendChild(select);

    focusIntercept(container);
    const event = fireTouchEnd(select, container);

    expect(event.defaultPrevented).toBe(false);
  });

  test("does not intercept buttons", () => {
    const container = document.createElement("div");
    const button = document.createElement("button");
    container.appendChild(button);

    focusIntercept(container);
    const event = fireTouchEnd(button, container);

    expect(event.defaultPrevented).toBe(false);
  });

  test("does not intercept plain divs", () => {
    const container = document.createElement("div");
    const div = document.createElement("div");
    container.appendChild(div);

    focusIntercept(container);
    const event = fireTouchEnd(div, container);

    expect(event.defaultPrevented).toBe(false);
  });

  test("removes listener on cleanup", () => {
    const container = document.createElement("div");
    const input = document.createElement("input");
    container.appendChild(input);
    const focusMock = mock(() => {});
    input.focus = focusMock;

    const cleanup = focusIntercept(container);
    cleanup();

    fireTouchEnd(input, container);
    expect(focusMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createViewportLock
// ---------------------------------------------------------------------------

describe("createViewportLock", () => {
  test("composes all three primitives", () => {
    const vv = createMockViewport(600);
    setViewport(vv);
    const el = document.createElement("div");
    const scrollTo = mock(() => {});
    globalThis.window.scrollTo = scrollTo as any;
    Object.defineProperty(window, "scrollY", { value: 100, configurable: true });

    createViewportLock({ container: el });

    expect(el.style.height).toBe("600px");

    vv.fire("scroll");
    expect(scrollTo).toHaveBeenCalledWith(0, 0);

    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  test("returns no-op when disabled", () => {
    const vv = createMockViewport(600);
    setViewport(vv);
    const el = document.createElement("div");

    createViewportLock({ container: el, enabled: false });

    expect(el.style.height).toBe("");
    expect(vv.listenerCount("resize")).toBe(0);
    expect(vv.listenerCount("scroll")).toBe(0);
  });

  test("cleans up all listeners", () => {
    const vv = createMockViewport(600);
    setViewport(vv);
    const el = document.createElement("div");

    const cleanup = createViewportLock({ container: el });
    expect(vv.listenerCount("resize")).toBe(1);
    expect(vv.listenerCount("scroll")).toBe(1);

    cleanup();
    expect(vv.listenerCount("resize")).toBe(0);
    expect(vv.listenerCount("scroll")).toBe(0);
  });

  test("passes custom onResize and onScroll", () => {
    const vv = createMockViewport(600);
    setViewport(vv);
    const el = document.createElement("div");
    const onResize = mock(() => {});
    const onScroll = mock(() => {});

    createViewportLock({ container: el, onResize, onScroll });

    expect(onResize).toHaveBeenCalledWith(600, el);

    vv.fire("scroll");
    expect(onScroll).toHaveBeenCalledTimes(1);
  });

  test("uses custom eventTarget for focus interception", () => {
    const vv = createMockViewport(600);
    setViewport(vv);
    const container = document.createElement("div");
    const externalTarget = document.createElement("div");
    const input = document.createElement("input");
    externalTarget.appendChild(input);
    const focusMock = mock(() => {});
    input.focus = focusMock;

    createViewportLock({ container, eventTarget: externalTarget });

    const event = new Event("touchend", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: input });
    externalTarget.dispatchEvent(event);

    expect(focusMock).toHaveBeenCalledWith({ preventScroll: true });
  });
});
