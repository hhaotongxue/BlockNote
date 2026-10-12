// @vitest-environment jsdom
import { expect, it } from "vite-plus/test";
import {
  BlockNoteEditor,
  BlockNoteSchema,
  defaultBlockSpecs,
} from "@blocknote/core";
import { createMediaCardSpec } from "../src/MediaCard.js";
import { createMediaRowSpec } from "../src/MediaRow.js";
import {
  mediaRatio,
  moveMediaCard,
  removeMediaCard,
} from "../src/mediaLayout.js";

function createEditor() {
  return BlockNoteEditor.create({
    schema: BlockNoteSchema.create({
      blockSpecs: {
        ...defaultBlockSpecs,
        aiImage: createMediaCardSpec("aiImage"),
        mediaRow: createMediaRowSpec(),
      },
    }),
    initialContent: [
      {
        id: "a",
        type: "aiImage",
        props: { url: "portrait.jpg", previewWidth: 240, taskId: "task-a" },
      },
      { id: "b", type: "aiImage", props: { url: "landscape.jpg" } },
      { id: "c", type: "aiImage", props: { url: "square.jpg" } },
      { id: "text", type: "paragraph", content: "After images" },
    ],
  });
}

it("uses intrinsic dimensions before the generation ratio", () => {
  expect(mediaRatio(600, 900, "16:9")).toBeCloseTo(2 / 3);
  expect(mediaRatio(0, 0, "4:3")).toBeCloseTo(4 / 3);
  expect(mediaRatio(0, 0, "Auto")).toBeCloseTo(16 / 9);
});

it("groups, adds, reorders and extracts images without losing IDs or task state", () => {
  const editor = createEditor();
  moveMediaCard(editor, "a", "b", "left");
  let row = editor.document[0];
  expect(row.type).toBe("mediaRow");
  expect(row.children.map((b) => b.id)).toEqual(["a", "b"]);
  expect(editor.getBlock("a")?.props).toMatchObject({
    previewWidth: 240,
    taskId: "task-a",
  });
  moveMediaCard(editor, "c", "b", "right");
  row = editor.document[0];
  expect(row.children.map((b) => b.id)).toEqual(["a", "b", "c"]);
  moveMediaCard(editor, "c", "a", "left");
  expect(editor.document[0].children.map((b) => b.id)).toEqual(["c", "a", "b"]);
  moveMediaCard(editor, "a", "text", "after");
  expect(editor.document.at(-1)?.id).toBe("a");
  moveMediaCard(editor, "b", "c", "after");
  expect(editor.document.map((b) => b.id)).toEqual(["c", "b", "text", "a"]);
  expect(editor.getBlock("a")?.props).toMatchObject({
    previewWidth: 240,
    taskId: "task-a",
  });
});

it("deleting from a two-image row restores the remaining single image", () => {
  const editor = createEditor();
  moveMediaCard(editor, "a", "b", "right");
  removeMediaCard(editor, "a");
  expect(editor.document[0].id).toBe("b");
  expect(editor.document[0].type).toBe("aiImage");
});

it("undo and redo restore the whole grouping operation", () => {
  const editor = createEditor();
  const host = document.createElement("div");
  document.body.append(host);
  editor.mount(host);
  const original = editor.document;
  moveMediaCard(editor, "a", "b", "left");
  const grouped = editor.document;
  editor.undo();
  expect(editor.document).toEqual(original);
  editor.redo();
  expect(editor.document).toEqual(grouped);
  editor.unmount();
  host.remove();
});

it("round-trips row membership and manual width through stored JSON", () => {
  const editor = createEditor();
  moveMediaCard(editor, "a", "b", "left");
  const restored = BlockNoteEditor.create({
    schema: editor.schema,
    initialContent: JSON.parse(JSON.stringify(editor.document)),
  });
  expect(restored.document).toEqual(editor.document);
});
