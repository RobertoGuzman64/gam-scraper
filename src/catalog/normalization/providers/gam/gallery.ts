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

const gamImageIdentifier = (value: string): number | null => {
  const match = /^https:\/\/online\.gamrentals\.com\/(\d+)-product_main_2x\/[^/?#]+\.(?:jpe?g|png|webp|avif)$/iu.exec(value);
  if (!match) return null;
  const identifier = Number(match[1]);
  return Number.isSafeInteger(identifier) ? identifier : null;
};

const hasSeparatedGamMediaGroups = (images: readonly string[]): boolean => {
  if (images.length !== 8) return false;
  const names = images.map(gamImageName);
  const principal = names[0];
  if (!principal || names.slice(0, 4).some((name) => name !== principal) ||
    names.slice(4).filter((name) => name === principal).length < 3) return false;
  const identifiers = images.map(gamImageIdentifier);
  const first = identifiers[0];
  if (first === null || first === undefined) return false;
  if (!identifiers.slice(0, 4).every((identifier, index) => identifier === first + index)) return false;
  const tail = identifiers.slice(4);
  if (tail.some((identifier) => identifier === null)) return false;
  const adjacentIndices = tail.flatMap((identifier, index) =>
    identifier !== null && Math.abs(identifier - first) <= 4 ? [index] : []);
  if (adjacentIndices.length > 0 &&
    !(adjacentIndices.length === 1 && adjacentIndices[0] === 2 &&
      Math.abs(tail[2]! - first) === 4 && names[7] !== principal)) return false;
  return tail.every((identifier, index) => identifier !== null &&
    tail.every((other, otherIndex) => index === otherIndex ||
      (other !== null && Math.abs(identifier - other) > 1)));
};

const hasSeparatedGamSingleRecommendation = (images: readonly string[], own: number): boolean => {
  if (own < 5 || images.length !== own + 1) return false;
  const first = gamImageIdentifier(images[0] ?? "");
  const last = gamImageIdentifier(images[own] ?? "");
  if (first === null || last === null) return false;
  return images.slice(0, own).every((image, index) => gamImageIdentifier(image) === first + index) &&
    Math.abs(last - first) >= 1000;
};

export const excludeGamRelatedProductImages = (images: readonly string[]): readonly string[] => {
  if (hasSeparatedGamMediaGroups(images)) return images.slice(0, 4);
  if (images.length < 4) return images;
  const principal = gamImageName(images[0] ?? "");
  if (!principal) return images;
  let own = 0;
  while (own < images.length && gamImageName(images[own] ?? "") === principal) own += 1;
  const related = images.slice(own);
  if (related.length < 1 || related.length > 4) return images;
  const names = related.map(gamImageName);
  if (names.some((name) => name === null)) return images;
  if (related.length === 1) {
    if (names[0] !== principal && (own >= 8 || hasSeparatedGamSingleRecommendation(images, own))) return images.slice(0, own);
    return images;
  }
  if (related.length === 2) {
    if (own >= 6 && names[0] !== principal && names[1] !== principal &&
      names[0] !== names[1] && new Set(related).size === 2) {
      return images.slice(0, own);
    }
    return images;
  }
  const sameModelTail = related.filter((_, index) => names[index] === principal);
  if (sameModelTail.length > 0) {
    if (related.length === 4 && new Set(names).size >= 3 && new Set(related).size === 4 &&
      ((sameModelTail.length === 1 && own >= 3) || (sameModelTail.length === 2 && own >= 8)) &&
      !sameModelTail.some((image) => images.slice(0, own).includes(image))) {
      return images.slice(0, own);
    }
    return images;
  }
  if (own >= 3) return images.slice(0, own);
  if (related.length === 3 && new Set(names).size === 3 && new Set(related).size === 3) {
    return images.slice(0, own);
  }
  if (related.length === 4) {
    const counts = new Map<string, number>();
    for (const name of names) counts.set(name!, (counts.get(name!) ?? 0) + 1);
    if (counts.size >= 3 || (counts.size === 2 && new Set(related).size === 4 && [...counts.values()].every((count) => count === 2))) {
      return images.slice(0, own);
    }
  }
  return images;
};
