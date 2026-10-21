import { isValidElement, useMemo, useCallback } from "react";
import {
  ComponentsContext,
  FormattingToolbar,
  getFormattingToolbarItems,
  FileDownloadButton,
  FormattingToolbarController,
  blockTypeSelectItems,
  useComponentsContext,
  useBlockNoteEditor,
  useEditorState,
} from "@blocknote/react";
import type { ComponentProps } from "@blocknote/react";
import { zh } from "@blocknote/core/locales";
import {
  Download,
  Baseline,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  CodeXml,
  AlignLeft,
  AlignCenter,
  AlignRight,
  IndentIncrease,
  IndentDecrease,
  Link,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  ListTodo,
  Quote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strike: Strikethrough,
  code: CodeXml,
  alignTextLeft: AlignLeft,
  alignTextCenter: AlignCenter,
  alignTextRight: AlignRight,
  nestBlock: IndentIncrease,
  unnestBlock: IndentDecrease,
  createLink: Link,
};
const blockIcons: Record<string, LucideIcon> = {
  paragraph: Type,
  bulletListItem: List,
  numberedListItem: ListOrdered,
  checkListItem: ListTodo,
  quote: Quote,
};
const headingIcons = [
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
];
const selectItems = blockTypeSelectItems(zh)
  .filter(
    (item) =>
      item.type !== "toggleListItem" && item.props?.isToggleable !== true,
  )
  .map((item) => {
    const Icon =
      item.type === "heading"
        ? headingIcons[Number(item.props?.level || 1) - 1]
        : blockIcons[item.type];
    return Icon
      ? { ...item, icon: () => <Icon size={18} strokeWidth={1.7} /> }
      : item;
  });

type DownloadProps = { onDownloadFile?: (url: string, name?: string) => void };

function SaveFileButton({ onDownloadFile }: Required<DownloadProps>) {
  const editor = useBlockNoteEditor();
  const components = useComponentsContext()!;
  const block = useEditorState({
    editor,
    selector: ({ editor }) => {
      const blocks = editor.getSelection()?.blocks || [
        editor.getTextCursorPosition().block,
      ];
      return blocks.length === 1 ? blocks[0] : undefined;
    },
  });
  if (
    !block ||
    !("url" in block.props) ||
    typeof block.props.url !== "string"
  ) {
    return null;
  }
  const url = block.props.url;
  const name =
    "name" in block.props && typeof block.props.name === "string"
      ? block.props.name
      : undefined;
  return (
    <components.FormattingToolbar.Button
      className="bn-button"
      label="下载文件"
      mainTooltip="下载文件"
      icon={<Download size={18} />}
      isDisabled={!url}
      onClick={() => onDownloadFile(url, name)}
    />
  );
}

function Toolbar({ onDownloadFile }: DownloadProps) {
  const components = useComponentsContext()!;
  const themed = useMemo(() => {
    const OriginalButton = components.FormattingToolbar.Button;
    const OriginalRoot = components.FormattingToolbar.Root;
    const OriginalSelect = components.FormattingToolbar.Select;
    return {
      ...components,
      FormattingToolbar: {
        ...components.FormattingToolbar,
        Select: (props: ComponentProps["FormattingToolbar"]["Select"]) => (
          <OriginalSelect
            {...props}
            className={`${props.className || ""} ls-block-type-menu`}
          />
        ),
        Root: (props: ComponentProps["FormattingToolbar"]["Root"]) => (
          <OriginalRoot
            {...props}
            className={`${props.className || ""} ls-formatting-toolbar`}
          />
        ),
        Button: (
          props: ComponentProps["FormattingToolbar"]["Button"] & {
            "data-test"?: string;
          },
        ) => {
          if (
            props["data-test"] === "colors" &&
            isValidElement<{ textColor?: string; backgroundColor?: string }>(
              props.icon,
            )
          ) {
            const resolveColor = (
              value: string | undefined,
              kind: "text" | "background",
            ) => {
              if (!value || value === "default") {
                return kind === "text" ? "currentColor" : "transparent";
              }
              return [
                "gray",
                "brown",
                "red",
                "orange",
                "yellow",
                "green",
                "blue",
                "purple",
                "pink",
              ].includes(value)
                ? `var(--bn-colors-highlights-${value}-${kind})`
                : value;
            };
            return (
              <OriginalButton
                {...props}
                icon={
                  <span
                    className="ls-toolbar-color"
                    style={{
                      color: resolveColor(props.icon.props.textColor, "text"),
                      backgroundColor: resolveColor(
                        props.icon.props.backgroundColor,
                        "background",
                      ),
                    }}
                  >
                    <Baseline size={18} strokeWidth={1.7} />
                  </span>
                }
              />
            );
          }
          const Icon = icons[props["data-test"] || ""];
          return (
            <OriginalButton
              {...props}
              icon={Icon ? <Icon size={18} strokeWidth={1.7} /> : props.icon}
            />
          );
        },
      },
    };
  }, [components]);
  return (
    <ComponentsContext.Provider value={themed}>
      <FormattingToolbar blockTypeSelectItems={selectItems}>
        {getFormattingToolbarItems(selectItems).map((item) =>
          onDownloadFile && item.type === FileDownloadButton ? (
            <SaveFileButton key={item.key} onDownloadFile={onDownloadFile} />
          ) : (
            item
          ),
        )}
      </FormattingToolbar>
    </ComponentsContext.Provider>
  );
}

export function BlockNoteFormattingToolbar({
  onDownloadFile,
}: DownloadProps = {}) {
  const toolbar = useCallback(
    () => <Toolbar onDownloadFile={onDownloadFile} />,
    [onDownloadFile],
  );
  const editor = useBlockNoteEditor();
  const containsMedia = useEditorState({
    editor,
    selector: ({ editor }) => {
      const selected = editor.getSelection()?.blocks || [
        editor.getTextCursorPosition().block,
      ];
      return selected.some((block) =>
        ["image", "video", "mediaRow"].includes(block.type),
      );
    },
  });
  // Unmount the floating controller too, so a text selection cannot reuse a
  // media selection's anchor or transition state.
  if (containsMedia) {
    return null;
  }
  return <FormattingToolbarController formattingToolbar={toolbar} />;
}
