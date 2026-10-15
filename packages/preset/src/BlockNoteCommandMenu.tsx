import { useEffect, useRef } from "react";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useBlockNoteEditor,
  usePortalElement,
} from "@blocknote/react";
import type {
  DefaultReactSuggestionItem,
  SuggestionMenuProps,
} from "@blocknote/react";
import {
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core/extensions";
import {
  Image,
  Table2,
  FileText,
  Video,
  AudioLines,
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
  ListCollapse,
  Quote,
  CodeXml,
  Minus,
  Smile,
  SquarePlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EditorTooltip } from "@blocknote/mantine";

type Command = DefaultReactSuggestionItem & {
  commandKey: string;
  section: string;
};
const storageKey = "lianshu:editor:recent-commands";
const formatKeys = [
  "paragraph",
  "heading",
  "heading_2",
  "heading_3",
  "heading_4",
  "heading_5",
  "heading_6",
  "bullet_list",
  "numbered_list",
  "check_list",
  "quote",
  "code_block",
];
const basicKeys = ["image", "table", "file", "video", "audio"];
const labels: Record<string, string> = {
  paragraph: "正文",
  image: "图片",
  table: "表格",
  file: "附件",
  video: "视频",
  audio: "音频",
  check_list: "任务列表",
};
const commandIcons: Record<string, LucideIcon> = {
  paragraph: Type,
  heading: Heading1,
  heading_2: Heading2,
  heading_3: Heading3,
  heading_4: Heading4,
  heading_5: Heading5,
  heading_6: Heading6,
  bullet_list: List,
  numbered_list: ListOrdered,
  check_list: ListTodo,
  toggle_list: ListCollapse,
  quote: Quote,
  code_block: CodeXml,
  divider: Minus,
  image: Image,
  table: Table2,
  file: FileText,
  video: Video,
  audio: AudioLines,
  emoji: Smile,
  toggle_heading: Heading1,
  toggle_heading_2: Heading2,
  toggle_heading_3: Heading3,
  toggle_heading_4: Heading4,
  toggle_heading_5: Heading5,
  toggle_heading_6: Heading6,
};

function recentKeys(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value)
      ? value
          .filter((key): key is string => typeof key === "string")
          .slice(0, 3)
      : [];
  } catch {
    return [];
  }
}

function CommandIcon({ item }: { item: Command }) {
  const Icon = commandIcons[item.commandKey] || SquarePlus;
  return <Icon aria-hidden="true" size={22} strokeWidth={1.6} />;
}

