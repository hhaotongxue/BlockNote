import { useEffect, useRef, useState, type ReactNode } from "react";
import { Popover } from "@mantine/core";
import {
  createReactBlockSpec,
  PortalElementOverride,
  usePortalElement,
} from "@blocknote/react";
import { Image, Video, SlidersHorizontal } from "lucide-react";

export type MediaCardKind = "aiImage" | "aiVideo";
export interface MediaCardTask {
  status: string;
  description?: string;
  error?: string;
}
export interface MediaCardValues {
  url: string;
  caption: string;
  name: string;
  aiEnabled: boolean;
  prompt: string;
  modelKey: string;
  aspectRatio: string;
  resolution: string;
  duration: number;
  taskId: string;
}
/** Slot content is owned by the host. The editor owns the floating containers. */
export interface MediaCardSlotContext {
  blockId: string;
  kind: MediaCardKind;
  values: MediaCardValues;
  resolvedUrl: string;
  portalTarget?: HTMLElement;
  busy: boolean;
  uploading: boolean;
  update: (patch: Partial<MediaCardValues>) => void;
  upload: () => void;
  remove: () => void;
  close: () => void;
}
export interface MediaCardRuntime {
  renderMediaToolbar?: (context: MediaCardSlotContext) => ReactNode;
  renderMediaPanel?: (context: MediaCardSlotContext) => ReactNode;
  notifyError?: (message: string) => void;
  task: (taskId: string) => MediaCardTask | undefined;
  subscribe: (listener: () => void) => () => void;
  cancel: (taskId: string) => void;
}

export const mediaCardProps = {
  url: { default: "" },
  caption: { default: "" },
  name: { default: "" },
  aiEnabled: { default: false },
  prompt: { default: "" },
  modelKey: { default: "" },
  aspectRatio: { default: "" },
  resolution: { default: "" },
  duration: { default: 5 },
  taskId: { default: "" },
} as const;

