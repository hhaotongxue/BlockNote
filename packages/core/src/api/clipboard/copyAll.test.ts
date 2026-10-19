import { expect, it } from "vite-plus/test";
import { BlockNoteEditor } from "../../editor/BlockNoteEditor.js";
import { selectedFragmentToHTML } from "./toClipboard/copyExtension.js";

it.each([false, true])(
  "copy all retains top-level blocks and nested lists (external HTML: %s)",
  (external) => {
    const source = BlockNoteEditor.create({
      initialContent: [
        { id: "h", type: "heading", content: "Role" },
        { id: "p", content: "Text" },
        {
          id: "list",
          type: "bulletListItem",
          content: "Parent",
          children: [{ id: "child", type: "bulletListItem", content: "Child" }],
        },
      ],
    });
    const target = BlockNoteEditor.create();
    source.mount(document.createElement("div"));
    target.mount(document.createElement("div"));
    try {
      source._tiptapEditor.commands.selectAll();
      const before = source.document;
      const { clipboardHTML, externalHTML, markdown } = selectedFragmentToHTML(
        source.prosemirrorView,
        source,
      );
      target.pasteHTML(external ? externalHTML : clipboardHTML, !external);
      expect(
        target.document.map((b) => ({
          type: b.type,
          children: b.children.length,
        })),
      ).toEqual([
        { type: "heading", children: 0 },
        { type: "paragraph", children: 0 },
        { type: "bulletListItem", children: 1 },
      ]);
      expect(target.document[2].children[0].content).toEqual(
        source.document[2].children[0].content,
      );
      expect(markdown).toContain("Role");
      expect(markdown).toContain("Child");
      expect(source.document).toEqual(before);
    } finally {
      source.unmount();
      target.unmount();
    }
  },
);

it("partial text copy stays inline", () => {
  const source = BlockNoteEditor.create({
    initialContent: [{ id: "p", content: "Hello world" }],
  });
  const target = BlockNoteEditor.create();
  source.mount(document.createElement("div"));
  target.mount(document.createElement("div"));
  try {
    source.setTextCursorPosition("p", "start");
    const start = source.prosemirrorState.selection.from;
    source._tiptapEditor.commands.setTextSelection({
      from: start,
      to: start + 5,
    });
    const { clipboardHTML, markdown } = selectedFragmentToHTML(
      source.prosemirrorView,
      source,
    );
    target.pasteHTML(clipboardHTML, true);
    expect(target.document).toHaveLength(1);
    expect(target.document[0].children).toHaveLength(0);
    expect(target.prosemirrorState.doc.textContent).toBe("Hello");
    expect(markdown.trim()).toBe("Hello");
  } finally {
    source.unmount();
    target.unmount();
  }
});
