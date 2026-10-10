import { test } from "node:test";
import assert from "node:assert/strict";
import {
  restrictedBlocks,
  introducesRestrictedBlocks,
} from "../src/blockCreationPolicy.ts";

function node(name, attrs = {}, children = []) {
  return {
    type: { name },
    attrs,
    firstChild: children[0] || null,
    descendants(visit) {
      for (const child of children) {
        visit(child);
        child.descendants(visit);
      }
    },
  };
}
const block = (id, type, attrs = {}, children = []) =>
  node("blockContainer", { id }, [node(type, attrs), ...children]);
const doc = (...children) => node("doc", {}, children);
const rejected = (before, after) =>
  introducesRestrictedBlocks(restrictedBlocks(before), restrictedBlocks(after));

test("blocks keyboard/API conversion of a paragraph to a toggle list", () =>
  assert.equal(
    rejected(doc(block("a", "paragraph")), doc(block("a", "toggleListItem"))),
    true,
  ));
test("blocks turning a regular heading into a folding heading", () =>
  assert.equal(
    rejected(
      doc(block("a", "heading")),
      doc(block("a", "heading", { isToggleable: true })),
    ),
    true,
  ));
test("blocks pasted nested folding blocks inside otherwise allowed content", () =>
  assert.equal(
    rejected(
      doc(),
      doc(
        block("a", "paragraph", {}, [
          block("b", "heading", { isToggleable: true }),
        ]),
      ),
    ),
    true,
  ));
test("blocks duplication even if a copied block temporarily keeps its old ID", () =>
  assert.equal(
    rejected(
      doc(block("a", "toggleListItem")),
      doc(block("a", "toggleListItem"), block("a", "toggleListItem")),
    ),
    true,
  ));
test("allows editing and moving legacy folding blocks", () =>
  assert.equal(
    rejected(
      doc(block("a", "toggleListItem"), block("b", "paragraph")),
      doc(
        block("b", "paragraph"),
        block("a", "toggleListItem", { text: "edited" }),
      ),
    ),
    false,
  ));
test("allows removing folding from an existing heading", () =>
  assert.equal(
    rejected(
      doc(block("a", "heading", { isToggleable: true })),
      doc(block("a", "heading", { isToggleable: false })),
    ),
    false,
  ));
test("allows normal headings, text, tables and lists", () =>
  assert.equal(
    rejected(
      doc(),
      doc(
        block("a", "heading"),
        block("b", "paragraph"),
        block("c", "table"),
        block("d", "bulletListItem"),
      ),
    ),
    false,
  ));
