import type {
  BlockNoteEditor,
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  createOutlineStore,
  outlineElements,
  scrollToOutlineHeading,
} from "./outlineNavigation.js";

export interface DocumentOutlineOptions {
  /** The document's scrolling viewport. Navigation never scrolls its ancestors. */
  scrollContainer: HTMLElement;
  /** Positioned overlay host, outside the scroller. Defaults to its parent. */
  container?: HTMLElement | null;
}

/** Read-only document navigation, independent of editor commands and persistence. */
export function DocumentOutline<
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>({
  editor,
  scrollContainer,
  container = scrollContainer.parentElement,
}: DocumentOutlineOptions & { editor: BlockNoteEditor<B, I, S> }) {
  const source = useMemo(() => createOutlineStore(editor), [editor]);
  const headings = useSyncExternalStore(
    source.subscribe,
    source.snapshot,
    source.snapshot,
  );
  const [activeId, setActiveId] = useState<string>();
  const [open, setOpen] = useState(false);
  const [bounds, setBounds] = useState({
    top: 100,
    right: 16,
    height: 0,
    width: 0,
  });
  const nav = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    const root = editor.domElement;
    const win = scrollContainer.ownerDocument.defaultView;
    if (!root || !container || !win) {
      return;
    }
    let frame = 0;
    function measure() {
      if (!root || !container) {
        return;
      }
      const viewport = scrollContainer.getBoundingClientRect();
      const host = container.getBoundingClientRect();
      const top = Math.min(100, Math.max(48, viewport.height / 5));
      const nextBounds = {
        top: viewport.top - host.top - container.clientTop + top,
        right: host.right - viewport.right - container.clientLeft + 16,
        height: Math.max(0, viewport.height - top - 24),
        width: viewport.width,
      };
      setBounds((previous) =>
        previous.top === nextBounds.top &&
        previous.right === nextBounds.right &&
        previous.height === nextBounds.height &&
        previous.width === nextBounds.width
          ? previous
          : nextBounds,
      );
      const elements = outlineElements(root);
      const visible = headings.filter((heading) => {
        const element = elements.get(heading.id);
        return element && element.getClientRects().length > 0;
      });
      let active: string | undefined = visible[0]?.id;
      for (const heading of visible) {
        if (
          elements.get(heading.id)!.getBoundingClientRect().top <=
          viewport.top + 100
        ) {
          active = heading.id;
        }
      }
      if (
        scrollContainer.scrollHeight > scrollContainer.clientHeight &&
        scrollContainer.scrollTop + scrollContainer.clientHeight >=
          scrollContainer.scrollHeight - 2
      ) {
        active = visible.at(-1)?.id;
      }
      setActiveId(active);
    }
    function schedule() {
      if (!frame) {
        frame = win!.requestAnimationFrame(() => {
          frame = 0;
          measure();
        });
      }
    }
    const resize = new ResizeObserver(schedule);
    resize.observe(scrollContainer);
    resize.observe(container);
    resize.observe(root);
    scrollContainer.addEventListener("scroll", schedule, { passive: true });
    win.addEventListener("resize", schedule);
    measure();
    return () => {
      resize.disconnect();
      scrollContainer.removeEventListener("scroll", schedule);
      win.removeEventListener("resize", schedule);
      win.cancelAnimationFrame(frame);
    };
  }, [editor, scrollContainer, container, headings]);

  useEffect(() => {
    if (!open || !panel.current) {
      return;
    }
    const current = panel.current.querySelector<HTMLElement>(
      '[aria-current="location"]',
    );
    if (current) {
      // Scrolling the panel itself must never scroll the document or app shell.
      const top =
        current.offsetTop -
        panel.current.clientHeight / 2 +
        current.offsetHeight / 2;
      panel.current.scrollTop = Math.max(0, top);
    }
  }, [open, activeId]);

  if (
    !container ||
    !headings.length ||
    bounds.height < 48 ||
    bounds.width < 320
  ) {
    return null;
  }
  const baseLevel = Math.min(...headings.map((heading) => heading.level));
  const style: CSSProperties & {
    "--bn-outline-height": string;
    "--bn-outline-width": string;
  } = {
    top: bounds.top,
    right: bounds.right,
    "--bn-outline-height": `${bounds.height}px`,
    "--bn-outline-width": `${Math.min(256, bounds.width - 48)}px`,
  };
  return createPortal(
    <nav
      ref={nav}
      className="bn-preset-outline"
      aria-label="文档大纲"
      contentEditable={false}
      data-open={open}
      style={style}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => {
        if (
          !nav.current?.contains(scrollContainer.ownerDocument.activeElement)
        ) {
          setOpen(false);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          trigger.current?.focus({ preventScroll: true });
          setOpen(false);
        }
      }}
    >
      <button
        ref={trigger}
        className="bn-preset-outline-rail"
        type="button"
        aria-label="大纲"
        aria-expanded={open}
        aria-controls={panelId}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onMouseDown={(event) => event.preventDefault()}
      >
        {headings.map((heading) => (
          <span
            key={heading.id}
            className="bn-preset-outline-tick"
            data-active={heading.id === activeId}
            style={{ width: Math.max(6, 16 - (heading.level - baseLevel) * 4) }}
          />
        ))}
      </button>
      <div
        ref={panel}
        id={panelId}
        className="bn-preset-outline-panel"
        hidden={!open}
      >
        {headings.map((heading) => (
          <button
            key={heading.id}
            type="button"
            className="bn-preset-outline-item"
            aria-current={heading.id === activeId ? "location" : undefined}
            style={{ paddingInlineStart: 8 + (heading.level - baseLevel) * 14 }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const root = editor.domElement;
              const element = root && outlineElements(root).get(heading.id);
              if (element) {
                scrollToOutlineHeading(scrollContainer, element);
              }
            }}
          >
            <span>{heading.text}</span>
          </button>
        ))}
      </div>
    </nav>,
    container,
  );
}
