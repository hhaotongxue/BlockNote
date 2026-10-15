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
  if (!source || source.type !== "image" || !target || sourceId === targetId) {
    return;
  }
  const beside = side === "left" || side === "right";
  if (beside && target.type !== "image") {
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
