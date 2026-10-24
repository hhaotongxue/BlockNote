export interface OutlineHeading {
  id: string;
  level: number;
  text: string;
}

interface OutlineBlock {
  id: string;
  type: string;
  props: Readonly<Record<string, unknown>>;
  content?: unknown;
  children: readonly OutlineBlock[];
}

function inlineText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(inlineText).join("");
  }
  if (!content || typeof content !== "object") {
    return "";
  }
  if ("text" in content && typeof content.text === "string") {
    return content.text;
  }
  if ("content" in content) {
    return inlineText(content.content);
  }
  if (
    "props" in content &&
    content.props &&
    typeof content.props === "object"
  ) {
    if ("label" in content.props && typeof content.props.label === "string") {
      return content.props.label;
    }
  }
  return "";
}

/** Reads the public block snapshot; never adds IDs or changes document content. */
export function collectOutlineHeadings(
  blocks: readonly OutlineBlock[],
): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  function visit(items: readonly OutlineBlock[]) {
    for (const block of items) {
      if (block.type === "heading") {
        const text = inlineText(block.content).trim();
        if (text) {
          headings.push({
            id: block.id,
            level:
              typeof block.props.level === "number" ? block.props.level : 1,
            text,
          });
        }
      }
      visit(block.children);
    }
  }
  visit(blocks);
  return headings;
}

/** A per-editor external store; subscriptions are disposed on switch/unmount. */
export function createOutlineStore(editor: {
  readonly document: readonly OutlineBlock[];
  onChange: (callback: () => void) => () => void;
}) {
  let snapshot = collectOutlineHeadings(editor.document);
  return {
    snapshot: () => snapshot,
    subscribe: (notify: () => void) => {
      function refresh() {
        const next = collectOutlineHeadings(editor.document);
        if (
          snapshot.length === next.length &&
          snapshot.every(
            (item, index) =>
              item.id === next[index].id &&
              item.level === next[index].level &&
              item.text === next[index].text,
          )
        ) {
          return;
        }
        snapshot = next;
        notify();
      }
      const unsubscribe = editor.onChange(refresh);
      refresh();
      return unsubscribe;
    },
  };
}

/** Query only this editor; block IDs are compared as values, never CSS selectors. */
export function outlineElements(root: HTMLElement): Map<string, HTMLElement> {
  const elements = new Map<string, HTMLElement>();
  for (const element of root.querySelectorAll<HTMLElement>("[data-id]")) {
    const id = element.dataset.id;
    if (id && !elements.has(id)) {
      elements.set(id, element);
    }
  }
  return elements;
}

/** Scroll only the supplied viewport, without focusing or selecting the heading. */
export function scrollToOutlineHeading(
  viewport: HTMLElement,
  heading: HTMLElement,
) {
  // Clear the 48px page header with a small gap above the target heading.
  const top =
    heading.getBoundingClientRect().top -
    viewport.getBoundingClientRect().top -
    viewport.clientTop +
    viewport.scrollTop -
    56;
  viewport.scrollTo({
    top: Math.max(
      0,
      Math.min(top, viewport.scrollHeight - viewport.clientHeight),
    ),
    behavior: viewport.ownerDocument.defaultView?.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
      ? "instant"
      : "smooth",
  });
}
