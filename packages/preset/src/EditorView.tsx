import { useEffect, type ComponentProps } from "react";
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
  ...props
}: ComponentProps<typeof BlockNoteView<B, I, S>>) {
  useCreationPolicy(props.editor);
  useEffect(() => {
    const root = props.editor.domElement;
    if (root) {
      return installMediaDrag(props.editor, root);
    }
  }, [props.editor]);
  return (
    <BlockNoteView
      {...props}
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
