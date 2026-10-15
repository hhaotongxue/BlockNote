/** The current cards own external HTML/Markdown media imports. */
export function parseMediaElement(
  element: HTMLElement,
  kind: "image" | "video",
) {
  const tag = kind === "image" ? "IMG" : "VIDEO";
  let media: HTMLElement | null = null;
  let caption = "";
  if (element.tagName === tag) {
    if (element.closest("figure")) {
      return undefined;
    }
    media = element;
  } else if (element.tagName === "FIGURE") {
    media = element.querySelector<HTMLElement>(tag.toLowerCase());
    caption = element.querySelector("figcaption")?.textContent || "";
  }
  if (!media) {
    return undefined;
  }
  const url =
    media.getAttribute("src") ||
    media.querySelector("source[src]")?.getAttribute("src") ||
    "";
  if (!url) {
    return undefined;
  }
  const width = Number.parseFloat(
    media.getAttribute("width") || media.style.width,
  );
  return {
    url,
    name: media.getAttribute("alt") || "",
    caption,
    ...(Number.isFinite(width) && width > 0 ? { previewWidth: width } : {}),
  };
}
