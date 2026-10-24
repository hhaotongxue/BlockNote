// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { BlockNoteEditor } from "@blocknote/core";
import { withCollaboration } from "@blocknote/core/yjs";
import * as Y from "yjs";
import { createRoot } from "react-dom/client";
import { DocumentOutline } from "../src/DocumentOutline.js";
import { collectOutlineHeadings } from "../src/outlineNavigation.js";

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn(() => ({ matches: false })),
});
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);

function createEditor() {
  return BlockNoteEditor.create({
    initialContent: [
      { id: "h1", type: "heading", props: { level: 1 }, content: "Document" },
      {
        id: "p",
        type: "paragraph",
        content: "Text",
        children: [
          {
            id: "h2",
            type: "heading",
            props: { level: 2 },
            content: [
              { type: "text", text: "Nested ", styles: { bold: true } },
              { type: "link", href: "https://example.org", content: "link" },
            ],
          },
        ],
      },
      { id: "empty", type: "heading", content: "  " },
      { id: "h3", type: "heading", props: { level: 3 }, content: "Last" },
    ],
  });
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

function mount(editor = createEditor()) {
  const container = document.createElement("section");
  const viewport = document.createElement("div");
  const host = document.createElement("div");
  const ui = document.createElement("div");
  container.append(viewport, ui);
  viewport.append(host);
  document.body.append(container);
  editor.mount(host);
  Object.defineProperties(viewport, {
    clientHeight: { value: 600 },
    scrollHeight: { value: 1800 },
  });
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(
    new DOMRect(100, 40, 900, 600),
  );
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue(
    new DOMRect(100, 40, 900, 600),
  );
  for (const element of host.querySelectorAll<HTMLElement>("[data-id]")) {
    const top =
      element.dataset.id === "h3"
        ? 1200
        : element.dataset.id === "h2"
          ? 500
          : 200;
    vi.spyOn(element, "getBoundingClientRect").mockImplementation(
      () => new DOMRect(200, top - viewport.scrollTop, 600, 40),
    );
    vi.spyOn(element, "getClientRects").mockReturnValue(
      Object.assign([new DOMRect()], { item: () => new DOMRect() }),
    );
  }
  const scrollTo = vi.fn();
  viewport.scrollTo = scrollTo;
  const root = createRoot(ui);
  root.render(<DocumentOutline editor={editor} scrollContainer={viewport} />);
  cleanups.push(() => {
    root.unmount();
    editor.unmount();
    container.remove();
  });
  return { editor, container, viewport, host, root, scrollTo };
}

async function open(container: HTMLElement) {
  await vi.waitFor(() =>
    expect(container.querySelector('[aria-label="大纲"]')).not.toBeNull(),
  );
  container.querySelector<HTMLButtonElement>('[aria-label="大纲"]')!.focus();
  await vi.waitFor(() =>
    expect(container.querySelector('[aria-expanded="true"]')).not.toBeNull(),
  );
}

describe("document outline", () => {
  it("does not emit collaborative updates or alter the persisted Yjs snapshot", async () => {
    const document = new Y.Doc();
    const editor = BlockNoteEditor.create(
      withCollaboration({
        initialContent: [
          { id: "collab", type: "heading", content: "Shared heading" },
        ],
        collaboration: {
          fragment: document.getXmlFragment("prosemirror"),
          user: { name: "Test", color: "#38bdf8" },
        },
      }),
    );
    const { container } = mount(editor);
    editor.replaceBlocks(editor.document, [
      { id: "collab", type: "heading", content: "Shared heading" },
    ]);
    const save = vi.fn();
    document.on("update", save);
    const stored = Y.encodeStateAsUpdate(document);
    cleanups.push(() => {
      document.off("update", save);
      document.destroy();
    });
    await open(container);
    container
      .querySelector<HTMLButtonElement>(".bn-preset-outline-item")!
      .click();
    expect(Y.encodeStateAsUpdate(document)).toEqual(stored);
    expect(save).not.toHaveBeenCalled();
  });
  it("reads nested headings and rich text without including prose or empty headings", () => {
    const editor = createEditor();
    expect(collectOutlineHeadings(editor.document)).toEqual([
      { id: "h1", level: 1, text: "Document" },
      { id: "h2", level: 2, text: "Nested link" },
      { id: "h3", level: 3, text: "Last" },
    ]);
  });

  it("opens on hover, supports keyboard dismissal, and scrolls only its viewport", async () => {
    const { container, scrollTo, editor } = mount();
    const original = editor.document;
    const changed = vi.fn();
    const off = editor.onChange(changed);
    cleanups.push(off);
    await vi.waitFor(() =>
      expect(container.querySelector("nav")).not.toBeNull(),
    );
    container
      .querySelector("nav")!
      .dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    await vi.waitFor(() =>
      expect(container.querySelector('[aria-expanded="true"]')).not.toBeNull(),
    );
    const last = [
      ...container.querySelectorAll<HTMLButtonElement>(
        ".bn-preset-outline-item",
      ),
    ].at(-1)!;
    editor.setTextCursorPosition("p", "end");
    const cursor = editor.getTextCursorPosition();
    const prevent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    last.dispatchEvent(prevent);
    expect(prevent.defaultPrevented).toBe(true);
    last.click();
    expect(scrollTo).toHaveBeenCalledWith({
      top: 1104,
      behavior: "smooth",
    });
    expect(editor.getTextCursorPosition()).toEqual(cursor);
    expect(editor.document).toEqual(original);
    expect(changed).not.toHaveBeenCalled();
    last.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await vi.waitFor(() =>
      expect(container.querySelector('[aria-expanded="false"]')).not.toBeNull(),
    );
    expect(document.activeElement).toBe(
      container.querySelector('[aria-label="大纲"]'),
    );
  });

  it("follows edits, undo and redo without adding its own document changes", async () => {
    const { container, editor } = mount();
    await open(container);
    editor.updateBlock("h2", { content: "Renamed" });
    await vi.waitFor(() => expect(container.textContent).toContain("Renamed"));
    editor.undo();
    await vi.waitFor(() =>
      expect(container.querySelector("nav")!.textContent).toContain(
        "Nested link",
      ),
    );
    editor.redo();
    await vi.waitFor(() =>
      expect(container.querySelector("nav")!.textContent).toContain("Renamed"),
    );
    editor.updateBlock("h2", { type: "paragraph" });
    await vi.waitFor(() =>
      expect(
        container.querySelectorAll(".bn-preset-outline-item"),
      ).toHaveLength(2),
    );
    editor.removeBlocks(["h1", "h3"]);
    await vi.waitFor(() => expect(container.querySelector("nav")).toBeNull());
  });

  it("tracks the visible section and respects reduced motion", async () => {
    const { container, viewport, scrollTo } = mount();
    await open(container);
    viewport.scrollTop = 500;
    viewport.dispatchEvent(new Event("scroll"));
    await vi.waitFor(() =>
      expect(
        container.querySelector('[aria-current="location"]')?.textContent,
      ).toBe("Nested link"),
    );
    vi.mocked(window.matchMedia).mockReturnValueOnce({
      matches: true,
    } as MediaQueryList);
    container
      .querySelector<HTMLButtonElement>(".bn-preset-outline-item")!
      .click();
    expect(scrollTo).toHaveBeenLastCalledWith({
      top: 104,
      behavior: "instant",
    });
  });

  it("rebinds on document switches and removes listeners on unmount", async () => {
    const { container, viewport, editor, root } = mount();
    await open(container);
    const next = BlockNoteEditor.create({
      initialContent: [
        { id: "other", type: "heading", content: "Other document" },
      ],
    });
    const nextHost = document.createElement("div");
    viewport.append(nextHost);
    next.mount(nextHost);
    cleanups.push(() => {
      next.unmount();
      nextHost.remove();
    });
    root.render(<DocumentOutline editor={next} scrollContainer={viewport} />);
    await vi.waitFor(() =>
      expect(container.querySelector("nav")!.textContent).toBe(
        "Other document",
      ),
    );
    editor.updateBlock("h1", { content: "Old document changed" });
    expect(container.querySelector("nav")!.textContent).toBe("Other document");
    const remove = vi.spyOn(viewport, "removeEventListener");
    root.render(null);
    await vi.waitFor(() =>
      expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function)),
    );
  });
});
