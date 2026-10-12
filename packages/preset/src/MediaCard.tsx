import { useEffect, useRef, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { Image, Video, Upload, Sparkles } from "lucide-react";

export type MediaCardKind = "aiImage" | "aiVideo";
export interface MediaCardModel {
  name: string;
  aspectRatios: string[];
  resolutions: string[];
  durations: number[];
}
export interface MediaCardTask {
  status: string;
  description?: string;
  error?: string;
}
export interface MediaCardRuntime {
  model: (kind: MediaCardKind) => Promise<MediaCardModel>;
  generate: (blockId: string) => Promise<unknown>;
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
  const props = block.props;
  const video = block.type === "aiVideo";
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(false);
  const [url, setUrl] = useState("");
  const [model, setModel] = useState<MediaCardModel>();
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [, refresh] = useState(0);
  const task = runtime?.task(props.taskId);
  const busy = task?.status === "running" || task?.status === "queued";
  const editable = editor.isEditable;
  const update = (patch: Record<string, unknown>) =>
    editor.updateBlock(block.id, { props: patch });

  useEffect(
    () => runtime?.subscribe(() => refresh((value) => value + 1)),
    [runtime],
  );
  useEffect(() => {
    let active = true;
    setUrl("");
    if (props.url) {
      Promise.resolve(
        editor.resolveFileUrl ? editor.resolveFileUrl(props.url) : props.url,
      )
        .then((value) => {
          if (active) {
            setUrl(value);
          }
        })
        .catch(() => {
          if (active) {
            setError("素材读取失败，请重新上传");
          }
        });
    }
    return () => {
      active = false;
    };
  }, [editor, props.url]);
  useEffect(() => {
    if (!props.aiEnabled || !runtime) {
      return;
    }
    let active = true;
    runtime
      .model(block.type)
      .then((value) => {
        if (active) {
          setModel(value);
          setError("");
        }
      })
      .catch((reason) => {
        if (active) {
          setError(String(reason.message || reason));
        }
      });
    return () => {
      active = false;
    };
  }, [runtime, block.type, props.aiEnabled, selected]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setSelected(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  async function upload(file?: File) {
    if (!file || !editable || uploading) {
      return;
    }
    if (!file.type.startsWith(video ? "video/" : "image/")) {
      setError(video ? "请选择视频文件" : "请选择图片文件");
      return;
    }
    setUploading(true);
    setError("");
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
    } catch (reason: any) {
      setError(reason.message || "上传失败");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      ref={root}
      className="bn-media-card"
      data-selected={selected || undefined}
      contentEditable={false}
      onPointerDown={() => setSelected(true)}
      onFocus={() => setSelected(true)}
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
      <div className="bn-media-card-toolbar">
        <span>
          {video ? <Video size={16} /> : <Image size={16} />}
          {video ? "视频卡片" : "图片卡片"}
        </span>
        {editable && (
          <div>
            <button
              type="button"
              role="switch"
              aria-checked={props.aiEnabled}
              aria-label="AI 创作"
              onClick={() => update({ aiEnabled: !props.aiEnabled })}
            >
              <Sparkles size={15} /> AI {props.aiEnabled ? "开启" : "关闭"}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => input.current?.click()}
              aria-label={video ? "上传视频" : "上传图片"}
            >
              <Upload size={16} />
            </button>
          </div>
        )}
      </div>
      <div
        className="bn-media-card-preview"
        style={{
          aspectRatio: url
            ? undefined
            : (props.aspectRatio || "16:9").replace(":", "/"),
        }}
      >
        {url ? (
          video ? (
            <video src={url} controls preload="metadata" />
          ) : (
            <img
              src={url}
              alt={props.caption || props.name || "图片"}
              loading="lazy"
            />
          )
        ) : (
          <button
            type="button"
            disabled={!editable || uploading}
            onClick={() => input.current?.click()}
          >
            {video ? <Video size={32} /> : <Image size={32} />}
            <span>
              {uploading
                ? "正在上传…"
                : video
                  ? "上传或拖入视频"
                  : "上传或拖入图片"}
            </span>
          </button>
        )}
        {busy && (
          <div role="status" className="bn-media-card-status">
            {task?.description || "正在生成…"}
          </div>
        )}
      </div>
      {props.caption && (
        <div className="bn-media-card-caption">{props.caption}</div>
      )}
      {editable && props.aiEnabled && selected && (
        <div className="bn-media-card-config">
          <textarea
            aria-label="生成提示词"
            placeholder={video ? "描述想生成的视频…" : "描述想生成的图片…"}
            value={props.prompt}
            onChange={(event) => update({ prompt: event.target.value })}
            rows={3}
          />
          <div className="bn-media-card-options">
            <span title={model?.name}>{model?.name || "默认模型"}</span>
            <select
              aria-label="比例"
              value={props.aspectRatio}
              onChange={(event) => update({ aspectRatio: event.target.value })}
            >
              <option value="">默认比例</option>
              {model?.aspectRatios.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="分辨率"
              value={props.resolution}
              onChange={(event) => update({ resolution: event.target.value })}
            >
              <option value="">默认分辨率</option>
              {model?.resolutions.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            {video && (
              <select
                aria-label="视频时长"
                value={props.duration}
                onChange={(event) =>
                  update({ duration: Number(event.target.value) })
                }
              >
                {[
                  ...new Set([props.duration, ...(model?.durations || [])]),
                ].map((value) => (
                  <option key={value} value={value}>
                    {value} 秒
                  </option>
                ))}
              </select>
            )}
            {busy ? (
              <button
                type="button"
                onClick={() => runtime?.cancel(props.taskId)}
              >
                停止
              </button>
            ) : (
              <button
                type="button"
                disabled={!runtime || !props.prompt.trim() || uploading}
                onClick={() => {
                  setError("");
                  void runtime
                    ?.generate(block.id)
                    .catch((reason) => setError(reason.message || "生成失败"));
                }}
              >
                生成
              </button>
            )}
          </div>
        </div>
      )}
      {(error || task?.error) && (
        <div role="alert" className="bn-media-card-error">
          {error || task?.error}
        </div>
      )}
      <input
        ref={input}
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
        <MediaCard block={block} editor={editor} runtime={runtime} />
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
