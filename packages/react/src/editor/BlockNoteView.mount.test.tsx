import {
  BlockNoteEditor,
  BlockNoteSchema,
  defaultBlockSpecs,
} from "@blocknote/core";
import { LinkToolbarExtension } from "@blocknote/core/extensions";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { LinkToolbarController } from "../components/LinkToolbar/LinkToolbarController.js";
import { createReactBlockSpec } from "../schema/ReactBlockSpec.js";
import { useEditorState } from "../hooks/useEditorState.js";
import { BlockNoteViewRaw } from "./BlockNoteView.js";

let root: Root;
let container: HTMLDivElement;
let editors: BlockNoteEditor[];
let renderErrors: unknown[];
function createEditor(link = true) {
  const editor = BlockNoteEditor.create({
    initialContent: [
      {
        type: "paragraph",
        content: link
          ? [{ type: "link", href: "https://example.com", content: "example" }]
          : "plain text",
      },
    ],
  });
  editors.push(editor);
  return editor;
}
function EditableObserver({ editor }: { editor: BlockNoteEditor }) {
  const editable = useEditorState({
    editor,
    selector: ({ editor }) => editor.isEditable,
  });
  return <output data-testid="editable-state">{String(editable)}</output>;
}
function Toolbar() {
  return <div data-testid="link-toolbar">Link</div>;
}
async function renderEditor(
  editor: BlockNoteEditor,
  editable: boolean,
  strict = false,
) {
  const view = (
    <BlockNoteViewRaw editor={editor} editable={editable}>
      <LinkToolbarController linkToolbar={Toolbar} />
      <EditableObserver editor={editor} />
    </BlockNoteViewRaw>
  );
  await act(async () =>
    root.render(strict ? <StrictMode>{view}</StrictMode> : view),
  );
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  renderErrors = [];
  root = createRoot(container, {
    onUncaughtError: (error) => renderErrors.push(error),
  });
  editors = [];
});
afterEach(async () => {
  await act(async () => root.unmount());
  editors.forEach((editor) => editor._tiptapEditor.destroy());
  container.remove();
  vi.restoreAllMocks();
  expect(renderErrors).toEqual([]);
});
describe("editable lifecycle with a link at the initial cursor", () => {
  it.each([false, true])(
    "opens and repeatedly toggles editable (link=%s)",
    async (link) => {
      const editor = createEditor(link);
      await renderEditor(editor, false);
      const original = editor.document;
      const onChange = vi.fn();
      const unsubscribe = editor.onChange(onChange);
      const initialSelection = editor.prosemirrorState.selection.toJSON();
      const mount = vi.spyOn(editor, "mount");
      const unmount = vi.spyOn(editor, "unmount");
      for (const editable of [true, false, true]) {
        await renderEditor(editor, editable);
        expect(editor.isEditable).toBe(editable);
        expect(editor.domElement?.getAttribute("contenteditable")).toBe(
          String(editable),
        );
        expect(editor.domElement?.getAttribute("tabindex")).toBe("0");
        expect(
          container.querySelector('[data-testid="editable-state"]')
            ?.textContent,
        ).toBe(String(editable));
        expect(editor.document).toEqual(original);
        expect(editor.prosemirrorState.selection.toJSON()).toEqual(
          initialSelection,
        );
        expect(mount.mock.calls.length).toBe(unmount.mock.calls.length);
        expect(onChange).not.toHaveBeenCalled();
      }
      unsubscribe();
      expect(mount).toHaveBeenCalledTimes(3);
      expect(unmount).toHaveBeenCalledTimes(3);
      if (link) {
        const toolbar = editor.getExtension(LinkToolbarExtension)!;
        const selected = toolbar.getLinkAtSelection()!;
        expect(
          toolbar
            .getLinkElementAtPos(selected.range.from)
            ?.getAttribute("href"),
        ).toBe("https://example.com");
      }
    },
  );
  it("updates custom block controls when editability changes", async () => {
    const schema = BlockNoteSchema.create({
      blockSpecs: {
        ...defaultBlockSpecs,
        probe: createReactBlockSpec(
          { type: "probe", propSchema: {}, content: "none" },
          {
            render: ({ editor }) => (
              <button data-testid="block-control" disabled={!editor.isEditable}>
                Action
              </button>
            ),
          },
        )(),
      },
    });
    const editor = BlockNoteEditor.create({
      schema,
      initialContent: [{ type: "probe" }],
    });
    try {
      for (const editable of [false, true, false, true]) {
        await act(async () =>
          root.render(<BlockNoteViewRaw editor={editor} editable={editable} />),
        );
        const button = container.querySelector<HTMLButtonElement>(
          '[data-testid="block-control"]',
        );
        expect(button).not.toBeNull();
        expect(button?.disabled).toBe(!editable);
      }
    } finally {
      await act(async () => root.render(null));
      editor._tiptapEditor.destroy();
    }
  });
  it("opens editable immediately and keeps link editing functional", async () => {
    const editor = createEditor();
    await renderEditor(editor, true);
    expect(editor.domElement?.getAttribute("contenteditable")).toBe("true");
    const toolbar = editor.getExtension(LinkToolbarExtension)!;
    const selected = toolbar.getLinkAtSelection()!;
    await act(async () =>
      toolbar.editLink(
        "https://updated.example.com",
        "updated",
        selected.range.from,
      ),
    );
    expect(editor.domElement?.querySelector("a")?.getAttribute("href")).toBe(
      "https://updated.example.com",
    );
    expect(editor.domElement?.textContent).toContain("updated");
  });
  it("reattaches the same document after the view is removed", async () => {
    const editor = createEditor();
    await renderEditor(editor, false);
    await act(async () => root.render(null));
    expect(editor.domElement).toBeUndefined();
    await renderEditor(editor, true);
    expect(editor.domElement?.getAttribute("tabindex")).toBe("0");
    expect(editor.domElement?.querySelector("a")?.textContent).toBe("example");
  });
  it("switches documents without leaving listeners on the previous view", async () => {
    const first = createEditor();
    const second = createEditor();
    await renderEditor(first, false);
    await renderEditor(first, true);
    await renderEditor(second, false);
    await renderEditor(second, true);
    expect(first.domElement).toBeUndefined();
    expect(second.domElement?.isConnected).toBe(true);
    expect(() => {
      first.isEditable = false;
    }).not.toThrow();
  });
  it("supports StrictMode remounts and read-only to editable", async () => {
    const editor = createEditor();
    await renderEditor(editor, false, true);
    await renderEditor(editor, true, true);
    expect(editor.domElement?.isConnected).toBe(true);
  });
});
