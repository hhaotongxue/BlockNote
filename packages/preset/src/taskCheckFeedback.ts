import { playCheckAnimation } from "./checkAnimation.js";
import type { MouseEvent } from "react";

/** Reuse the former editor's feedback without changing the checkbox command. */
export function taskCheckFeedback(event: MouseEvent<HTMLDivElement>) {
  const input = event.target;
  if (
    !(input instanceof HTMLInputElement) ||
    input.type !== "checkbox" ||
    !input.checked ||
    input.disabled ||
    !input.closest('[data-content-type="checkListItem"]') ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  const rect = input.getBoundingClientRect();
  // Keep temporary animation nodes outside ProseMirror's observed document.
  queueMicrotask(() => {
    if (event.defaultPrevented) {
      return;
    }
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = `position:fixed;pointer-events:none;z-index:20;left:${rect.left}px;top:${rect.top}px;width:20px;height:20px;`;
    document.body.append(host);
    void playCheckAnimation(host)
      .catch(() => {
        // Animation cancellation must not affect the completed editor action.
      })
      .finally(() => host.remove());
  });
}
