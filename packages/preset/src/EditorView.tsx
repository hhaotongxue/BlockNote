import { useEffect, type ComponentProps, type CSSProperties } from "react";
import type {
  BlockSchema,
  InlineContentSchema,
  StyleSchema,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { BlockNoteTableHandles } from "./BlockNoteTableHandles.js";
import { BlockNoteSideMenu } from "./BlockNoteSideMenu.js";
import { BlockNoteCommandMenu } from "./BlockNoteCommandMenu.js";
import { BlockNoteFormattingToolbar } from "./BlockNoteFormattingToolbar.js";
import { taskCheckFeedback } from "./taskCheckFeedback.js";
import { useCreationPolicy } from "./useCreationPolicy.js";

import { installMediaDrag } from "./mediaDrag.js";

/** Shared visual preset. Consumers supply document, persistence and business UI only. */
export function EditorView<
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>({
  children,
  onClickCapture,
  selectionColor = "#38bdf8",
  style,
  ...props
}: ComponentProps<typeof BlockNoteView<B, I, S>> & {
  /** Media selection outline color. Accepts a CSS color or host CSS variable. */
  selectionColor?: string;
}) {
  const selectionStyle: CSSProperties & {
    "--bn-media-selection-color": string;
  } = {
    ...style,
    "--bn-media-selection-color": selectionColor,
  };
  useCreationPolicy(props.editor);
  useEffect(() => {
    const root = props.editor.domElement;
    if (root) {
      return installMediaDrag(props.editor, root);
    }
  }, [props.editor]);
  useEffect(() => {
    const root = props.editor.domElement;
    if (!root) {
      return;
    }
    const reset = () => delete root.dataset.mediaSelectionDismissed;
    const unsubscribe = props.editor.onSelectionChange(reset);
    function dismissMediaSelection(event: PointerEvent) {
      const target = event.target;
      if (!root || !(target instanceof Element)) {
        return;
      }
      if (target.closest(".bn-media-card-panel")) {
        return;
      }
      if (root.contains(target) && target.closest(".bn-media-card")) {
        reset();
        return;
      }
      root.dataset.mediaSelectionDismissed = "true";
      if (
        !root.contains(target) &&
        root.querySelector(
          ".ProseMirror-selectednode .bn-media-card, .bn-media-card.ProseMirror-selectednode",
        )
      ) {
        props.editor.blur();
        const selection = root.ownerDocument.getSelection();
        if (selection?.anchorNode && root.contains(selection.anchorNode)) {
          selection.removeAllRanges();
        }
      }
    }
    document.addEventListener("pointerdown", dismissMediaSelection, true);
    return () => {
      document.removeEventListener("pointerdown", dismissMediaSelection, true);
      unsubscribe();
      reset();
    };
  }, [props.editor]);
  return (
    <BlockNoteView
      {...props}
      style={selectionStyle}
      sideMenu={false}
      slashMenu={false}
      formattingToolbar={false}
      tableHandles={false}
      onClickCapture={(event) => {
        onClickCapture?.(event);
        if (!event.defaultPrevented) {
          taskCheckFeedback(event);
        }
      }}
    >
      <BlockNoteSideMenu />
      <BlockNoteCommandMenu />
      <BlockNoteFormattingToolbar />
      {props.tableHandles !== false && <BlockNoteTableHandles />}
      {children}
    </BlockNoteView>
  );
}
