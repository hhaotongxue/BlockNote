import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import styles from "./page.module.less";

export interface DocumentActionItem {
  id: string;
  label: string;
  confirmation?: string;
  run: () => Promise<void>;
}

/** Host-owned document actions rendered with the shared page menu. */
export function DocumentActionItems({
  items,
  onComplete,
}: {
  items: DocumentActionItem[];
  onComplete: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<DocumentActionItem | null>(null);
  async function select(item: DocumentActionItem) {
    if (busy) {
      return;
    }
    setPending(null);
    setBusy(true);
    setFailed(false);
    try {
      await item.run();
      onComplete();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {pending ? (
        <div
          role="group"
          aria-label="确认文档转换"
          className={styles.documentActionConfirmation}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setPending(null);
            }
          }}
        >
          <p>{pending.confirmation}</p>
          <div>
            <button autoFocus onClick={() => setPending(null)}>
              取消
            </button>
            <button onClick={() => void select(pending)}>确认转换</button>
          </div>
        </div>
      ) : (
        items.map((item) => (
          <button
            key={item.id}
            className={styles.menuItem}
            disabled={busy}
            onClick={() =>
              item.confirmation ? setPending(item) : void select(item)
            }
          >
            <ArrowUpRight size={14} />
            <span>{item.label}</span>
          </button>
        ))
      )}
      {failed && (
        <p role="alert" className={styles.documentActionError}>
          操作失败，请重试
        </p>
      )}
    </>
  );
}
