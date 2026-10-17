import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentProps,
} from "react";
import type {
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { EditorView } from "./EditorView.js";

type CardProps<
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
> = Pick<
  ComponentProps<typeof BlockNoteView<B, I, S>>,
  "editor" | "theme" | "children"
> & {
  mode: "readonly" | "editable";
  /** null expands the card to its full content height. */
  maxHeight?: number | null;
  scrollable?: boolean;
  autoFocus?: boolean;
};

/** Body only: titles, persistence and business actions belong to the host. */
export function CardEditorView<
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>({
  editor,
  theme,
  children,
  mode,
  maxHeight = 320,
  scrollable = true,
  autoFocus = false,
}: CardProps<B, I, S>) {
  const viewport = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });
  useEffect(() => {
    const node = viewport.current;
    if (!node) {
      return;
    }
    const measure = () => {
      const top = scrollable && node.scrollTop > 1;
      const bottom = node.scrollHeight - node.clientHeight - node.scrollTop > 1;
      setEdges((previous) =>
        previous.top === top && previous.bottom === bottom
          ? previous
          : { top, bottom },
      );
    };
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    const body = node.querySelector(".bn-editor");
    if (body) {
      resize.observe(body);
    }
    const mutations = new MutationObserver(measure);
    mutations.observe(node, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    node.addEventListener("scroll", measure, { passive: true });
    if (!scrollable) {
      node.scrollTop = 0;
    }
    measure();
    return () => {
      resize.disconnect();
      mutations.disconnect();
      node.removeEventListener("scroll", measure);
    };
  }, [editor, scrollable, maxHeight, mode]);
  return (
    <div
      className="bn-preset-card"
      data-mode={mode}
      style={
        {
          "--bn-card-max-height":
            maxHeight === null ? "none" : `${maxHeight}px`,
        } as CSSProperties
      }
    >
      <div
        ref={viewport}
        className="bn-preset-card-viewport"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.stopPropagation();
          }
        }}
        data-scrollable={scrollable}
        data-overflow-top={edges.top}
        data-overflow-bottom={edges.bottom}
        tabIndex={scrollable && (edges.top || edges.bottom) ? 0 : undefined}
        aria-label={scrollable ? "卡片正文，可滚动查看" : "卡片正文预览"}
      >
        {mode === "readonly" ? (
          <BlockNoteView
            editor={editor}
            theme={theme}
            editable={false}
            sideMenu={false}
            slashMenu={false}
            formattingToolbar={false}
            tableHandles={false}
            filePanel={false}
            linkToolbar={false}
          />
        ) : (
          <EditorView
            editor={editor}
            theme={theme}
            editable
            sideMenu={false}
            autoFocus={autoFocus}
          >
            {children}
          </EditorView>
        )}
      </div>
    </div>
  );
}
