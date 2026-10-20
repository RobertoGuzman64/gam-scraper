import type * as cheerio from "cheerio";

const urlFrom = (candidate: string | undefined, pageUrl: string): string | null => {
  if (!candidate || /^(?:data:|blob:|javascript:)/i.test(candidate.trim())) return null;
  try {
    const url = new URL(candidate.trim(), pageUrl);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (!/\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(url.toString())) return null;
    if (/(?:logo|sprite|placeholder|avatar|icon|favicon|no-image|es-default)/i.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
};

const firstSrcsetUrl = (value: string | undefined): string | undefined =>
  value?.split(",").map((part) => part.trim().split(/\s+/)[0]).find((part) => Boolean(part));

export const collectProductImages = (
  $: cheerio.CheerioAPI,
  pageUrl: string,
  selectors: readonly string[]
): readonly string[] => {
  const images = new Set<string>();
  const push = (value: string | undefined): void => {
    const url = urlFrom(value, pageUrl);
    if (url) images.add(url);
  };

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const node = $(element);
      const candidates = [node, ...node.find("a[href], img, source, [data-image]").toArray().map((child) => $(child))];
      for (const candidate of candidates) {
        for (const name of ["data-large_image", "data-zoom-image", "data-full", "data-image", "data-src", "data-lazy", "href", "src"]) {
          push(candidate.attr(name));
        }
        push(firstSrcsetUrl(candidate.attr("data-srcset")));
        push(firstSrcsetUrl(candidate.attr("srcset")));
      }
    });
  }

  if (images.size === 0) {
    push($("meta[property='og:image']").first().attr("content"));
    push($("meta[name='twitter:image']").first().attr("content"));
  }
  return [...images];
};
