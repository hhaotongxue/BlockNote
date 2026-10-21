import { X } from "lucide-react";
export interface MaterialImportStatus {
  id: string;
  name: string;
  completed: number;
  total?: number;
  phase: "copying" | "saving" | "done" | "error";
}
export function MaterialImportProgress({
  items,
  onDismiss,
}: {
  items: readonly MaterialImportStatus[];
  onDismiss: (id: string) => void;
}) {
  if (!items.length) {
    return null;
  }
  return (
    <div className="bn-material-imports" aria-label="素材导入进度">
      {items.map((item) => {
        const percent =
          item.phase === "done"
            ? 100
            : item.total
              ? Math.min(99, Math.floor((item.completed / item.total) * 100))
              : undefined;
        const label =
          item.phase === "saving"
            ? "校验保存中"
            : item.phase === "done"
              ? "导入完成"
              : item.phase === "error"
                ? "导入失败，请重试"
                : "正在导入";
        return (
          <section key={item.id}>
            <div>
              <span title={item.name}>{item.name}</span>
              {(item.phase === "done" || item.phase === "error") && (
                <button
                  type="button"
                  onClick={() => onDismiss(item.id)}
                  aria-label="关闭导入提示"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <progress
              max={100}
              value={percent}
              aria-label={`${item.name} ${label}`}
            />
            <small role="status">
              {label}
              {item.phase === "copying" && percent !== undefined
                ? ` · ${percent}%`
                : item.phase === "done"
                  ? " · 100%"
                  : ""}
            </small>
          </section>
        );
      })}
    </div>
  );
}
