import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from "@blocknote/core";
import {
  createReactBlockSpec,
  createReactInlineContentSpec,
} from "@blocknote/react";
import {
  createReactMathBlockSpec,
  createReactInlineMathSpec,
} from "@blocknote/math-block";

export interface DocumentReferenceOptions {
  resolveDocument?: (
    id: string,
  ) => { title?: string; icon?: string | null } | undefined;
  openDocument?: (id: string) => void;
}

/** Reusable renderers for the native persisted document schema. */
export function createDocumentSchema(options: DocumentReferenceOptions = {}) {
  return BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      mathBlock: createReactMathBlockSpec(),
      bookmark: createReactBlockSpec(
        {
          type: "bookmark",
          propSchema: {
            url: { default: "" },
            title: { default: "" },
            description: { default: "" },
            icon: { default: "" },
            image: { default: "" },
            caption: { default: "" },
            style: { default: "" },
          },
          content: "none",
        },
        {
          render: ({ block }) => {
            const href = /^https?:\/\//i.test(block.props.url)
              ? block.props.url
              : undefined;
            return (
              <div className="bn-preset-bookmark" contentEditable={false}>
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {block.props.title || block.props.url}
                </a>
                {block.props.description && <p>{block.props.description}</p>}
                {block.props.caption && <small>{block.props.caption}</small>}
              </div>
            );
          },
          toExternalHTML: ({ block }) => (
            <a
              href={
                /^https?:\/\//i.test(block.props.url)
                  ? block.props.url
                  : undefined
              }
            >
              {block.props.title || block.props.url}
            </a>
          ),
        },
      )(),
    },
    inlineContentSpecs: {
      ...defaultInlineContentSpecs,
      math: createReactInlineMathSpec(),
      docLink: createReactInlineContentSpec(
        {
          type: "docLink",
          propSchema: {
            docId: { default: "" },
            label: { default: "" },
          },
          content: "none",
        },
        {
          render: ({ inlineContent }) => {
            const { docId, label } = inlineContent.props;
            const target = options.resolveDocument?.(docId);
            return (
              <button
                type="button"
                className="lianshu-doc-reference"
                contentEditable={false}
                onClick={() => options.openDocument?.(docId)}
              >
                {target?.icon || "📄"} {label || target?.title || "未命名文档"}
              </button>
            );
          },
          toExternalHTML: ({ inlineContent }) => (
            <span>
              {inlineContent.props.label ||
                options.resolveDocument?.(inlineContent.props.docId)?.title ||
                "未命名文档"}
            </span>
          ),
        },
      ),
    },
  });
}
