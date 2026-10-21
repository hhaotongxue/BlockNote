import { useEffect, useRef, useState, type ReactNode } from "react";
import { Popover } from "@mantine/core";
import {
  createReactBlockSpec,
  PortalElementOverride,
  usePortalElement,
} from "@blocknote/react";
import { Image, Video, SlidersHorizontal, Shell } from "lucide-react";

import { parseMediaElement } from "./mediaImport.js";
import { mediaRatio, removeMediaCard } from "./mediaLayout.js";

export type MediaCardKind = "image" | "video";
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
  previewWidth: number;
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
  editCaption: () => void;
  remove: () => void;
  close: () => void;
}
export interface MediaCardRuntime {
  /** Opt-in only: retain stored captions/alt text without exposing visible captions. */
  captionsEnabled?: boolean;
  pickFile?: (
    blockId: string,
    kind: MediaCardKind,
  ) => Promise<{ url: string; name: string } | null>;
  renderImagePreview?: (src: string, onClose: () => void) => ReactNode;
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
  previewWidth: { default: 0 },
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
  const video = block.type === "video";
  const portalElement = usePortalElement();
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const captionPanel = useRef<HTMLDivElement>(null);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [captionOpen, setCaptionOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [nearViewport, setNearViewport] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  const [motionVisible, setMotionVisible] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  const [hovered, setHovered] = useState(false);
  const [resolvedMedia, setResolvedMedia] = useState({ source: "", url: "" });
  const url = resolvedMedia.source === props.url ? resolvedMedia.url : "";
  const [dimensions, setDimensions] = useState({
    source: "",
    width: 0,
    height: 0,
  });
  const [resizeWidth, setResizeWidth] = useState<number | null>(null);
  const resize = useRef<{
    x: number;
    width: number;
    maximum: number;
  } | null>(null);
  const loaded = dimensions.source === url;
  const ratio = mediaRatio(
    loaded ? dimensions.width : 0,
    loaded ? dimensions.height : 0,
    props.aspectRatio,
  );
  const [uploading, setUploading] = useState(false);
  const [, refresh] = useState(0);
  const task = runtime?.task(props.taskId);
  const busy = task?.status === "running" || task?.status === "queued";
  const editable = editor.isEditable;
  const update = (patch: Partial<MediaCardValues>) =>
    editor.updateBlock(block.id, { props: patch });

  // Defer native file reads as well as browser image loading for offscreen cards.
  useEffect(() => {
    const element = card.current;
    if (!element) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        setMotionVisible(visible);
        if (visible) {
          setNearViewport(true);
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!runtime || !props.taskId) {
      return;
    }
    function snapshot() {
      const current = runtime?.task(props.taskId);
      return [current?.status, current?.description, current?.error];
    }
    let previous = snapshot();
    return runtime.subscribe(() => {
      const next = snapshot();
      if (next.some((value, index) => value !== previous[index])) {
        previous = next;
        refresh((value) => value + 1);
      }
    });
  }, [runtime, props.taskId]);
  useEffect(() => {
    let active = true;
    if (nearViewport && props.url) {
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
  }, [editor, props.url, runtime, nearViewport]);
  useEffect(() => {
    if (!captionOpen && !toolbarOpen && !panelOpen) {
      return;
    }
    function outside(event: PointerEvent) {
      const target = event.target as Node;
      if (captionOpen && !captionPanel.current?.contains(target)) {
        editor.updateBlock(block.id, { props: { caption: captionDraft } });
        setCaptionOpen(false);
      }
      if (
        ![
          card.current,
          toolbar.current,
          panel.current,
          captionPanel.current,
        ].some((element) => element?.contains(target))
      ) {
        setPanelOpen(false);
        setToolbarOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanelOpen(false);
        setToolbarOpen(false);
      }
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape);
    };
  }, [toolbarOpen, panelOpen, captionOpen, captionDraft, editor, block.id]);

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
    upload: () => {
      if (!runtime?.pickFile) {
        fileInput?.click();
        return;
      }
      if (uploading || !editable) {
        return;
      }
      setUploading(true);
      void runtime
        .pickFile(block.id, block.type)
        .then((result) => {
          const current = editor.getBlock(block.id);
          if (
            !result ||
            !current ||
            current.type !== block.type ||
            current.props.url !== props.url
          ) {
            return;
          }
          if (props.taskId) {
            runtime.cancel(props.taskId);
          }
          update({ ...result, aiEnabled: false, taskId: "" });
        })
        .catch(() => runtime.notifyError?.("导入失败，请重试"))
        .finally(() => setUploading(false));
    },
    editCaption: () => {
      if (!runtime?.captionsEnabled) {
        return;
      }
      setCaptionDraft(props.caption);
      setCaptionOpen(true);
    },
    remove: () => {
      if (props.taskId && busy) {
        runtime?.cancel(props.taskId);
      }
      removeMediaCard(editor, block.id);
    },
    close: () => {
      setPanelOpen(false);
      setToolbarOpen(false);
    },
  };
  const portalProps = portalElement ? { target: portalElement } : undefined;
  return (
    <div
      ref={card}
      className="bn-media-card"
      data-selected={toolbarOpen || panelOpen || undefined}
      data-kind={block.type}
      data-block-id={block.id}
      draggable={editable && !video}
      style={{
        width: resizeWidth ?? (props.previewWidth || "100%"),
        maxWidth: "100%",
      }}
      contentEditable={false}
      onClick={(event) => {
        if (editable && card.current?.contains(event.target as Node)) {
          setToolbarOpen(true);
        }
      }}
      onMouseEnter={() => {
        if (video) {
          setHovered(true);
        }
      }}
      onMouseLeave={() => {
        if (video) {
          setHovered(false);
        }
      }}
      onDrop={(event) => {
        if (!editable) {
          return;
        }
        if (!event.dataTransfer.files.length) {
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
      <style>{`.bn-block-outer[data-id=${JSON.stringify(block.id)}] { --bn-media-ratio: ${ratio}; }`}</style>
      {editable && (
        <Popover
          opened={toolbarOpen && Boolean(runtime?.renderMediaToolbar)}
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
            data-captions-enabled={runtime?.captionsEnabled === true}
            role="toolbar"
            aria-label={video ? "视频操作" : "图片操作"}
          >
            <Popover
              opened={captionOpen}
              onClose={() => {
                update({ caption: captionDraft });
                setCaptionOpen(false);
              }}
              position="bottom"
              offset={8}
              width="target"
              withinPortal
              portalProps={portalProps}
              floatingStrategy="fixed"
              closeOnClickOutside={false}
              closeOnEscape={false}
              middlewares={{ flip: false, shift: true }}
            >
              <Popover.Target>
                <div>{runtime?.renderMediaToolbar?.(context)}</div>
              </Popover.Target>
              <Popover.Dropdown
                ref={captionPanel}
                className="bn-media-card-panel bn-media-caption-panel"
                role="dialog"
                aria-label={video ? "视频说明" : "图片说明"}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setCaptionOpen(false);
                  }
                }}
              >
                <form
                  className="bn-media-caption-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    update({ caption: captionDraft });
                    setCaptionOpen(false);
                  }}
                >
                  <input
                    autoFocus
                    type="text"
                    aria-label="素材说明内容"
                    placeholder="添加素材说明…"
                    value={captionDraft}
                    onChange={(event) => setCaptionDraft(event.target.value)}
                  />
                </form>
              </Popover.Dropdown>
            </Popover>
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
          <div className="bn-media-card-frame">
            <div
              className="bn-media-card-preview"
              data-busy={busy || uploading || undefined}
              data-motion={motionVisible || undefined}
              data-ready={(loaded && dimensions.width > 0) || undefined}
              aria-busy={Boolean(busy || uploading)}
              style={{
                aspectRatio: url ? undefined : String(ratio),
              }}
            >
              {url ? (
                video ? (
                  <video
                    src={url}
                    controls={hovered || toolbarOpen || panelOpen}
                    preload="metadata"
                    onLoadedMetadata={(event) =>
                      setDimensions({
                        source: url,
                        width: event.currentTarget.videoWidth,
                        height: event.currentTarget.videoHeight,
                      })
                    }
                    onClick={() => setHovered(true)}
                  />
                ) : (
                  <img
                    src={url}
                    alt={props.caption || props.name || "图片"}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setToolbarOpen(false);
                      setPanelOpen(false);
                      setCaptionOpen(false);
                      setImagePreviewOpen(true);
                    }}
                    onLoad={(event) =>
                      setDimensions({
                        source: url,
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      })
                    }
                  />
                )
              ) : (
                !(busy || uploading) && (
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
                )
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
                <div
                  role="status"
                  aria-live="polite"
                  className="bn-media-card-status"
                >
                  <Shell size={30} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    {uploading
                      ? "正在上传…"
                      : task?.status === "queued"
                        ? "等待生成…"
                        : video
                          ? "正在生成视频"
                          : "正在生成图片"}
                  </span>
                </div>
              )}
            </div>
            {editable && (
              <button
                type="button"
                className="bn-media-resize"
                aria-label={video ? "缩放视频" : "缩放图片"}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const node = card.current;
                  if (!node) {
                    return;
                  }
                  resize.current = {
                    x: event.clientX,
                    width: node.getBoundingClientRect().width,
                    maximum:
                      node.parentElement?.clientWidth || node.clientWidth,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const initial = resize.current;
                  if (!initial) {
                    return;
                  }
                  setResizeWidth(
                    Math.min(
                      initial.maximum,
                      Math.max(64, initial.width + (event.clientX - initial.x)),
                    ),
                  );
                }}
                onPointerUp={(event) => {
                  if (!resize.current) {
                    return;
                  }
                  const initial = resize.current;
                  const width = Math.min(
                    initial.maximum,
                    Math.max(64, initial.width + (event.clientX - initial.x)),
                  );
                  resize.current = null;
                  setResizeWidth(null);
                  update({ previewWidth: width });
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={() => {
                  resize.current = null;
                  setResizeWidth(null);
                }}
                onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) {
                    return;
                  }
                  event.preventDefault();
                  const node = card.current;
                  if (node) {
                    update({
                      previewWidth: Math.min(
                        node.parentElement?.clientWidth || node.clientWidth,
                        Math.max(
                          64,
                          node.clientWidth +
                            (event.key === "ArrowRight" ? 16 : -16),
                        ),
                      ),
                    });
                  }
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 13H13V3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="square"
                  />
                </svg>
              </button>
            )}
          </div>
        </Popover.Target>
        <Popover.Dropdown
          ref={panel}
          className="bn-media-card-panel bn-media-card-generation-panel"
          role="dialog"
          aria-label={video ? "视频生成配置" : "图片生成配置"}
        >
          {runtime?.renderMediaPanel?.({
            ...context,
            close: () => setPanelOpen(false),
          })}
        </Popover.Dropdown>
      </Popover>
      {runtime?.captionsEnabled && props.caption && (
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
      {imagePreviewOpen &&
        url &&
        !video &&
        runtime?.renderImagePreview?.(url, () => setImagePreviewOpen(false))}
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
      meta: { fileBlockAccept: [type === "video" ? "video/*" : "image/*"] },
      runsBefore: ["file"],
      parse: (element) => parseMediaElement(element, type),
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
            {type === "video" ? (
              <video src={url} controls />
            ) : (
              <img src={url} alt={caption} />
            )}
            {runtime?.captionsEnabled && caption && (
              <figcaption>{caption}</figcaption>
            )}
          </figure>
        );
      },
    },
  )();
  // External documents retain alt text; visible captions require explicit opt-in.
  spec.implementation.toExternalHTML = (block) => {
    const figure = document.createElement("figure");
    const url = String(block.props.url || "");
    if (url) {
      const media = document.createElement(type === "video" ? "video" : "img");
      media.setAttribute("src", url);
      if (type === "video") {
        media.setAttribute("controls", "");
      } else {
        media.setAttribute("alt", String(block.props.caption || ""));
      }
      figure.append(media);
      if (runtime?.captionsEnabled && block.props.caption) {
        const caption = document.createElement("figcaption");
        caption.textContent = String(block.props.caption);
        figure.append(caption);
      }
    }
    return { dom: figure };
  };
  return spec;
}
