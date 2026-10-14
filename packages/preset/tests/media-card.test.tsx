// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vite-plus/test";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { BlockNoteView } from "@blocknote/mantine";
import {
  BlockNoteEditor,
  BlockNoteSchema,
  defaultBlockSpecs,
} from "@blocknote/core";
import { createMediaCardSpec } from "../src/MediaCard.js";

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn(() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })),
});

afterEach(() => vi.restoreAllMocks());

it.each(["aiImage", "aiVideo"] as const)(
  "%s opens its toolbar on card click and its input only from settings",
  async (kind) => {
    const spec = createMediaCardSpec(kind, {
      renderMediaToolbar: (context) => (
        <>
          <button aria-label="上传素材" onClick={context.upload}>
            Upload
          </button>
          <button aria-label="素材说明" onClick={context.editCaption}>
            Caption
          </button>
          <button
            role="switch"
            aria-checked={context.values.aiEnabled}
            onClick={() =>
              context.update({ aiEnabled: !context.values.aiEnabled })
            }
          >
            AI
          </button>
          <button aria-label="关闭设置" onClick={context.close}>
            Close
          </button>
        </>
      ),
      renderMediaPanel: (context) => (
        <textarea
          value={context.values.prompt}
          onChange={(event) => context.update({ prompt: event.target.value })}
        />
      ),
      task: () => undefined,
      subscribe: () => () => {},
      cancel: vi.fn(),
    });
    const editor = BlockNoteEditor.create({
      schema: BlockNoteSchema.create({ blockSpecs: { [kind]: spec } }),
      initialContent: [
        {
          type: kind,
          props: {
            aiEnabled: true,
            prompt: "Harbour",
            aspectRatio: "16:9",
            caption: "原说明",
          },
        },
      ],
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    root.render(
      <MantineProvider>
        <BlockNoteView editor={editor} />
      </MantineProvider>,
    );
    try {
      await vi.waitFor(() =>
        expect(host.querySelector(".bn-media-card-trigger")).not.toBeNull(),
      );
      expect(host.querySelector(".bn-media-card-toolbar")).toBeNull();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(
        host.querySelector(".bn-media-card-placeholder")?.textContent,
      ).toBe("");
      (host.querySelector(".bn-media-card-preview") as HTMLElement).click();
      const toolbarSelector =
        '[aria-label="' + (kind === "aiImage" ? "图片操作" : "视频操作") + '"]';
      await vi.waitFor(() =>
        expect(document.querySelector(toolbarSelector)).not.toBeNull(),
      );
      (
        document.querySelector(
          `${toolbarSelector} [aria-label="素材说明"]`,
        ) as HTMLButtonElement
      ).click();
      await vi.waitFor(() =>
        expect(document.querySelector(".bn-media-caption-form")).not.toBeNull(),
      );
      const captionForm = document.querySelector(
        ".bn-media-caption-form",
      ) as HTMLFormElement;
      expect(host.contains(captionForm)).toBe(false);
      expect(captionForm.querySelector("input")?.value).toBe("原说明");
      expect(captionForm.querySelector("textarea")).toBeNull();
      captionForm
        .querySelector("input")
        ?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      await vi.waitFor(() =>
        expect(document.querySelector(".bn-media-caption-form")).toBeNull(),
      );
      expect(editor.document[0].props).toMatchObject({ caption: "原说明" });
      expect(document.querySelector(toolbarSelector)).not.toBeNull();
      (
        document.querySelector(
          `${toolbarSelector} [aria-label="素材说明"]`,
        ) as HTMLButtonElement
      ).click();
      await vi.waitFor(() =>
        expect(document.querySelector(".bn-media-caption-form")).not.toBeNull(),
      );
      document
        .querySelector(".bn-media-caption-form input")
        ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      expect(document.querySelector(".bn-media-caption-form")).not.toBeNull();
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      await vi.waitFor(() => {
        expect(document.querySelector(".bn-media-caption-form")).toBeNull();
        expect(document.querySelector(toolbarSelector)).toBeNull();
      });
      (host.querySelector(".bn-media-card-preview") as HTMLElement).click();
      await vi.waitFor(() =>
        expect(document.querySelector(toolbarSelector)).not.toBeNull(),
      );
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      (
        host.querySelector(".bn-media-card-trigger") as HTMLButtonElement
      ).click();
      await vi.waitFor(() =>
        expect(document.querySelector('[role="dialog"]')).not.toBeNull(),
      );
      (
        host.querySelector(".bn-media-card-trigger") as HTMLButtonElement
      ).click();
      await vi.waitFor(() =>
        expect(document.querySelector('[role="dialog"]')).toBeNull(),
      );
      expect(document.querySelector(toolbarSelector)).not.toBeNull();
      (
        host.querySelector(".bn-media-card-trigger") as HTMLButtonElement
      ).click();
      await vi.waitFor(() =>
        expect(document.querySelector('[role="dialog"]')).not.toBeNull(),
      );
      const panel = document.querySelector('[role="dialog"]') as HTMLElement;
      expect(host.contains(panel)).toBe(false);
      expect(panel.querySelector("textarea")?.value).toBe("Harbour");
      const toolbar = document.querySelector(
        '[aria-label="' + (kind === "aiImage" ? "图片操作" : "视频操作") + '"]',
      ) as HTMLElement;
      expect(host.contains(toolbar)).toBe(false);
      expect(toolbar.querySelector('[aria-label="上传素材"]')).not.toBeNull();
      expect(panel.querySelector('[role="switch"]')).toBeNull();
      (toolbar.querySelector('[role="switch"]') as HTMLButtonElement).click();
      await vi.waitFor(() =>
        expect(document.querySelector('[role="dialog"]')).toBeNull(),
      );
      expect(document.body.contains(toolbar)).toBe(true);
      expect(editor.document[0].props).toMatchObject({
        aiEnabled: false,
        prompt: "Harbour",
      });
      (
        toolbar.querySelector('[aria-label="关闭设置"]') as HTMLButtonElement
      ).click();
      await vi.waitFor(() =>
        expect(document.querySelector(toolbarSelector)).toBeNull(),
      );
    } finally {
      root.unmount();
      host.remove();
      editor.unmount();
    }
  },
);

it("loads intrinsic image ratios and handles side drops with the native document structure", async () => {
  const { createMediaRowSpec } = await import("../src/MediaRow.js");
  const { EditorView } = await import("../src/EditorView.js");
  const editor = BlockNoteEditor.create({
    schema: BlockNoteSchema.create({
      blockSpecs: {
        ...defaultBlockSpecs,
        aiImage: createMediaCardSpec("aiImage"),
        mediaRow: createMediaRowSpec(),
      },
    }),
    initialContent: [
      {
        id: "portrait",
        type: "aiImage",
        props: { url: "portrait.jpg", aspectRatio: "16:9" },
      },
      { id: "landscape", type: "aiImage", props: { url: "landscape.jpg" } },
    ],
  });
  const host = document.createElement("div");
  host.style.overflowY = "auto";
  Object.defineProperties(host, {
    scrollHeight: { value: 2000 },
    clientHeight: { value: 400 },
  });
  vi.spyOn(host, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 800,
    height: 400,
    right: 800,
    bottom: 400,
    x: 0,
    y: 0,
    toJSON() {},
  });
  document.body.append(host);
  const root = createRoot(host);
  root.render(
    <MantineProvider>
      <EditorView editor={editor} />
    </MantineProvider>,
  );
  try {
    await vi.waitFor(() => expect(host.querySelectorAll("img").length).toBe(2));
    const img = host.querySelector("img")!;
    Object.defineProperties(img, {
      naturalWidth: { value: 600 },
      naturalHeight: { value: 900 },
    });
    img.dispatchEvent(new Event("load"));
    await vi.waitFor(() =>
      expect(
        host.querySelector('[data-block-id="portrait"] style')?.textContent,
      ).toContain(`--bn-media-ratio: ${2 / 3}`),
    );
    expect(img.parentElement?.style.aspectRatio).toBe("");
    expect(img.closest<HTMLElement>(".bn-media-card")?.style.width).toBe(
      "100%",
    );
    const source = host.querySelector('[data-block-id="portrait"]')!;
    const target = host.querySelector('[data-block-id="landscape"]')!;
    editor.setTextCursorPosition("portrait");
    editor.focus();
    await vi.waitFor(() => {
      expect(editor.domElement?.classList.contains("ProseMirror-focused")).toBe(
        true,
      );
      expect(source.closest(".ProseMirror-selectednode")).not.toBeNull();
    });
    const outside = document.createElement("div");
    document.body.append(outside);
    // App surfaces may stop bubbling and need not be focusable.
    outside.addEventListener("pointerdown", (event) => event.stopPropagation());
    outside.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    await vi.waitFor(() =>
      expect(editor.domElement?.classList.contains("ProseMirror-focused")).toBe(
        false,
      ),
    );
    expect(editor.domElement?.dataset.mediaSelectionDismissed).toBe("true");
    editor.focus();
    expect(editor.domElement?.dataset.mediaSelectionDismissed).toBe("true");
    source.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(editor.domElement?.dataset.mediaSelectionDismissed).toBeUndefined();
    outside.remove();
    const outer = target.closest<HTMLElement>(".bn-block-outer")!;
    vi.spyOn(outer, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 400,
      right: 600,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON() {},
    });
    const dataTransfer = {
      files: [],
      types: ["application/x-blocknote-media"],
      setDragImage: vi.fn(),
      setData: vi.fn(),
      effectAllowed: "",
      dropEffect: "",
    };
    function drag(type: string, node: Element, x = 10, y = 200) {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      });
      Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
      node.dispatchEvent(event);
    }
    const beforeDrag = editor.document;
    drag("dragstart", source);
    expect(dataTransfer.setDragImage).not.toHaveBeenCalled();
    // Native OS dragging can blur the webview; this is not a cancellation.
    window.dispatchEvent(new Event("blur"));
    expect(document.querySelector(".bn-media-drop-indicator")).not.toBeNull();
    expect(host.contains(source)).toBe(true);
    drag("dragover", target);
    expect(
      document.querySelector<HTMLElement>(".bn-media-drop-indicator")?.dataset
        .side,
    ).toBe("left");
    const indicator = document.querySelector(".bn-media-drop-indicator");
    drag("dragover", editor.domElement!, 610, 200);
    expect(document.querySelector(".bn-media-drop-indicator")).toBe(indicator);
    expect((indicator as HTMLElement).dataset.side).toBe("right");
    expect(editor.document).toEqual(beforeDrag);
    drag("dragover", target, 400, 390);
    await vi.waitFor(() => expect(host.scrollTop).toBeGreaterThan(0));
    drag("dragover", target);
    drag("drop", target);
    expect(document.querySelector(".bn-media-drag-thumbnail")).toBeNull();
    expect(document.querySelector(".bn-media-drop-indicator")).toBeNull();
    expect(editor.document[0].type).toBe("mediaRow");
    expect(editor.document[0].children.map((block) => block.id)).toEqual([
      "portrait",
      "landscape",
    ]);
    await vi.waitFor(() =>
      expect(
        host.querySelector(
          '.bn-block:has(> .bn-react-node-view-renderer > [data-content-type="mediaRow"]) > .bn-block-group',
        ),
      ).not.toBeNull(),
    );
  } finally {
    root.unmount();
    host.remove();
    editor.unmount();
  }
});

