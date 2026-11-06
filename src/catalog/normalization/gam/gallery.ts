import type { ProductRecord } from "../../../contracts/catalog.js";

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

const selectGamOwnImages = (images: readonly string[]): readonly string[] => {
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

const compactIdentity = (value: string): string => value.toLocaleLowerCase("es").normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").replace(/[^a-z0-9]/gu, "");

const modelSpecificGamImages = (images: readonly string[], source: ProductRecord | undefined): readonly string[] => {
  if (!source || source.providerId !== "gam" || images.length < 3 || images.length > 24) return images;
  const brand = compactIdentity(source.brand ?? "");
  const model = compactIdentity(source.model ?? "");
  if (brand.length < 3 || model.length < 4 ||
    brand !== compactIdentity(String(source.specs?.["Marca"] ?? "")) ||
    model !== compactIdentity(String(source.specs?.["Modelo"] ?? ""))) return images;
  const names = images.map(gamImageName);
  if (names.some((name) => name === null)) return images;
  const ownModel = (name: string | null): boolean => {
    const normalized = compactIdentity(name ?? "");
    return normalized.includes(brand) && normalized.includes(model);
  };
  if (images.length >= 6) {
    const nonModelIndices = names.flatMap((name, index) => ownModel(name) ? [] : [index]);
    if (nonModelIndices.length === 1 && nonModelIndices[0]! >= 5 &&
      compactIdentity(names[nonModelIndices[0]!] ?? "").includes(brand)) {
      return images.filter((_, index) => index !== nonModelIndices[0]);
    }
  }
  if (images.length > 8) return images;
  let ownCount = 0;
  while (ownCount < names.length && ownModel(names[ownCount] ?? null)) ownCount += 1;
  if (ownCount < 1 || ownCount > 4 || names.length - ownCount < 2 || names.length - ownCount > 4) return images;
  const related = names.slice(ownCount);
  if (new Set(related).size < 2 || related.some((name) => {
    const normalized = compactIdentity(name ?? "");
    return !normalized.includes(brand) || normalized.includes(model);
  })) return images;
  return images.slice(0, ownCount);
};

const yalePalletTruckModelByImageName = new Map<string, string>([
  ["transpaleta-propulsada-con-ion-de-litio", "mpc15"],
  ["transpaleta-electrica-a-pie-yale-mpc15-doble-bateria", "mpc15doblebateria"],
  ["transpaleta-de-plataforma-de-alta-productividad", "mp20xv"]
]);

const recognizedGamModelInImage = (url: string, brand: string): string | null => {
  const filename = gamImageName(url)?.replace(/\.(?:jpe?g|png|webp|avif)$/iu, "");
  if (!filename) return null;
  if (brand === "cte") {
    const match = /(?:^|-)traccess-(\d{3})(e?)$/u.exec(filename);
    return match ? `traccess${match[1]}${match[2]}` : null;
  }
  if (brand === "yale") {
    return yalePalletTruckModelByImageName.get(filename) ??
      /(?:^|-)((?:mo|mt)\d{2,3}(?:t|tr)?)$/u.exec(filename)?.[1] ?? null;
  }
  return null;
};

const excludeGamRecognizedSiblingModels = (
  images: readonly string[], source: ProductRecord | undefined
): readonly string[] => {
  if (!source || source.providerId !== "gam" || source.image !== images[0] ||
    images.length < 3 || images.length > 12) return images;
  const brand = compactIdentity(source.brand ?? "");
  const model = compactIdentity(source.model ?? "");
  if (brand !== compactIdentity(String(source.specs?.["Marca"] ?? "")) ||
    model !== compactIdentity(String(source.specs?.["Modelo"] ?? ""))) return images;
  const identified = images.map((image) => recognizedGamModelInImage(image, brand));
  if (!model || identified[0] !== model || identified.some((value) => value === null)) return images;
  const foreign = identified.filter((value) => value !== model);
  const ownCount = identified.length - foreign.length;
  const yalePalletTruckRecommendations = brand === "yale" && ownCount === 1 && images.length === 3 &&
    images.every((image) => {
      const name = gamImageName(image)?.replace(/\.(?:jpe?g|png|webp|avif)$/iu, "");
      return name !== undefined && yalePalletTruckModelByImageName.has(name);
    }) && new Set(foreign).size === 2;
  if (foreign.length === 0 || (ownCount < 2 &&
    !(foreign.length >= 2 && new Set(foreign).size === 1) && !yalePalletTruckRecommendations)) return images;
  return images.filter((_, index) => identified[index] === model);
};

const yaleGp80vxCover = "https://online.gamrentals.com/14287-product_main_2x/carretilla-elevadora-diesel-yale-gp80vx-9.jpg";
const unitBathroomCover = "https://online.gamrentals.com/58917-product_main_2x/modulo-bano-unitario.jpg";
const doubleBathroomCover = "https://online.gamrentals.com/58928-product_main_2x/modulo-bano-doble-wc.jpg";

export const excludeGamRelatedProductImages = (
  images: readonly string[], source?: ProductRecord
): readonly string[] => {
  const own = excludeGamRecognizedSiblingModels(modelSpecificGamImages(selectGamOwnImages(images), source), source);
  const withoutYale = own[0] === yaleGp80vxCover
    ? own : own.filter((image) => image !== yaleGp80vxCover);
  if (withoutYale[0] !== unitBathroomCover ||
    withoutYale.filter((image) => gamImageName(image) === "modulo-bano-unitario.jpg").length < 5) return withoutYale;
  return withoutYale.filter((image) => image !== doubleBathroomCover);
};
