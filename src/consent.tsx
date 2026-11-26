import { createEffect, onCleanup, Show, type JSX } from "solid-js";

const space = "--consent-dock-space";
type Target = () => HTMLElement | null | undefined;

export interface ConsentDockProps {
  open: boolean;
  /** Request focus on this opening (or on a false → true change while open). */
  focusOnOpen?: boolean;
  /** Resolved after close if focus was in the dock or a choice closed it. */
  returnFocusTo: Target;
  /** Stable caller-owned element; use one open dock per scope. */
  clearanceScope: Target;
  /** Accessible name of the nonmodal region. */
  label: string;
  children?: JSX.Element;
  /** Use text or non-interactive nodes in the two native buttons. */
  acceptLabel: JSX.Element;
  rejectLabel: JSX.Element;
  onAccept: () => void;
  onReject: () => void;
}

/**
 * Import `@sylphx/solid-web/consent.css` in the browser's stylesheet graph.
 * On the clearance scope, reserve `var(--consent-dock-space, 0px)` in padding
 * and scroll-padding, adding independent offsets with `calc()`. The measured
 * border box includes the dock's safe-area padding; it excludes any caller-set
 * `--consent-dock-bottom` (e.g. a separate fixed bar beneath the dock).
 * Mount outside transformed/contained ancestors that locally fix-position it.
 * The caller decides when to close; neither button persists any decision.
 */
export function ConsentDock(props: ConsentDockProps): JSX.Element {
  function OpenDock() {
    let dock!: HTMLElement;
    let focusAtChoice: Element | null = null;

    createEffect(() => {
      const scope = props.clearanceScope();
      if (!scope) return;
      const style = scope.style;
      const value = style.getPropertyValue(space);
      const priority = style.getPropertyPriority(space);
      let written = "";
      const measure = () => {
        const height = dock.getBoundingClientRect().height + "px";
        if (height !== written) {
          style.setProperty(space, height);
          written = height;
        }
      };
      measure();
      const Observer = dock.ownerDocument.defaultView?.ResizeObserver;
      const observer = Observer && new Observer(measure);
      observer?.observe(dock, { box: "border-box" });
      onCleanup(() => {
        observer?.disconnect();
        if (style.getPropertyValue(space) !== written || style.getPropertyPriority(space)) return;
        if (value) style.setProperty(space, value, priority);
        else style.removeProperty(space);
      });
    });

    createEffect(() => {
      if (props.focusOnOpen) dock.focus({ preventScroll: true });
    });

    onCleanup(() => {
      if (!dock) return; // Solid SSR disposes owners without setting DOM refs.
      const doc = dock.ownerDocument;
      const before = doc.activeElement;
      if (!dock.contains(before) && before !== focusAtChoice) return;
      queueMicrotask(() => {
        // Do not override a new focus move made during the same update.
        if (doc.activeElement !== before && doc.activeElement !== doc.body) return;
        const target = props.returnFocusTo();
        if (target?.isConnected) target.focus({ preventScroll: true });
      });
    });

    function choose(callback: () => void) {
      // Some touch browsers activate a button without moving focus to it.
      focusAtChoice = dock.ownerDocument.activeElement;
      callback();
    }

    return (
      <section ref={dock} class="consent-dock" aria-label={props.label} tabIndex={-1}>
        <div class="consent-dock__layout">
          <div class="consent-dock__content">{props.children}</div>
          <div class="consent-dock__choices">
            <button type="button" onClick={() => choose(props.onAccept)}>{props.acceptLabel}</button>
            <button type="button" onClick={() => choose(props.onReject)}>{props.rejectLabel}</button>
          </div>
        </div>
      </section>
    );
  }

  return <Show when={props.open}><OpenDock /></Show>;
}
