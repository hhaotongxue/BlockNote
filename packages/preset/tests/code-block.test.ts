// @vitest-environment jsdom
import { describe, expect, it, vi } from "vite-plus/test";
import { BlockNoteEditor, BlockNoteSchema } from "@blocknote/core";
import { createPresetCodeBlockSpec } from "../src/CodeBlock.js";

// jsdom does not implement this browser API used by Mantine's theme provider.
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

function renderCode(language: string) {
  const spec = createPresetCodeBlockSpec();
  const editor = BlockNoteEditor.create({
    schema: BlockNoteSchema.create({ blockSpecs: { codeBlock: spec } }),
    initialContent: [
      {
        type: "codeBlock",
        props: { language },
        content: "public class App {}",
      },
    ],
  });
  const rendered = spec.implementation.render.call(
    {},
    {
      id: editor.document[0].id,
      type: "codeBlock",
      props: { language },
      content: [{ type: "text", text: "public class App {}", styles: {} }],
      children: [],
    },
    editor,
  );
  return { spec, editor, rendered, dom: rendered.dom as HTMLElement };
}

describe("preset code toolbar", () => {
  it("highlights Java and refreshes the language picker after an external edit", async () => {
    const { editor, rendered } = renderCode("java");
    const host = document.createElement("div");
    document.body.append(host);
    editor.mount(host);
    try {
      await vi.waitFor(() => {
        expect(host.querySelector(".shiki")).not.toBeNull();
      });
      editor.updateBlock(editor.document[0].id, {
        props: { language: "typescript" },
      });
      await vi.waitFor(() =>
        expect(host.querySelector('[aria-label="代码语言"]')?.textContent).toBe(
          "TypeScript",
        ),
      );
      expect(host.querySelectorAll(".bn-preset-code-toolbar")).toHaveLength(1);
    } finally {
      editor.unmount();
      host.remove();
      rendered.destroy?.();
    }
  });

  it("shows aliases without rewriting the stored language and changes language explicitly", async () => {
    const { editor, rendered, dom } = renderCode("js");
    await vi.waitFor(() =>
      expect(dom.querySelector('[aria-label="代码语言"]')).not.toBeNull(),
    );
    const select = dom.querySelector<HTMLButtonElement>(
      '[aria-label="代码语言"]',
    )!;
    expect(select.textContent).toBe("JavaScript");
    expect(editor.document[0].props.language).toBe("js");
    select.click();
    await vi.waitFor(() =>
      expect(dom.querySelector('[role="option"]')).not.toBeNull(),
    );
    const search = dom.querySelector<HTMLInputElement>(
      '[aria-label="搜索代码语言"]',
    )!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(search, "java");
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.waitFor(() =>
      expect(dom.querySelectorAll('[role="option"]')).toHaveLength(2),
    );
    expect(dom.querySelector('[aria-label="代码语言"]')?.tagName).toBe(
      "BUTTON",
    );
    const java = Array.from(
      dom.querySelectorAll<HTMLElement>('[role="option"]'),
    ).find((option) => option.textContent === "Java")!;
    java.click();
    expect(editor.document[0].props.language).toBe("java");
    rendered.destroy?.();
  });

  it("keeps unknown legacy languages readable", async () => {
    const { editor, rendered, dom } = renderCode("legacy-custom-language");
    await vi.waitFor(() =>
      expect(dom.querySelector('[aria-label="代码语言"]')?.textContent).toBe(
        "legacy-custom-language",
      ),
    );
    expect(editor.document[0].props.language).toBe("legacy-custom-language");
    rendered.destroy?.();
  });

  it("copies the latest content without toolbar labels", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { rendered, dom } = renderCode("java");
    rendered.contentDOM!.textContent = "public class Updated {}";
    await vi.waitFor(() =>
      expect(dom.querySelector('[aria-label="复制代码"]')).not.toBeNull(),
    );
    dom.querySelector<HTMLButtonElement>('[aria-label="复制代码"]')!.click();
    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("public class Updated {}"),
    );
    await vi.waitFor(() =>
      expect(dom.querySelector('[role="status"]')!.textContent).toBe(
        "代码已复制",
      ),
    );
    rendered.destroy?.();
  });

  it("exports native code HTML without toolbar chrome", () => {
    const { editor, rendered } = renderCode("java");
    const html = editor.blocksToHTMLLossy(editor.document);
    expect(html).toContain("language-java");
    expect(html).toContain("public class App {}");
    expect(html).not.toContain("复制");
    expect(html).not.toContain("select");
    rendered.destroy?.();
  });

  it("toggles wrapping without changing code or history and retains it across language changes", async () => {
    const { editor, rendered } = renderCode("java");
    const host = document.createElement("div");
    document.body.append(host);
    editor.mount(host);
    try {
      await vi.waitFor(() =>
        expect(host.querySelector('[aria-label="自动换行"]')).not.toBeNull(),
      );
      const before = JSON.stringify(editor.document);
      const surface = host.querySelector('[data-content-type="codeBlock"]')!;
      expect(surface.getAttribute("data-code-wrap")).toBe("true");
      host.querySelector<HTMLButtonElement>('[aria-label="自动换行"]')!.click();
      expect(surface.getAttribute("data-code-wrap")).toBe("false");
      expect(JSON.stringify(editor.document)).toBe(before);
      editor.updateBlock(editor.document[0].id, {
        props: { language: "typescript" },
      });
      await vi.waitFor(() =>
        expect(host.querySelector('[aria-label="代码语言"]')?.textContent).toBe(
          "TypeScript",
        ),
      );
      expect(
        host
          .querySelector('[data-content-type="codeBlock"]')!
          .getAttribute("data-code-wrap"),
      ).toBe("false");
      const actions = host.querySelector('[role="group"]')!;
      expect(actions.querySelectorAll("button")).toHaveLength(3);
      expect(
        actions.querySelectorAll("button")[1].getAttribute("aria-label"),
      ).toBe("复制代码");
    } finally {
      editor.unmount();
      host.remove();
      rendered.destroy?.();
    }
  });
});
