// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vite-plus/test";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteEditor, BlockNoteSchema } from "@blocknote/core";
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
  "%s opens its settings outside document layout",
  async (kind) => {
    const spec = createMediaCardSpec(kind, {
      renderMediaToolbar: (context) => (
        <>
          <button aria-label="上传素材" onClick={context.upload}>
            Upload
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
          props: { aiEnabled: true, prompt: "Harbour", aspectRatio: "16:9" },
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
        expect(document.querySelector('[role="dialog"]')).toBeNull(),
      );
    } finally {
      root.unmount();
      host.remove();
      editor.unmount();
    }
  },
);
