import {
  MantineContext,
  MantineProvider,
  Tooltip,
  type TooltipProps,
} from "@mantine/core";
import { useContext } from "react";

/** Shared editor tooltip, also usable by page chrome outside BlockNoteView. */
export function EditorTooltip({
  className,
  classNames,
  colorScheme,
  ...props
}: TooltipProps & { colorScheme?: "light" | "dark" }) {
  const context = useContext(MantineContext);
  const tooltip = (
    <Tooltip
      openDelay={300}
      closeDelay={80}
      events={{ hover: true, focus: true, touch: false }}
      withinPortal
      zIndex={1100}
      {...props}
      data-color-scheme={colorScheme}
      // Mantine also copies className to its trigger. Style only the tooltip slot.
      classNames={(theme, tooltipProps, ctx) => {
        const resolved =
          typeof classNames === "function"
            ? classNames(theme, tooltipProps, ctx)
            : classNames;
        return {
          ...resolved,
          tooltip: ["bn-editor-tooltip", className, resolved?.tooltip]
            .filter(Boolean)
            .join(" "),
        };
      }}
    />
  );
  return context ? (
    tooltip
  ) : (
    <MantineProvider forceColorScheme={colorScheme || "light"}>
      {tooltip}
    </MantineProvider>
  );
}