function MediaCard({
  block,
  editor,
  runtime,
}: {
  block: any;
  editor: any;
  runtime?: MediaCardRuntime;
}) {
  const props: MediaCardValues = block.props;
  const video = block.type === "aiVideo";
  const portalElement = usePortalElement();
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [resolvedMedia, setResolvedMedia] = useState({ source: "", url: "" });
  const url = resolvedMedia.source === props.url ? resolvedMedia.url : "";
  const [uploading, setUploading] = useState(false);
  const [, refresh] = useState(0);
  const task = runtime?.task(props.taskId);
  const busy = task?.status === "running" || task?.status === "queued";
  const editable = editor.isEditable;
  const update = (patch: Partial<MediaCardValues>) =>
    editor.updateBlock(block.id, { props: patch });

  useEffect(
    () => runtime?.subscribe(() => refresh((value) => value + 1)),
    [runtime],
  );
  useEffect(() => {
    let active = true;
    if (props.url) {
      Promise.resolve(
        editor.resolveFileUrl ? editor.resolveFileUrl(props.url) : props.url,
      )
        .then((value) => {
          if (active) {
            setResolvedMedia({ source: props.url, url: value });
          }
        })
        .catch(() => {
          if (active) {
            runtime?.notifyError?.("素材读取失败，请重新上传");
          }
        });
    }
    return () => {
      active = false;
    };
  }, [editor, props.url, runtime]);
  useEffect(() => {
    if (!panelOpen) {
      return;
    }
    function outside(event: PointerEvent) {
      const target = event.target as Node;
      if (
        ![card.current, toolbar.current, panel.current].some((element) =>
          element?.contains(target),
        )
      ) {
        setPanelOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanelOpen(false);
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [panelOpen]);

  async function upload(file?: File) {
    if (!file || !editable || uploading) {
      return;
    }
    if (!file.type.startsWith(video ? "video/" : "image/")) {
      runtime?.notifyError?.(video ? "请选择视频文件" : "请选择图片文件");
      return;
    }
    setUploading(true);
    try {
      if (!editor.uploadFile) {
        throw new Error("当前编辑器未配置上传服务");
      }
      const result = await editor.uploadFile(file, block.id);
      if (!editor.getBlock(block.id)) {
        return;
      }
      if (props.taskId) {
        runtime?.cancel(props.taskId);
      }
      update({
        url: typeof result === "string" ? result : result.props.url,
        name: file.name,
        aiEnabled: false,
        taskId: "",
      });
    } catch {
      runtime?.notifyError?.("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  }

  const context: MediaCardSlotContext = {
    blockId: block.id,
    kind: block.type,
    values: props,
    resolvedUrl: url,
    portalTarget: portalElement || undefined,
    busy: Boolean(busy),
    uploading,
    update,
    upload: () => fileInput?.click(),
    remove: () => {
      if (props.taskId && busy) {
        runtime?.cancel(props.taskId);
      }
      editor.removeBlocks([block.id]);
    },
    close: () => setPanelOpen(false),
  };
  const portalProps = portalElement ? { target: portalElement } : undefined;
  return (
    <div
      ref={card}
      className="bn-media-card"
      data-selected={panelOpen || undefined}
      contentEditable={false}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDrop={(event) => {
        if (!editable) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        void upload(event.dataTransfer.files[0]);
      }}
      onDragOver={(event) => {
        if (editable) {
          event.preventDefault();
        }
      }}
    >
      {editable && (
        <Popover
          opened={panelOpen && Boolean(runtime?.renderMediaToolbar)}
          position="top"
          offset={12}
          width="max-content"
          withinPortal
          portalProps={portalProps}
          floatingStrategy="fixed"
          closeOnClickOutside={false}
          closeOnEscape={false}
          middlewares={{ flip: false, shift: true }}
        >
          <Popover.Target>
            <span className="bn-media-card-top-anchor" aria-hidden="true" />
          </Popover.Target>
          <Popover.Dropdown
            ref={toolbar}
            className="bn-media-card-panel bn-media-card-toolbar-panel"
            role="toolbar"
            aria-label={video ? "视频操作" : "图片操作"}
          >
            {runtime?.renderMediaToolbar?.(context)}
          </Popover.Dropdown>
        </Popover>
      )}
      <Popover
        opened={
          editable &&
          panelOpen &&
          props.aiEnabled &&
          Boolean(runtime?.renderMediaPanel)
        }
        position="bottom"
        offset={12}
        width={620}
        withinPortal
        portalProps={portalProps}
        floatingStrategy="fixed"
        closeOnClickOutside={false}
        closeOnEscape={false}
        middlewares={{ flip: false, shift: true }}
      >
        <Popover.Target>
          <div
            className="bn-media-card-preview"
            style={{
              aspectRatio: (props.aspectRatio || "16:9").replace(":", "/"),
            }}
          >
            {url ? (
              video ? (
                <video
                  src={url}
                  controls={hovered || panelOpen}
                  preload="metadata"
                  onClick={() => setHovered(true)}
                />
              ) : (
                <img
                  src={url}
                  alt={props.caption || props.name || "图片"}
                  loading="lazy"
                />
              )
            ) : (
              <span
                className="bn-media-card-placeholder"
                role="img"
                aria-label={video ? "视频卡片" : "图片卡片"}
              >
                {video ? (
                  <Video size={28} strokeWidth={1.5} />
                ) : (
                  <Image size={28} strokeWidth={1.5} />
                )}
              </span>
            )}
            {editable && (
              <button
                type="button"
                className="bn-media-card-trigger"
                onClick={() => setPanelOpen((value) => !value)}
                aria-label={video ? "视频设置" : "图片设置"}
                aria-expanded={panelOpen}
                aria-haspopup="dialog"
              >
                <SlidersHorizontal size={17} />
              </button>
            )}
            {(busy || uploading) && (
              <div role="status" className="bn-media-card-status">
                {uploading ? "正在上传…" : task?.description || "正在生成…"}
              </div>
            )}
          </div>
        </Popover.Target>
        <Popover.Dropdown
          ref={panel}
          className="bn-media-card-panel bn-media-card-generation-panel"
          role="dialog"
          aria-label={video ? "视频生成配置" : "图片生成配置"}
        >
          {runtime?.renderMediaPanel?.(context)}
        </Popover.Dropdown>
      </Popover>
      {props.caption && (
        <div className="bn-media-card-caption">{props.caption}</div>
      )}
      <input
        ref={setFileInput}
        type="file"
        accept={video ? "video/*" : "image/*"}
        hidden
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

export function createMediaCardSpec<T extends MediaCardKind>(
  type: T,
  runtime?: MediaCardRuntime,
) {
  const spec = createReactBlockSpec(
    { type, propSchema: mediaCardProps, content: "none" },
    {
      meta: { fileBlockAccept: [type === "aiVideo" ? "video/*" : "image/*"] },
      render: ({ block, editor }) => (
        <PortalElementOverride
          target={typeof document === "undefined" ? undefined : document.body}
        >
          <MediaCard block={block} editor={editor} runtime={runtime} />
        </PortalElementOverride>
      ),
      toExternalHTML: ({ block }) => {
        const url = String(block.props.url || "");
        const caption = String(block.props.caption || "");
        if (!url) {
          return <span />;
        }
        return (
          <figure>
            {type === "aiVideo" ? (
              <video src={url} controls />
            ) : (
              <img src={url} alt={caption} />
            )}
            {caption && <figcaption>{caption}</figcaption>}
          </figure>
        );
      },
    },
  )();
  // External documents contain only media and its caption, never task/config metadata.
  spec.implementation.toExternalHTML = (block) => {
    const figure = document.createElement("figure");
    const url = String(block.props.url || "");
    if (url) {
      const media = document.createElement(
        type === "aiVideo" ? "video" : "img",
      );
      media.setAttribute("src", url);
      if (type === "aiVideo") {
        media.setAttribute("controls", "");
      } else {
        media.setAttribute("alt", String(block.props.caption || ""));
      }
      figure.append(media);
      if (block.props.caption) {
        const caption = document.createElement("figcaption");
        caption.textContent = String(block.props.caption);
        figure.append(caption);
      }
    }
    return { dom: figure };
  };
  return spec;
}
