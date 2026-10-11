import { createCodeBlockSpec } from "@blocknote/core";
import { syntaxHighlighter } from "@blocknote/code-block";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { CodeBlockToolbar } from "./CodeBlockToolbar.js";

// View preference only: preserve it across language changes without changing
// the persisted code schema, text, collaboration state or undo history.
const wrapPreferences = new WeakMap<object, Map<string, boolean>>();

/** Keep the native code schema, keyboard handling and HTML export intact. */
export function createPresetCodeBlockSpec(): ReturnType<
  typeof createCodeBlockSpec
> {
  const native = createCodeBlockSpec();
  return {
    ...native,
    extensions: [...(native.extensions ?? []), syntaxHighlighter],
    implementation: {
      ...native.implementation,
      render(
        this: ThisParameterType<typeof native.implementation.render>,
        ...args: Parameters<typeof native.implementation.render>
      ) {
        const [block, editor] = args;
        const rendered = native.implementation.render.call(this, ...args);
        const toolbar = document.createElement("div");
        toolbar.className = "bn-preset-code-toolbar";
        toolbar.contentEditable = "false";
        let preferences = wrapPreferences.get(editor);
        if (!preferences) {
          preferences = new Map();
          wrapPreferences.set(editor, preferences);
        }
        const blockPreferences = preferences;
        const surface =
          rendered.contentDOM?.closest<HTMLElement>(".bn-block-content");
        function setWrap(wrap: boolean) {
          blockPreferences.set(block.id, wrap);
          surface?.setAttribute("data-code-wrap", String(wrap));
        }
        const wrap = blockPreferences.get(block.id) ?? true;
        setWrap(wrap);
        rendered.dom.prepend(toolbar);
        const root = createRoot(toolbar);
        root.render(
          createElement(CodeBlockToolbar, {
            language: block.props.language,
            editable: () => editor.isEditable,
            initialWrap: wrap,
            toolbar,
            changeLanguage(language: string) {
              if (editor.isEditable) {
                editor.updateBlock(block.id, { props: { language } });
              }
            },
            getCode: () => rendered.contentDOM?.textContent ?? "",
            setWrap,
          }),
        );
        return {
          ...rendered,
          ignoreMutation(mutation) {
            // React updates toolbar icons/tooltips independently of the code.
            // These UI mutations must not trigger a ProseMirror node redraw.
            if (
              toolbar.contains(mutation.target) ||
              (mutation.type === "attributes" &&
                mutation.target === surface &&
                mutation.attributeName === "data-code-wrap")
            ) {
              return true;
            }
            return rendered.ignoreMutation?.(mutation) ?? false;
          },
          update(node) {
            return node.attrs.language === block.props.language;
          },
          destroy() {
            // Node views can be destroyed during a React commit.
            queueMicrotask(() => root.unmount());
            rendered.destroy?.();
          },
        };
      },
    },
  };
}