function CommandPalette({
  items,
  selectedIndex,
  onItemClick,
  loadingState,
}: SuggestionMenuProps<Command>) {
  const root = useRef<HTMLDivElement>(null);
  const tooltipPortal = usePortalElement();
  useEffect(() => {
    const selected = root.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    if (!selected || !root.current) {
      return;
    }
    const row = selected.getBoundingClientRect();
    const menu = root.current.getBoundingClientRect();
    if (row.top < menu.top + 8) {
      root.current.scrollTop -= menu.top + 8 - row.top;
    } else if (row.bottom > menu.bottom - 8) {
      root.current.scrollTop += row.bottom - menu.bottom + 8;
    }
  }, [selectedIndex, items]);
  const sections = [...new Set(items.map((item) => item.section))];
  return (
    <div
      ref={root}
      id="bn-suggestion-menu"
      role="listbox"
      aria-label="插入内容"
      aria-busy={loadingState !== "loaded"}
      className="ls-command-menu"
    >
      {sections.map((section) => (
        <section
          role="group"
          aria-label={section}
          className={`ls-command-section ${section === "排版" ? "ls-command-section-format" : ""}`}
          key={section}
        >
          {section !== "排版" && (
            <div className="ls-command-label">{section}</div>
          )}
          <div
            className={
              section === "排版"
                ? "ls-command-grid"
                : section === "最近使用"
                  ? "ls-command-recents"
                  : section === "基础"
                    ? "ls-command-basics"
                    : "ls-command-list"
            }
          >
            {items.map((item, index) =>
              item.section !== section ? null : (
                <EditorTooltip
                  key={`${section}:${item.commandKey}`}
                  label={`${item.title}${item.badge ? ` · ${item.badge}` : ""}`}
                  disabled={section !== "排版"}
                  portalProps={{ target: tooltipPortal || undefined }}
                >
                  <div
                    key={`${section}:${item.commandKey}`}
                    id={`bn-suggestion-menu-item-${index}`}
                    role="option"
                    aria-selected={index === selectedIndex}
                    aria-label={item.title}
                    className={`ls-command-option ${section === "排版" ? "ls-command-format" : section === "最近使用" ? "ls-command-chip" : "ls-command-entry"}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onItemClick?.(item)}
                  >
                    {section !== "最近使用" && (
                      <span className="ls-command-icon">
                        <CommandIcon item={item} />
                      </span>
                    )}
                    {section !== "排版" && (
                      <span className="ls-command-copy">
                        <span>{item.title}</span>
                        {section === "更多块" && item.subtext && (
                          <small>{item.subtext}</small>
                        )}
                      </span>
                    )}
                  </div>
                </EditorTooltip>
              ),
            )}
          </div>
        </section>
      ))}
      {!items.length && (
        <div className="ls-command-empty" role="status">
          {loadingState === "loaded" ? "没有匹配的内容" : "正在查找…"}
        </div>
      )}
    </div>
  );
}

export function BlockNoteCommandMenu() {
  const editor = useBlockNoteEditor();
  return (
    <SuggestionMenuController<(query: string) => Promise<Command[]>>
      triggerCharacter="/"
      suggestionMenuComponent={CommandPalette}
      getItems={async (query) => {
        const commands: Command[] = getDefaultReactSlashMenuItems(editor)
          .filter((item) => {
            const key =
              "key" in item && typeof item.key === "string" ? item.key : "";
            return (
              key !== "image" &&
              key !== "video" &&
              key !== "toggle_list" &&
              !key.startsWith("toggle_heading")
            );
          })
          .map((item) => {
            const key =
              "key" in item && typeof item.key === "string"
                ? item.key
                : item.title;
            return {
              ...item,
              title: labels[key] || item.title,
              commandKey: key,
              section: formatKeys.includes(key)
                ? "排版"
                : basicKeys.includes(key)
                  ? "基础"
                  : "更多块",
              onItemClick: (...args: Parameters<typeof item.onItemClick>) => {
                item.onItemClick(...args);
                try {
                  localStorage.setItem(
                    storageKey,
                    JSON.stringify(
                      [
                        key,
                        ...recentKeys().filter((value) => value !== key),
                      ].slice(0, 3),
                    ),
                  );
                } catch {
                  /* Storage is optional. */
                }
              },
            };
          });
        for (const type of ["image", "video"] as const) {
          if (!(type in editor.schema.blockSchema)) {
            continue;
          }
          commands.push({
            title: type === "image" ? "图片" : "视频",
            subtext: "上传素材或使用 AI 创作",
            aliases: [
              type,
              "AI",
              type === "image" ? "image" : "video",
              type === "image" ? "图片卡片" : "视频卡片",
            ],
            commandKey: type,
            section: "基础",
            onItemClick: () => {
              insertOrUpdateBlockForSlashMenu(editor, {
                type,
                props: { aiEnabled: true },
              } as any);
            },
          });
        }
        const order = [...formatKeys, ...basicKeys];
        commands.sort(
          (a, b) =>
            (order.includes(a.commandKey) ? order.indexOf(a.commandKey) : 100) -
            (order.includes(b.commandKey) ? order.indexOf(b.commandKey) : 100),
        );
        if (query.trim()) {
          return filterSuggestionItems(commands, query).map((item) => ({
            ...item,
            section: "搜索结果",
          }));
        }
        const recent = recentKeys().flatMap((key) => {
          const item = commands.find((command) => command.commandKey === key);
          return item ? [{ ...item, section: "最近使用" }] : [];
        });
        return [...recent, ...commands];
      }}
    />
  );
}
