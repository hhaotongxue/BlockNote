import { isValidElement, useMemo } from "react";
import {
  ComponentsContext,
  FormattingToolbar,
  FormattingToolbarController,
  blockTypeSelectItems,
  useComponentsContext,
  useBlockNoteEditor,
  useEditorState,
} from "@blocknote/react";
import type { ComponentProps } from "@blocknote/react";
import { zh } from "@blocknote/core/locales";
import {
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

function Toolbar() {
  const components = useComponentsContext()!;
  const editor = useBlockNoteEditor();
  const mediaCardSelected = useEditorState({
    editor,
    selector: ({ editor }) => {
      const selected = editor.getSelection()?.blocks || [
        editor.getTextCursorPosition().block,
      ];
      return (
        selected.length === 1 &&
        ["aiImage", "aiVideo"].includes(selected[0].type)
      );
    },
  });
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
  if (mediaCardSelected) {
    return null;
  }
  return (
    <ComponentsContext.Provider value={themed}>
      <FormattingToolbar blockTypeSelectItems={selectItems} />
    </ComponentsContext.Provider>
  );
}

export function BlockNoteFormattingToolbar() {
  return <FormattingToolbarController formattingToolbar={Toolbar} />;
}
