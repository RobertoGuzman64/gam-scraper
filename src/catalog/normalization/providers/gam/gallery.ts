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
  if (images.length < 5) return images;
  const principal = gamImageName(images[0] ?? "");
  if (!principal) return images;
  let own = 0;
  while (own < images.length && gamImageName(images[own] ?? "") === principal) own += 1;
  const related = images.slice(own);
  if (related.length < 3 || related.length > 4) return images;
  const names = related.map(gamImageName);
  if (names.some((name) => name === null || name === principal)) return images;
  if (own >= 3) return images.slice(0, own);
  if (related.length === 4 && new Set(names).size >= 3) return images.slice(0, own);
  return images;
};
