import { AllSelection, TextSelection } from "prosemirror-state";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { BlockNoteEditor } from "../../../editor/BlockNoteEditor.js";

let editor: BlockNoteEditor | undefined;
afterEach(() => editor?.unmount());

function setup(
  type: "paragraph" | "heading" | "bulletListItem" = "paragraph",
  text = "Hello world",
) {
  const instance = BlockNoteEditor.create({
    initialContent: [
      { id: "first", type, content: text },
      { id: "second", content: "Another paragraph" },
    ],
  });
  editor = instance;
  instance.mount(document.createElement("div"));
  instance.setTextCursorPosition("first", "end");
  return instance._tiptapEditor;
}

function pressKey(key: string, mod = false) {
  const view = editor!.prosemirrorView;
  const mac = /Mac|iP(hone|ad|od)/.test(navigator.platform);
  const event = new KeyboardEvent("keydown", {
    key,
    ctrlKey: mod && !mac,
    metaKey: mod && mac,
    bubbles: true,
    cancelable: true,
  });
  view.someProp("handleKeyDown", (handler) => handler(view, event));
}

describe("progressive select all", () => {
  it.each(["paragraph", "heading", "bulletListItem"] as const)(
    "selects %s text, then the document",
    (type) => {
      const tiptap = setup(type);
      const before = tiptap.state.doc.toJSON();
      pressKey("a", true);
      const selection = tiptap.state.selection;
      expect(selection).toBeInstanceOf(TextSelection);
      expect(selection.$from.parentOffset).toBe(0);
      expect(selection.$to.parentOffset).toBe(11);
      expect(
        editor!.domElement!.querySelectorAll(".bn-whole-block-selection"),
      ).toHaveLength(1);
      pressKey("a", true);
      expect(tiptap.state.selection).toBeInstanceOf(AllSelection);
      expect(
        editor!.domElement!.querySelectorAll(".bn-whole-block-selection"),
      ).toHaveLength(2);
      pressKey("a", true);
      expect(tiptap.state.selection).toBeInstanceOf(AllSelection);
      expect(tiptap.state.doc.toJSON()).toEqual(before);
    },
  );

  it("expands partial selection and resets after cursor movement", () => {
    const tiptap = setup();
    const start = tiptap.state.selection.$from.start();
    tiptap.commands.setTextSelection({ from: start + 1, to: start + 4 });
    pressKey("a", true);
    expect(tiptap.state.selection.from).toBe(start);
    expect(tiptap.state.selection.to).toBe(start + 11);
    pressKey("a", true);
    editor!.setTextCursorPosition("second", "end");
    pressKey("a", true);
    expect(tiptap.state.selection).toBeInstanceOf(TextSelection);
    expect(tiptap.state.selection.$from.parent.textContent).toBe(
      "Another paragraph",
    );
    editor!.setTextCursorPosition("first", "end");
    expect(
      editor!.domElement!.querySelectorAll(".bn-whole-block-selection"),
    ).toHaveLength(0);
  });

  it("selects all immediately from an empty paragraph", () => {
    const tiptap = setup("paragraph", "");
    pressKey("a", true);
    expect(tiptap.state.selection).toBeInstanceOf(AllSelection);
  });

  it("expands cross-paragraph selection to the document", () => {
    const tiptap = setup();
    const from = tiptap.state.selection.from - 3;
    editor!.setTextCursorPosition("second", "end");
    tiptap.commands.setTextSelection({
      from,
      to: tiptap.state.selection.to - 2,
    });
    pressKey("a", true);
    expect(tiptap.state.selection).toBeInstanceOf(AllSelection);
  });

  it("deletes all and restores content on undo", () => {
    const tiptap = setup();
    const before = tiptap.state.doc.toJSON();
    pressKey("a", true);
    pressKey("a", true);
    pressKey("Backspace");
    expect(tiptap.state.doc.textContent).toBe("");
    expect(editor!.undo()).toBe(true);
    expect(tiptap.state.doc.toJSON()).toEqual(before);
  });
});
