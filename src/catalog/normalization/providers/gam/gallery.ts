const gamImageName = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" || url.search || url.hash) return null;
    const match = /^\/\d+-product_main_2x\/([^/]+\.(?:jpe?g|png|webp|avif))$/iu.exec(url.pathname);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
};

export const excludeGamRelatedProductImages = (images: readonly string[]): readonly string[] => {
  if (images.length < 6) return images;
  const principal = gamImageName(images[0] ?? "");
  if (!principal) return images;
  let own = 0;
  while (own < images.length && gamImageName(images[own] ?? "") === principal) own += 1;
  const related = images.slice(own);
  if (own < 3 || related.length < 3 || related.length > 4 ||
    related.some((image) => {
      const name = gamImageName(image);
      return name === null || name === principal;
    })) return images;
  return images.slice(0, own);
};
