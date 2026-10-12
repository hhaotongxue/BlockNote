import { createReactBlockSpec } from "@blocknote/react";

/** Native child blocks retain their IDs, media state, and task bindings. */
export const createMediaRowSpec = createReactBlockSpec(
  { type: "mediaRow", propSchema: {}, content: "none" },
  {
    render: () => (
      <div
        className="bn-media-row-label"
        contentEditable={false}
        aria-label="图片行"
      />
    ),
    toExternalHTML: () => <div />,
  },
);
