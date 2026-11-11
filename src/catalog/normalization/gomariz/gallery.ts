export const gomarizImageReference = (image: string | null): string | null => {
  const path = image?.split(/[?#]/u, 1)[0] ?? "";
  const name = path.slice(path.lastIndexOf("/") + 1);
  const match = /^([a-z]{1,5}\d{3,8})[-_]/iu.exec(name);
  return match?.[1]?.toUpperCase() ?? null;
};

const filenameTokens = (value: string): readonly string[] =>
  (value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").match(/[A-Z0-9]+/giu) ?? [])
    .map((token) => token.toUpperCase());

export const gomarizReferenceFromGallery = (images: readonly string[], title: string): string | null => {
  const titleTokens = filenameTokens(title);
  if (images.length < 2 || titleTokens.length < 2) return null;
  let reference: string | null = null;
  for (const image of images) {
    let url: URL;
    try {
      url = new URL(image);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" || !["gomarizrent.com", "www.gomarizrent.com"].includes(url.hostname) ||
      !url.pathname.startsWith("/wp-content/uploads/")) return null;
    const candidate = gomarizImageReference(image);
    if (!candidate || (reference !== null && candidate !== reference)) return null;
    const name = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
    const modelTokens = filenameTokens(name.slice(candidate.length + 1));
    if (!titleTokens.every((token, index) => modelTokens[index] === token)) return null;
    reference = candidate;
  }
  return reference;
};

export const excludeGomarizForeignCover = (
  images: readonly string[], reference: string | null
): readonly string[] => {
  if (!reference || images.length < 3) return images;
  const ownReference = reference.trim().toUpperCase();
  const refs = images.map(gomarizImageReference);
  if (!refs[0] || refs[0] === ownReference) return images;
  const ownImages = images.filter((_, index) => refs[index] === ownReference);
  if (ownImages.length < 2 || ownImages.length !== images.length - 1) return images;
  return ownImages;
};
