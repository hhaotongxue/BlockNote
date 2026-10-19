import { expect, it, vi } from "vite-plus/test";
import * as Y from "yjs";
import { yUndoPluginKey } from "y-prosemirror";
import { BlockNoteEditor } from "../../editor/BlockNoteEditor.js";
import { withCollaboration } from "../index.js";
it.each([false, true])("undo/redo after typing (remounted=%s)", (remount) => {
  const doc = new Y.Doc();
  const editor = BlockNoteEditor.create(
    withCollaboration({
      collaboration: {
        fragment: doc.getXmlFragment("prosemirror"),
        user: { name: "me", color: "#123456" },
      },
    }),
  );
  editor.mount(document.createElement("div"));
  try {
    if (remount) {
      editor.unmount();
      editor.mount(document.createElement("div"));
    }
    const view = editor.prosemirrorView;
    view.dispatch(view.state.tr.insertText("hello"));
    expect(view.state.doc.textContent).toBe("hello");
    expect(editor.undo()).toBe(true);
    expect(view.state.doc.textContent).toBe("");
    expect(editor.redo()).toBe(true);
    expect(view.state.doc.textContent).toBe("hello");
  } finally {
    editor.unmount();
    doc.destroy();
  }
});

it("preserves undo and redo stacks across repeated mounts and keyboard shortcuts", () => {
  const doc = new Y.Doc();
  const editor = BlockNoteEditor.create(
    withCollaboration({
      collaboration: {
        fragment: doc.getXmlFragment("prosemirror"),
        user: { name: "me", color: "#123456" },
      },
    }),
  );
  function mount() {
    editor.mount(document.createElement("div"));
  }
  function press(shiftKey = false) {
    const view = editor.prosemirrorView;
    const mac = /Mac|iP(hone|ad|od)/.test(navigator.platform);
    const event = new KeyboardEvent("keydown", {
      key: "z",
      metaKey: mac,
      ctrlKey: !mac,
      shiftKey,
    });
    view.someProp("handleKeyDown", (handler) => handler(view, event));
  }
  mount();
  try {
    editor.prosemirrorView.dispatch(
      editor.prosemirrorState.tr.insertText("hello"),
    );
    for (let i = 0; i < 3; i++) {
      editor.unmount();
      mount();
    }
    press();
    expect(editor.prosemirrorState.doc.textContent).toBe("");
    editor.unmount();
    mount();
    press(true);
    expect(editor.prosemirrorState.doc.textContent).toBe("hello");
    editor.unmount();
    mount();
    editor.prosemirrorView.dispatch(editor.prosemirrorState.tr.insertText("!"));
    press();
    expect(editor.prosemirrorState.doc.textContent).not.toContain("!");
  } finally {
    editor._tiptapEditor.destroy();
    doc.destroy();
  }
});

it("releases the undo manager on editor destruction, not view unmount", () => {
  const doc = new Y.Doc();
  const editor = BlockNoteEditor.create(
    withCollaboration({
      collaboration: {
        fragment: doc.getXmlFragment("prosemirror"),
        user: { name: "me", color: "#123456" },
      },
    }),
  );
  editor.mount(document.createElement("div"));
  const manager = yUndoPluginKey.getState(editor.prosemirrorState)!.undoManager;
  const destroy = vi.spyOn(manager, "destroy");
  editor.unmount();
  expect(destroy).not.toHaveBeenCalled();
  editor.mount(document.createElement("div"));
  editor._tiptapEditor.destroy();
  expect(destroy).toHaveBeenCalledTimes(1);
  destroy.mockRestore();
  doc.destroy();
});
