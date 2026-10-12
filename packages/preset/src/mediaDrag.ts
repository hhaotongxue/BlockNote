import type {
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import { moveMediaCard, type MediaDropSide } from "./mediaLayout.js";

export function dropSide(
  rect: DOMRect,
  x: number,
  y: number,
  image: boolean,
): MediaDropSide {
  // A small top/bottom band leaves most of the image available for side-by-side drops.
  const band = Math.min(28, rect.height * 0.15);
  if (image && y >= rect.top + band && y <= rect.bottom - band) {
    return x < rect.left + rect.width / 2 ? "left" : "right";
  }
  return y < rect.top + rect.height / 2 ? "before" : "after";
}

function scrollContainer(root: HTMLElement): HTMLElement {
  for (let node = root.parentElement; node; node = node.parentElement) {
    if (
      /(auto|scroll)/.test(getComputedStyle(node).overflowY) &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
  }
  return (document.scrollingElement as HTMLElement) || document.documentElement;
}

/** One drag session. Only the final drop edits the document. */
export function installMediaDrag<
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>(editor: BlockNoteEditor<B, I, S>, root: HTMLElement) {
  let session:
    | {
        id: string;
        x: number;
        y: number;
        marker: HTMLDivElement;
        dim: HTMLStyleElement;
        scroll: HTMLElement;
        frame: number;
        lastTime: number;
        destination?: { id: string; side: MediaDropSide };
      }
    | undefined;

  function finish() {
    if (!session) {
      return;
    }
    cancelAnimationFrame(session.frame);
    session.marker.remove();
    session.dim.remove();
    session = undefined;
  }

  function locate() {
    const drag = session;
    if (!drag) {
      return;
    }
    drag.destination = undefined;
    drag.marker.hidden = true;
    const viewport =
      drag.scroll === document.scrollingElement ||
      drag.scroll === document.documentElement
        ? { left: 0, right: innerWidth, top: 0, bottom: innerHeight }
        : drag.scroll.getBoundingClientRect();
    if (
      drag.x < viewport.left ||
      drag.x > viewport.right ||
      drag.y < viewport.top ||
      drag.y > viewport.bottom
    ) {
      return;
    }
    // Geometry includes the gaps between blocks; event.target can be a toolbar or whitespace.
    let closest:
      | { node: HTMLElement; rect: DOMRect; distance: number }
      | undefined;
    for (const node of root.querySelectorAll<HTMLElement>(
      ".bn-block-outer[data-id]",
    )) {
      if (node.dataset.id === drag.id) {
        continue;
      }
      const block = editor.getBlock(node.dataset.id!);
      if (!block || block.type === "mediaRow") {
        continue;
      }
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        continue;
      }
      const dx = Math.max(rect.left - drag.x, 0, drag.x - rect.right);
      const dy = Math.max(rect.top - drag.y, 0, drag.y - rect.bottom);
      const distance = dx * dx + dy * dy;
      if (!closest || distance < closest.distance) {
        closest = { node, rect, distance };
      }
    }
    if (!closest) {
      return;
    }
    const id = closest.node.dataset.id!;
    const side = dropSide(
      closest.rect,
      drag.x,
      drag.y,
      editor.getBlock(id)?.type === "aiImage",
    );
    const parent = editor.getParentBlock(id);
    const horizontal = side === "before" || side === "after";
    const anchor =
      horizontal && parent?.type === "mediaRow"
        ? closest.node.parentElement?.closest<HTMLElement>(".bn-block-outer") ||
          closest.node
        : closest.node;
    const rect = anchor.getBoundingClientRect();
    Object.assign(drag.marker.style, {
      left: `${side === "right" ? rect.right + 4 : rect.left - (horizontal ? 0 : 6)}px`,
      top: `${side === "after" ? rect.bottom : rect.top - (horizontal ? 3 : 0)}px`,
      width: `${horizontal ? rect.width : 3}px`,
      height: `${horizontal ? 3 : rect.height}px`,
    });
    drag.marker.dataset.side = side;
    drag.marker.hidden = false;
    drag.destination = { id, side };
  }

  function tick(time: number) {
    const drag = session;
    if (!drag) {
      return;
    }
    const rect =
      drag.scroll === document.scrollingElement ||
      drag.scroll === document.documentElement
        ? { top: 0, bottom: innerHeight, left: 0, right: innerWidth }
        : drag.scroll.getBoundingClientRect();
    const edge = Math.min(72, (rect.bottom - rect.top) / 3);
    const elapsed = Math.min(32, time - drag.lastTime || 16);
    drag.lastTime = time;
    if (
      drag.x >= rect.left &&
      drag.x <= rect.right &&
      drag.y >= rect.top &&
      drag.y <= rect.bottom
    ) {
      const speed =
        drag.y < rect.top + edge
          ? -Math.min(1, (rect.top + edge - drag.y) / edge)
          : drag.y > rect.bottom - edge
            ? Math.min(1, (drag.y - rect.bottom + edge) / edge)
            : 0;
      if (speed) {
        drag.scroll.scrollTop += speed * elapsed * 0.7;
      }
    }
    locate();
    drag.frame = requestAnimationFrame(tick);
  }

  function start(event: DragEvent) {
    const element = event.target instanceof Element ? event.target : null;
    const card = element?.closest<HTMLElement>(
      '.bn-media-card[data-kind="aiImage"]',
    );
    if (
      !editor.isEditable ||
      !card ||
      !root.contains(card) ||
      !event.dataTransfer ||
      element?.closest("button,input,textarea")
    ) {
      return;
    }
    finish();
    const id = card.dataset.blockId!;
    event.dataTransfer.setData("application/x-blocknote-media", id);
    event.dataTransfer.effectAllowed = "move";
    const marker = document.createElement("div");
    marker.className = "bn-media-drop-indicator";
    marker.hidden = true;
    const dim = document.createElement("style");
    // A stylesheet outside the editor avoids triggering ProseMirror's DOM observer.
    dim.textContent = `.bn-media-card[data-block-id=${JSON.stringify(id)}] { opacity: .35; }`;
    document.body.append(marker);
    session = {
      id,
      x: event.clientX,
      y: event.clientY,
      marker,
      dim,
      scroll: scrollContainer(root),
      frame: 0,
      lastTime: 0,
    };
    session.frame = requestAnimationFrame(tick);
    event.stopPropagation();
  }
  function over(event: DragEvent) {
    if (!session) {
      return;
    }
    // Wait for the browser to enter dragging before changing source appearance.
    if (!session.dim.isConnected) {
      document.body.append(session.dim);
    }
    session.x = event.clientX;
    session.y = event.clientY;
    locate();
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = session.destination ? "move" : "none";
    }
  }
  function drop(event: DragEvent) {
    if (!session) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const { id, destination } = session;
    finish();
    if (destination && editor.isEditable) {
      moveMediaCard(editor, id, destination.id, destination.side);
    }
  }
  function escape(event: KeyboardEvent) {
    if (event.key === "Escape") {
      finish();
    }
  }
  // Keep the original editor-local drag entry and the browser-native drag preview.
  root.addEventListener("dragstart", start, true);
  root.addEventListener("dragover", over, true);
  root.addEventListener("drop", drop, true);
  window.addEventListener("dragend", finish, true);
  window.addEventListener("keydown", escape, true);
  return () => {
    finish();
    root.removeEventListener("dragstart", start, true);
    root.removeEventListener("dragover", over, true);
    root.removeEventListener("drop", drop, true);
    window.removeEventListener("dragend", finish, true);
    window.removeEventListener("keydown", escape, true);
  };
}
