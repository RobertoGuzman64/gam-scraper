import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../legacy-export/contracts.js";

const specString = (candidate: ImportCandidate, key: string): string | null => {
  const value = candidate.spec[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export const reconstructMercaelevaSource = (candidate: ImportCandidate): ProductRecord => {
  if (candidate.providerId !== "mercaeleva" || !candidate.sourceUrl.startsWith("https://sales.mercaeleva.com/es/for-sale/machine/")) {
    throw new Error(`Sin original canónico ni reconstrucción segura: ${candidate.providerId}:${candidate.reference ?? candidate.sourceUrl}`);
  }
  return {
    providerId: candidate.providerId, categoryKey: "venta", categoryName: candidate.category ?? "Maquinaria en venta",
    url: candidate.sourceUrl, title: candidate.title, shortDescription: candidate.description,
    longDescription: candidate.description_general, price: candidate.price === null ? null : String(candidate.price),
    condition: candidate.condition === "Segunda_Mano" ? "Segunda mano" : candidate.condition === "Nuevo" ? "Nuevo" : null,
    reference: candidate.reference, brand: specString(candidate, "Marca"), model: specString(candidate, "Modelo"),
    year: specString(candidate, "Año de fabricación"), location: null, country: null,
    horometer: specString(candidate, "Horas laborales"), serialNumber: null,
    image: candidate.image, images: candidate.images, specs: candidate.spec
  };
};
