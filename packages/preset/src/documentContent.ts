import { defaultBlockSpecs } from "@blocknote/core";

/** Extra block names shared by the renderer and the transport validator. */
export const documentBlockNames = {
  mediaRow: "mediaRow",
  mathBlock: "mathBlock",
  bookmark: "bookmark",
} as const;
const blockTypes = new Set([
  ...Object.keys(defaultBlockSpecs),
  ...Object.values(documentBlockNames),
]);

export interface DocumentBlock {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: DocumentBlock[];
}
export interface DocumentContent {
  format: "blocknote";
  version: 1;
  blocks: DocumentBlock[];
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function block(value: unknown): value is DocumentBlock {
  return (
    record(value) &&
    typeof value.type === "string" &&
    blockTypes.has(value.type) &&
    (value.id === undefined || typeof value.id === "string") &&
    (value.props === undefined || record(value.props)) &&
    (value.children === undefined ||
      (Array.isArray(value.children) && value.children.every(block)))
  );
}
/** Shared wire format. Unsupported blocks are rejected, never converted. */
export function parseDocumentContent(
  content: string,
): { success: true; data: DocumentContent } | { success: false } {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return { success: false };
  }
  if (
    !record(value) ||
    value.format !== "blocknote" ||
    value.version !== 1 ||
    !Array.isArray(value.blocks) ||
    !value.blocks.length ||
    !value.blocks.every(block)
  ) {
    return { success: false };
  }
  return {
    success: true,
    data: { format: "blocknote", version: 1, blocks: value.blocks },
  };
}
