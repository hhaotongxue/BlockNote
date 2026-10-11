import { useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import styles from "./page.module.less";

export interface DocumentLinkItem {
  id: string;
  title?: string | null;
  icon?: string | null;
}

export function DocumentLinks({
  backlinks,
  outlinks,
  onSelectDoc,
}: {
  backlinks: DocumentLinkItem[];
  outlinks: DocumentLinkItem[];
  onSelectDoc?: (id: string) => void;
}) {
  const contentId = useId();
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(
    null,
  );
  const hasLinks = backlinks.length + outlinks.length > 0;
  const expanded = expandedOverride ?? hasLinks;
  const groups = [
    { label: "引用此文", items: backlinks },
    { label: "本文引用", items: outlinks },
  ].filter((group) => group.items.length > 0);

  return (
    <section className={styles.bidirectionalLinks} aria-label="关联链接">
      <div className={styles.linksHeader}>
        <span className={styles.linksTitleArea}>关联链接</span>
        <button
          type="button"
          className={styles.linksToggleBtn}
          aria-label={expanded ? "收起关联链接" : "展开关联链接"}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpandedOverride(!expanded)}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
      {expanded && (
        <div id={contentId} className={styles.linksContent}>
          {hasLinks ? (
            <div
              className={styles.linksColumns}
              data-single-column={groups.length === 1}
            >
              {groups.map((group) => (
                <div key={group.label} className={styles.linksColumn}>
                  <div className={styles.columnHeader}>
                    {group.label} · {group.items.length}
                  </div>
                  <div className={styles.columnList}>
                    {group.items.map((link) => (
                      <button
                        key={link.id}
                        type="button"
                        className={styles.linkCard}
                        onClick={() => onSelectDoc?.(link.id)}
                      >
                        <span className={styles.linkCardIcon}>
                          {link.icon || "📄"}
                        </span>
                        <span className={styles.linkCardTitle}>
                          {link.title || "未命名文档"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noLinksMsg}>尚无关联文档</div>
          )}
        </div>
      )}
    </section>
  );
}
