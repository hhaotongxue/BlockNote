import type {
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
  PartialBlock,
} from "@blocknote/core";

export type MediaDropSide = "left" | "right" | "before" | "after";

export function mediaRatio(
  width: number,
  height: number,
  fallback: string,
): number {
  if (width > 0 && height > 0) {
    return width / height;
  }
  const [w, h] = fallback.split(":").map(Number);
  return w > 0 && h > 0 ? w / h : 16 / 9;
}

function collapseRow<
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>(editor: BlockNoteEditor<B, I, S>, id?: string) {
  if (!id) {
    return;
  }
  const row = editor.getBlock(id);
  if (row?.type === "mediaRow" && row.children.length < 2) {
    editor.replaceBlocks([id], row.children);
  }
}

/** One transaction preserves card IDs (including task bindings) and one-step undo. */
export function moveMediaCard<
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>(
  editor: BlockNoteEditor<B, I, S>,
  sourceId: string,
  targetId: string,
  side: MediaDropSide,
) {
  if (!editor.schema.blockSchema.mediaRow) {
    return;
  }
  const source = editor.getBlock(sourceId);
  const target = editor.getBlock(targetId);
  if (
    !source ||
    source.type !== "aiImage" ||
    !target ||
    sourceId === targetId
  ) {
    return;
  }
  const beside = side === "left" || side === "right";
  if (beside && target.type !== "aiImage") {
    return;
  }
  const sourceParent = editor.getParentBlock(sourceId);
  const targetParent = editor.getParentBlock(targetId);
  // Only image rows are managed here; arbitrary nested document structures stay native.
  if (source.children.length || (target.children.length && beside)) {
    return;
  }
  editor.transact(() => {
    editor.removeBlocks([sourceId]);
    if (beside) {
      if (targetParent?.type === "mediaRow") {
        editor.insertBlocks(
          [source],
          targetId,
          side === "left" ? "before" : "after",
        );
      } else {
        editor.replaceBlocks(
          [targetId],
          [
            {
              type: "mediaRow",
              children: side === "left" ? [source, target] : [target, source],
            } as PartialBlock<B, I, S>,
          ],
        );
      }
    } else {
      // Dropping above/below a row extracts the card, rather than nesting it in that row.
      editor.insertBlocks(
        [source],
        targetParent?.type === "mediaRow" ? targetParent.id : targetId,
        side,
      );
    }
    collapseRow(editor, sourceParent?.id);
  });
}

export function removeMediaCard<
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>(editor: BlockNoteEditor<B, I, S>, id: string) {
  const parent = editor.getParentBlock(id);
  editor.transact(() => {
    editor.removeBlocks([id]);
    collapseRow(editor, parent?.id);
  });
}

/** Capture only our card drags; file uploads and ordinary block drags retain native behavior. */
export function installMediaDrag<
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>(editor: BlockNoteEditor<B, I, S>, root: HTMLElement) {
  let sourceId = "";
  let marker: HTMLElement | null = null;
  let destination: { id: string; side: MediaDropSide } | undefined;
  function clearMarker() {
    marker?.remove();
    marker = null;
    destination = undefined;
  }
  function finish() {
    sourceId = "";
    clearMarker();
  }
  function start(event: DragEvent) {
    const element = event.target instanceof Element ? event.target : null;
    const card = element?.closest<HTMLElement>(
      '.bn-media-card[data-kind="aiImage"]',
    );
    if (
      !editor.isEditable ||
      !card ||
      !event.dataTransfer ||
      element?.closest("button, input, textarea")
    ) {
      return;
    }
    sourceId = card.dataset.blockId || "";
    event.dataTransfer.setData("application/x-blocknote-media", sourceId);
    event.dataTransfer.effectAllowed = "move";
    event.stopPropagation();
  }
  function over(event: DragEvent) {
    if (!sourceId || !editor.isEditable) {
      return;
    }
    clearMarker();
    const element = event.target instanceof Element ? event.target : null;
    const outer = element?.closest<HTMLElement>(".bn-block-outer[data-id]");
    const id = outer?.dataset.id;
    if (!outer || !id || id === sourceId || !root.contains(outer)) {
      return;
    }
    const block = editor.getBlock(id);
    if (!block) {
      return;
    }
    const bounds = outer.getBoundingClientRect();
    const y = (event.clientY - bounds.top) / bounds.height;
    const side: MediaDropSide =
      block.type === "aiImage" && y > 0.2 && y < 0.8
        ? event.clientX < bounds.left + bounds.width / 2
          ? "left"
          : "right"
        : y < 0.5
          ? "before"
          : "after";
    const parent = editor.getParentBlock(id);
    const anchor =
      (side === "before" || side === "after") && parent?.type === "mediaRow"
        ? outer.parentElement?.closest<HTMLElement>(".bn-block-outer") || outer
        : outer;
    const rect = anchor.getBoundingClientRect();
    marker = document.createElement("div");
    marker.className = "bn-media-drop-indicator";
    marker.dataset.side = side;
    const vertical = side === "left" || side === "right";
    Object.assign(marker.style, {
      left: `${side === "right" ? rect.right + 4 : rect.left - (vertical ? 6 : 0)}px`,
      top: `${side === "after" ? rect.bottom : rect.top - (vertical ? 0 : 3)}px`,
      width: `${vertical ? 3 : rect.width}px`,
      height: `${vertical ? rect.height : 3}px`,
    });
    document.body.append(marker);
    destination = { id, side };
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  }
  function drop(event: DragEvent) {
    if (!sourceId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (destination) {
      moveMediaCard(editor, sourceId, destination.id, destination.side);
    }
    finish();
  }
  function leave(event: DragEvent) {
    if (
      !(event.relatedTarget instanceof Node) ||
      !root.contains(event.relatedTarget)
    ) {
      clearMarker();
    }
  }
  root.addEventListener("dragstart", start, true);
  root.addEventListener("dragover", over, true);
  root.addEventListener("drop", drop, true);
  root.addEventListener("dragleave", leave);
  window.addEventListener("dragend", finish);
  return () => {
    finish();
    root.removeEventListener("dragstart", start, true);
    root.removeEventListener("dragover", over, true);
    root.removeEventListener("drop", drop, true);
    root.removeEventListener("dragleave", leave);
    window.removeEventListener("dragend", finish);
  };
}
