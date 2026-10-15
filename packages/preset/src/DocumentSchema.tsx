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
import { createPresetCodeBlockSpec } from "./CodeBlock.js";
import { createMediaCardSpec, type MediaCardRuntime } from "./MediaCard.js";

import { documentBlockNames } from "./documentContent.js";
import { createMediaRowSpec } from "./MediaRow.js";

export interface DocumentReferenceOptions {
  media?: MediaCardRuntime;
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
      [documentBlockNames.mediaRow]: createMediaRowSpec(),
      image: createMediaCardSpec("image", options.media),
      video: createMediaCardSpec("video", options.media),
      codeBlock: createPresetCodeBlockSpec(),
      [documentBlockNames.mathBlock]: createReactMathBlockSpec(),
      [documentBlockNames.bookmark]: createReactBlockSpec(
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
                {/* Lucide file-input geometry (ISC). */}
                <svg
                  className="bn-doc-reference-icon"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M4 11V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1" />
                  <path d="M14 2v5a1 1 0 0 0 1 1h5" />
                  <g>
                    <path d="M2 15h10" />
                    <path d="m9 18 3-3-3-3" />
                  </g>
                </svg>{" "}
                {label || target?.title || "未命名文档"}
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