it("defers file reads until near the viewport and ignores unrelated task updates", async () => {
  let intersect: IntersectionObserverCallback | undefined;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  let notify = () => {};
  let status = "running";
  const renderPanel = vi.fn(() => null);
  const resolveFileUrl = vi.fn(async () => "blob:preview");
  const editor = BlockNoteEditor.create({
    schema: BlockNoteSchema.create({
      blockSpecs: {
        aiImage: createMediaCardSpec("aiImage", {
          task: () => ({ status }),
          subscribe: (listener) => {
            notify = listener;
            return () => {};
          },
          cancel: () => {},
          renderMediaPanel: renderPanel,
        }),
      },
    }),
    resolveFileUrl,
    initialContent: [
      { type: "aiImage", props: { url: "large.png", taskId: "job" } },
    ],
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  root.render(
    <MantineProvider>
      <BlockNoteView editor={editor} />
    </MantineProvider>,
  );
  try {
    await vi.waitFor(() => expect(intersect).toBeDefined());
    expect(resolveFileUrl).not.toHaveBeenCalled();
    intersect!(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await vi.waitFor(() =>
      expect(host.querySelector("img")?.getAttribute("src")).toBe(
        "blob:preview",
      ),
    );
    expect(host.querySelector("img")?.getAttribute("decoding")).toBe("async");
    const renders = renderPanel.mock.calls.length;
    notify();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(renderPanel).toHaveBeenCalledTimes(renders);
    status = "succeeded";
    notify();
    await vi.waitFor(() =>
      expect(renderPanel.mock.calls.length).toBeGreaterThan(renders),
    );
    expect(resolveFileUrl).toHaveBeenCalledTimes(1);
  } finally {
    root.unmount();
    host.remove();
    editor.unmount();
    vi.unstubAllGlobals();
  }
});
