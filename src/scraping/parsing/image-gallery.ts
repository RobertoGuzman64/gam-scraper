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

const urlsFromSrcset = (value: string | undefined): readonly string[] =>
  value?.split(",").map((part) => part.trim().split(/\s+/)[0]).filter((url): url is string => Boolean(url)) ?? [];

export const identifyWordPressImage = (value: string): { readonly identity: string; readonly rank: number } => {
  const url = new URL(value);
  const dimensions = url.pathname.match(/-(\d{2,4})x(\d{2,4})(?=\.(?:jpe?g|png|webp|avif)$)/i);
  return {
    identity: `${url.origin}${url.pathname.replace(/-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp|avif)$)/i, "")}`,
    rank: dimensions ? Number(dimensions[1]) * Number(dimensions[2]) : 1_000_000_000
  };
};

const imageIdentity = (url: string, mode: "gam" | "mercaeleva" | "gomariz" | undefined): string => {
  const path = new URL(url).pathname;
  if (mode === "gam") return path.replace(/-(?:product_main_2x|large_default|medium_default|small_default|home_default|cart_default|thickbox_default)(?=\.)/i, "");
  if (mode === "mercaeleva") return path.replace(/\/public\/(?:medium|thumbnail|large|original)\//i, "/public/");
  if (mode === "gomariz") return identifyWordPressImage(url).identity;
  return url;
};

const score = (url: string, source: string, mode: "gam" | "mercaeleva" | "gomariz" | undefined): number => {
  const name = new URL(url).pathname;
  if (mode === "gomariz") return identifyWordPressImage(url).rank;
  let rank = source === "data-large_image" || source === "data-zoom-image" || source === "data-full" ? 30 : 0;
  if (mode === "gam") {
    if (/product_main_2x/i.test(name)) rank += 100;
    else if (/large_default|product_main/i.test(name)) rank += 40;
    else if (/small_default|cart_default|medium_default/i.test(name)) rank -= 40;
  }
  if (mode === "mercaeleva") {
    const u = new URL(url);
    const width = Number(u.searchParams.get("width") ?? u.searchParams.get("w") ?? 0);
    if (Number.isFinite(width) && width > 0) rank += Math.min(width, 3000) / 100;
    if (/\/public\/(?:original|large)\//i.test(name)) rank += 100;
    else if (/\/public\/medium\//i.test(name)) rank += 50;
    if (/thumb|thumbnail|small/i.test(name)) rank -= 30;
  }
  return rank;
};

export const collectProductImages = (
  $: cheerio.CheerioAPI,
  pageUrl: string,
  selectors: readonly string[],
  mode?: "gam" | "mercaeleva" | "gomariz"
): readonly string[] => {
  const images = new Map<string, { readonly url: string; readonly rank: number; readonly position: number }>();
  let position = 0;
  const push = (value: string | undefined, source: string): void => {
    const url = urlFrom(value, pageUrl);
    if (!url) return;
    const key = imageIdentity(url, mode);
    const rank = score(url, source, mode);
    const previous = images.get(key);
    if (!previous || rank > previous.rank) images.set(key, { url, rank, position: previous?.position ?? position });
    position += 1;
  };

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const node = $(element);
      const candidates = [node, ...node.find("a[href], img, source, [data-image]").toArray().map((child) => $(child))];
      for (const candidate of candidates) {
        for (const name of ["data-large_image", "data-zoom-image", "data-full", "data-image", "data-src", "data-lazy", "href", "src"]) {
          push(candidate.attr(name), name);
        }
        for (const url of urlsFromSrcset(candidate.attr("data-srcset"))) push(url, "data-srcset");
        for (const url of urlsFromSrcset(candidate.attr("srcset"))) push(url, "srcset");
      }
    });
  }

  if (images.size === 0) {
    push($("meta[property='og:image']").first().attr("content"), "meta");
    push($("meta[name='twitter:image']").first().attr("content"), "meta");
  }
  const ordered = [...images.values()];
  if (mode === "gam") ordered.sort((a, b) => b.rank - a.rank || a.position - b.position);
  else ordered.sort((a, b) => a.position - b.position);
  return ordered.map((entry) => entry.url);
};
