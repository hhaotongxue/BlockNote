import { expect, it } from "vite-plus/test";
import { BlockNoteEditor } from "../../editor/BlockNoteEditor.js";
import { TableHandlesExtension } from "./TableHandles.js";

it("releases table handle state before a cached editor is mounted again", () => {
  const editor = BlockNoteEditor.create({
    initialContent: [
      {
        type: "table",
        content: { type: "tableContent", rows: [{ cells: ["cell"] }] },
      },
    ],
  });
  const container = document.createElement("div");
  document.body.append(container);
  try {
    editor.mount(container);
    const extension = editor.getExtension(TableHandlesExtension)!;
    const block = editor.document[0];
    if (block.type !== "table") {
      throw new Error("Expected table fixture");
    }
    extension.store.setState({
      block,
      show: true,
      rowIndex: 0,
      colIndex: 0,
      showAddOrRemoveRowsButton: false,
      showAddOrRemoveColumnsButton: false,
      referencePosCell: undefined,
      referencePosTable: new DOMRect(),
      draggingState: undefined,
      widgetContainer: undefined,
    });
    expect(extension.store.state).toBeDefined();
    editor.unmount();
    expect(extension.store.state).toBeUndefined();
    editor.mount(container);
    expect(extension.store.state).toBeUndefined();
    expect(editor.document[0].type).toBe("table");
  } finally {
    editor.unmount();
    container.remove();
  }
});
