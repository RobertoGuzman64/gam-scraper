import type { ProductRecord } from "../../../../../contracts/catalog.js";

const normalized = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "");

const ownSpec = (record: ProductRecord, key: string): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const kilograms = (value: string | null): number | null => {
  const match = value ? /^(\d{1,6})\s*kg$/iu.exec(value) : null;
  const amount = match?.[1] ? Number(match[1]) : null;
  return amount !== null && amount >= 100 && amount <= 100000 ? amount : null;
};

const shortCapacityMatches = (description: string, capacity: number): boolean => {
  const values = [...description.matchAll(/\b(\d[\d.,\s]*)\s*kg\b/giu)]
    .map((match) => Number((match[1] ?? "").replace(/\D/g, "")));
  return values.length === 1 && values[0] === capacity;
};

const titleCapacityMatches = (title: string, capacity: number): boolean =>
  [...title.matchAll(/\b(\d[\d.,\s]*)\s*kg\b/giu)]
    .every((match) => Number((match[1] ?? "").replace(/\D/g, "")) === capacity);

const ownIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" ||
    !record.reference || !record.title || !record.brand || !record.model ||
    !record.shortDescription || !record.longDescription ||
    normalized(ownSpec(record, "Marca") ?? "") !== normalized(record.brand) ||
    normalized(ownSpec(record, "Modelo") ?? "") !== normalized(record.model) ||
    (record.externalReference && normalized(record.externalReference) !== normalized(record.model)) ||
    !normalized(record.title).includes(normalized(record.brand)) ||
    !normalized(record.title).includes(normalized(record.model)) ||
    !normalized(record.shortDescription).includes(normalized(`${record.brand} ${record.model}`)) ||
    normalized(record.longDescription).includes(normalized(record.model))) return false;

  try {
    const url = new URL(record.url);
    const slug = url.pathname.split("/").at(-1) ?? "";
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" &&
      slug.startsWith(`${record.reference}-`) &&
      normalized(slug).includes(normalized(record.model)) && !url.search && !url.hash;
  } catch {
    return false;
  }
};

const logitransGeneric = (record: ProductRecord): boolean => {
  if (record.brand !== "LOGITRANS" ||
    !["apiladores-nuevos", "marcas-nuevas"].includes(record.categoryKey) ||
    !/^(?:Apilador|Transpaleta) /iu.test(record.title ?? "")) return false;
  const text = record.longDescription ?? "";
  return /^(?:El apilador facilita una manipulación óptima de mercancías|En entornos de trabajo muy agresivos y exigentes con la maquinaria|Este tipo de elevadores ofrecen la máxima calidad y seguridad|La principal diferencia con otros modelos de transpaletas inoxidables de Logitrans)/u.test(text);
};

const reachStackerGeneric = (record: ProductRecord): boolean =>
  record.brand === "HYSTER" && record.categoryKey === "marcas-nuevas" &&
  /^Reach Stacker Hyster /iu.test(record.title ?? "") &&
  /^(?:Hyster ofrece una completa gama de apiladores ReachStacker|El diseño de la nueva pluma hidráulica ha demostrado)/u.test(record.longDescription ?? "");

const reachStackerMeasurements = (record: ProductRecord): string | null => {
  const height = ownSpec(record, "Altura de elevación (m)");
  const heightMatch = height ? /^(\d{1,2}(?:[.,]\d{1,3})?)\s*metros?$/iu.exec(height) : null;
  const weight = kilograms(ownSpec(record, "Peso"));
  if (!heightMatch?.[1] || weight === null ||
    Number(heightMatch[1].replace(",", ".")) < 10 ||
    Number(heightMatch[1].replace(",", ".")) > 20 ||
    !record.shortDescription || !/\b15 metros\b/iu.test(record.shortDescription)) return null;
  return ` Su altura de elevación publicada es de ${heightMatch[1]} m y su peso de ${weight} kg.`;
};

export const resolveGamModelSpecificGeneral = (record: ProductRecord): string | null => {
  if (!ownIdentity(record)) return null;
  const logitrans = logitransGeneric(record);
  const reachStacker = reachStackerGeneric(record);
  if (!logitrans && !reachStacker) return null;

  const capacity = kilograms(ownSpec(record, "Capacidad de carga (kg)"));
  if (capacity === null || !record.shortDescription || !record.title || !record.brand || !record.model ||
    !record.longDescription || !shortCapacityMatches(record.shortDescription, capacity) ||
    !titleCapacityMatches(record.title, capacity)) return null;

  const motorizacion = ownSpec(record, "Motorización");
  if (logitrans && motorizacion && (motorizacion !== "Eléctrico" ||
    !/el[eé]ctric[oa]/iu.test(record.title))) return null;

  const measurements = reachStacker ? reachStackerMeasurements(record) : "";
  if (reachStacker && measurements === null) return null;
  const heading = logitrans
    ? `${record.title.startsWith("Apilador") ? "El apilador" : "La transpaleta"} Logitrans ${record.model}`
    : `El Reach Stacker ${record.brand} ${record.model}`;
  return `${heading} tiene una capacidad de carga publicada de ${capacity} kg.${measurements ?? ""}\n\n${record.longDescription.trim()}`;
};
