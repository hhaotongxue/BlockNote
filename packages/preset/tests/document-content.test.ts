// @vitest-environment jsdom
import { expect, test } from "vite-plus/test";
import { createDocumentSchema } from "../src/DocumentSchema.js";
import { parseDocumentContent } from "../src/documentContent.js";

const encode = (blocks: unknown[]) =>
  JSON.stringify({ format: "blocknote", version: 1, blocks });

test("transport validation follows the actual renderer's registered blocks", () => {
  const schema = createDocumentSchema();
  for (const type of Object.keys(schema.blockSchema)) {
    expect(parseDocumentContent(encode([{ type }])).success).toBe(true);
  }
  for (const type of ["aiImage", "aiVideo", "unknown"]) {
    expect(
      parseDocumentContent(
        encode([{ type: "paragraph", children: [{ type }] }]),
      ).success,
    ).toBe(false);
  }
});

test("parsing preserves media parameters and rejects malformed envelopes", () => {
  const blocks = [
    {
      id: "video",
      type: "video",
      props: {
        url: "https://example.com/movie.mp4",
        duration: 10,
        caption: "Video",
      },
    },
  ];
  expect(parseDocumentContent(encode(blocks))).toEqual({
    success: true,
    data: { format: "blocknote", version: 1, blocks },
  });
  for (const value of [
    "not json",
    "null",
    encode([]),
    encode([{ type: "image", props: [] }]),
  ]) {
    expect(parseDocumentContent(value).success).toBe(false);
  }
});
