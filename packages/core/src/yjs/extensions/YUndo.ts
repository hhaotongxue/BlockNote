import { Plugin } from "prosemirror-state";
import {
  redoCommand,
  undoCommand,
  ySyncPluginKey,
  yUndoPlugin,
} from "y-prosemirror";
import type { UndoManager } from "yjs";
import { createExtension } from "../../editor/BlockNoteExtension.js";

export const YUndoExtension = createExtension(({ editor }) => {
  const upstream = yUndoPlugin();
  const managers = new Set<UndoManager>();
  const plugin = new Plugin({
    ...upstream.spec,
    view(view) {
      const state = upstream.getState(view.state)!;
      const manager = state.undoManager;
      // The document/editor owns history; a view may be detached and remounted.
      // y-prosemirror's default view.destroy destroys the manager too early.
      if (!managers.has(manager)) {
        managers.add(manager);
        editor._tiptapEditor.once("destroy", () => {
          manager.destroy();
          managers.delete(manager);
        });
      }
      const ystate = ySyncPluginKey.getState(view.state);
      function onAdded({
        stackItem,
      }: {
        stackItem: UndoManager["undoStack"][number];
      }) {
        const binding = ystate.binding;
        if (binding) {
          stackItem.meta.set(binding, upstream.getState(view.state)!.prevSel);
        }
      }
      function onPopped({
        stackItem,
      }: {
        stackItem: UndoManager["undoStack"][number];
      }) {
        const binding = ystate.binding;
        if (binding) {
          binding.beforeTransactionSelection =
            stackItem.meta.get(binding) || binding.beforeTransactionSelection;
        }
      }
      manager.on("stack-item-added", onAdded);
      manager.on("stack-item-popped", onPopped);
      return {
        destroy() {
          manager.off("stack-item-added", onAdded);
          manager.off("stack-item-popped", onPopped);
        },
      };
    },
  });
  return {
    key: "yUndo",
    prosemirrorPlugins: [plugin],
    dependsOn: ["yCursor", "ySync"],
    undoCommand: undoCommand,
    redoCommand: redoCommand,
  } as const;
});
