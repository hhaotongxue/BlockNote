/** Read-only shape of a ProseMirror document; no dependency on engine internals. */
export interface PolicyNode {
  type: { name: string };
  attrs: { [key: string]: unknown };
  firstChild: PolicyNode | null;
  descendants: (visit: (node: PolicyNode) => void) => void;
}

export function restrictedBlocks(doc: PolicyNode): Map<string, number> {
  const result = new Map<string, number>();
  doc.descendants((node) => {
    if (node.type.name !== "blockContainer") {
      return;
    }
    const content = node.firstChild;
    if (
      !content ||
      !(
        content.type.name === "toggleListItem" ||
        (content.type.name === "heading" && content.attrs.isToggleable === true)
      )
    ) {
      return;
    }
    const key = `${String(node.attrs.id)}:${content.type.name}`;
    result.set(key, (result.get(key) || 0) + 1);
  });
  return result;
}

export function introducesRestrictedBlocks(
  before: Map<string, number>,
  after: Map<string, number>,
): boolean {
  return [...after].some(([key, count]) => count > (before.get(key) || 0));
}
