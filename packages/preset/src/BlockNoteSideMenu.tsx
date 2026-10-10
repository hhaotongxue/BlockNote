import { SideMenuExtension } from "@blocknote/core/extensions";
import { SideMenuController, useExtensionState } from "@blocknote/react";

type FloatingOptions = NonNullable<
  Parameters<typeof SideMenuController>[0]["floatingUIOptions"]
>;

// Use the public positioning hook. Editing, dragging and non-text block menus
// continue to use BlockNote's implementations.
const textLinePosition: FloatingOptions = {
  useFloatingOptions: {
    middleware: [
      {
        name: "lianshuFirstLine",
        fn({ y, elements, rects }) {
          const reference = elements.reference;
          const element =
            reference instanceof Element ? reference : reference.contextElement;
          const inline =
            element?.querySelector<HTMLElement>(".bn-inline-content");
          if (!inline) {
            return {};
          }
          const style = getComputedStyle(inline);
          const lineHeight = Number.parseFloat(style.lineHeight);
          if (!Number.isFinite(lineHeight)) {
            return {};
          }
          const top =
            inline.getBoundingClientRect().top -
            reference.getBoundingClientRect().top;
          return { y: y + top + lineHeight / 2 - rects.floating.height / 2 };
        },
      },
    ],
  },
};

export function BlockNoteSideMenu() {
  const textBlock = useExtensionState(SideMenuExtension, {
    selector: (state) =>
      !!state &&
      [
        "heading",
        "paragraph",
        "bulletListItem",
        "numberedListItem",
        "checkListItem",
      ].includes(state.block.type),
  });
  return (
    <SideMenuController
      floatingUIOptions={textBlock ? textLinePosition : undefined}
    />
  );
}
