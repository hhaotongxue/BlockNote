import { useEffect, useRef, useState } from "react";
import { Combobox, MantineProvider, useCombobox } from "@mantine/core";
import { EditorTooltip } from "@blocknote/mantine";
import { codeBlockOptions } from "@blocknote/code-block";
import { Check, ChevronDown, Copy, WrapText } from "lucide-react";

const languages = Object.entries(codeBlockOptions.supportedLanguages);

export function CodeBlockToolbar({
  language,
  editable,
  initialWrap,
  toolbar,
  changeLanguage,
  getCode,
  setWrap,
}: {
  language: string;
  editable: () => boolean;
  initialWrap: boolean;
  toolbar: HTMLElement;
  changeLanguage: (language: string) => void;
  getCode: () => string;
  setWrap: (wrap: boolean) => void;
}) {
  const [wrap, updateWrap] = useState(initialWrap);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setSearch("");
    },
  });
  useEffect(() => {
    if (combobox.dropdownOpened) {
      combobox.searchRef.current?.focus({ preventScroll: true });
    }
  }, [combobox.dropdownOpened, combobox.searchRef]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const container = toolbar.closest(".bn-container");
    function updateTheme() {
      setDark(container?.getAttribute("data-color-scheme") === "dark");
    }
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    if (container) {
      observer.observe(container, {
        attributes: true,
        attributeFilter: ["data-color-scheme"],
      });
    }
    return () => {
      mounted.current = false;
      observer.disconnect();
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [toolbar]);
  const selected = languages.find(
    ([id, entry]) =>
      id === language ||
      (entry.aliases as readonly string[]).includes(language),
  )?.[0];
  const languageLabel =
    selected === "text"
      ? "纯文本"
      : languages.find(([id]) => id === selected)?.[1].name ||
        language ||
        "纯文本";
  const copyLabel =
    copyState === "copied"
      ? "已复制"
      : copyState === "failed"
        ? "复制失败，请重试"
        : "复制代码";
  const languageOptions = [
    ...(!selected
      ? [{ value: language, label: language || "纯文本", aliases: [] }]
      : []),
    ...languages.map(([id, entry]) => ({
      value: id,
      label: id === "text" ? "纯文本" : entry.name,
      aliases: entry.aliases,
    })),
  ].filter((entry) =>
    [entry.value, entry.label, ...entry.aliases].some((value) =>
      value.toLowerCase().includes(search.trim().toLowerCase()),
    ),
  );
  async function copyCode() {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    try {
      await navigator.clipboard.writeText(getCode());
      if (mounted.current) {
        setCopyState("copied");
      }
    } catch {
      if (mounted.current) {
        setCopyState("failed");
      }
    }
    if (mounted.current) {
      timer.current = setTimeout(() => setCopyState("idle"), 2000);
    }
  }
  return (
    <MantineProvider
      forceColorScheme={dark ? "dark" : "light"}
      getRootElement={() => toolbar}
      withCssVariables={false}
      withGlobalClasses={false}
    >
      <div
        className="bn-preset-code-actions"
        role="group"
        aria-label="代码块工具栏"
        data-language-open={combobox.dropdownOpened || undefined}
      >
        <div className="bn-preset-code-language">
          <Combobox
            store={combobox}
            position="bottom-end"
            width={280}
            offset={6}
            floatingStrategy="fixed"
            withinPortal
            portalProps={{ target: toolbar }}
            onOptionSubmit={(value) => {
              combobox.closeDropdown();
              combobox.targetRef.current?.focus({ preventScroll: true });
              changeLanguage(value);
            }}
          >
            <Combobox.Target>
              <EditorTooltip
                label="切换代码语言"
                colorScheme={dark ? "dark" : "light"}
              >
                <button
                  type="button"
                  aria-label="代码语言"
                  disabled={!editable()}
                  onClick={() => combobox.toggleDropdown()}
                >
                  <span>{languageLabel}</span>
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
              </EditorTooltip>
            </Combobox.Target>
            <Combobox.Dropdown className="bn-preset-code-language-menu">
              <Combobox.Search
                aria-label="搜索代码语言"
                placeholder="搜索语言…"
                value={search}
                onChange={(event) => {
                  setSearch(event.currentTarget.value);
                  combobox.updateSelectedOptionIndex();
                }}
                classNames={{
                  wrapper: "bn-preset-code-language-search-wrapper",
                  input: "bn-preset-code-language-search",
                }}
              />
              <Combobox.Options className="bn-preset-code-language-options">
                {languageOptions.map((entry) => (
                  <Combobox.Option
                    key={entry.value}
                    value={entry.value}
                    active={entry.value === (selected ?? language)}
                    className="bn-preset-code-language-option"
                  >
                    <span>{entry.label}</span>
                    {entry.value === (selected ?? language) && (
                      <Check size={14} aria-hidden="true" />
                    )}
                  </Combobox.Option>
                ))}
                {!languageOptions.length && (
                  <Combobox.Empty>未找到语言</Combobox.Empty>
                )}
              </Combobox.Options>
            </Combobox.Dropdown>
          </Combobox>
        </div>
        <EditorTooltip label={copyLabel} colorScheme={dark ? "dark" : "light"}>
          <button
            type="button"
            className="bn-preset-code-copy"
            aria-label="复制代码"
            onClick={copyCode}
          >
            {copyState === "copied" ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
          </button>
        </EditorTooltip>
        <EditorTooltip
          label={wrap ? "关闭自动换行" : "开启自动换行"}
          colorScheme={dark ? "dark" : "light"}
        >
          <button
            type="button"
            className="bn-preset-code-wrap"
            aria-label="自动换行"
            aria-pressed={wrap}
            onClick={() => {
              setWrap(!wrap);
              updateWrap(!wrap);
            }}
          >
            <WrapText size={16} aria-hidden="true" />
          </button>
        </EditorTooltip>
      </div>
      <span className="bn-preset-code-status" role="status">
        {copyState === "copied"
          ? "代码已复制"
          : copyState === "failed"
            ? "复制失败，请重试"
            : ""}
      </span>
    </MantineProvider>
  );
}
