import { useLayoutEffect } from "react";
import type {
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import {
  restrictedBlocks,
  introducesRestrictedBlocks,
} from "./blockCreationPolicy.js";

export function useCreationPolicy<
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>(editor: BlockNoteEditor<B, I, S>) {
  useLayoutEffect(() => {
    let legacy: Map<string, number> | undefined;
    return editor.onBeforeChange(({ tr, getChanges }) => {
      if (!tr.docChanged) {
        return;
      }
      const before = restrictedBlocks(tr.before);
      legacy ??= before;
      const after = restrictedBlocks(tr.doc);
      if (!introducesRestrictedBlocks(before, after)) {
        return;
      }
      // Undo may restore an existing legacy block; it may not resurrect a new
      // prohibited block. Normal paste, shortcuts and API calls get no bypass.
      const changes = getChanges();
      const history =
        changes.length > 0 &&
        changes.every((change) =>
          ["undo", "redo", "undo-redo"].includes(change.source.type),
        );
      if (history) {
        const allowed = new Map(before);
        for (const [key, count] of legacy) {
          allowed.set(key, Math.max(count, allowed.get(key) || 0));
        }
        if (!introducesRestrictedBlocks(allowed, after)) {
          return;
        }
      }
      return false;
    });
  }, [editor]);
}
