import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold, numberToken } from "../../attribute-utils.js";

const verifiedSource = (record: ProductRecord): boolean => {
  if (record.providerId !== "mercaeleva" || !record.reference?.trim() ||
    !record.brand?.trim() || !record.model?.trim() || !record.title?.trim() ||
    fold(String(record.specs?.Marca ?? "")) !== fold(record.brand) ||
    fold(String(record.specs?.Modelo ?? "")) !== fold(record.model)) return false;
  try {
    const url = new URL(record.url);
    return url.protocol === "https:" && url.hostname === "sales.mercaeleva.com" &&
      url.pathname.startsWith("/es/for-sale/machine/") && url.pathname.endsWith(`-${record.reference}`) &&
      !url.search && !url.hash;
  } catch {
    return false;
  }
};

const resolveDocumentedPlatformTitle = (record: ProductRecord, title: string, brand: string, model: string): string | null => {
  if ((record.condition === "Segunda mano" && fold(String(record.specs?.Estado ?? "")) !== "usado") ||
    (record.condition === "Nuevo" && fold(String(record.specs?.Estado ?? "")) !== "nuevo") ||
    (record.condition !== "Segunda mano" && record.condition !== "Nuevo")) return null;
  const match = /^(.+?)\s+PLATAFORMA\s+(ARTICULADA|TIJERA|DE TIJERA|TELESCOPICA)\s+(ELECTRICA|DIESEL)\s+(\d+(?:[.,]\d+)?)\s+MT$/iu.exec(title);
  if (!match?.[1] || !match[2] || !match[3] || !match[4] ||
    fold(match[1]) !== fold(`${brand} ${model}`) ||
    fold(String(record.specs?.["Título adicional"] ?? "")) !== fold(`PLATAFORMA ${match[2]} ${match[3]} ${match[4]} MT`) ||
    fold(String(record.specs?.["Tipo de motor"] ?? "")) !== (fold(match[3]) === "electrica" ? "electrico" : "diesel")) return null;
  const height = numberToken(match[4]);
  const specHeight = /^(\d+(?:[.,]\d+)?)\s+m$/iu.exec(String(record.specs?.["Altura de trabajo"] ?? ""));
  const description = fold(record.longDescription ?? "");
  const descriptionHeight = /\baltura de trabajo\s+(\d+(?:[.,]\d+)?)\s+mt\b/u.exec(description);
  if (height === null || !specHeight?.[1] || !descriptionHeight?.[1] ||
    numberToken(specHeight[1]) !== height || numberToken(descriptionHeight[1]) !== height ||
    !description.includes(fold(`PLATAFORMA ${match[2]} ${match[3]}`))) return null;
  const compact = (value: string): string => fold(value).replace(/[^\p{L}\p{N}]+/gu, "");
  const documentedIdentity = compact(description).includes(compact(`${brand} ${model}`));
  if (!documentedIdentity && (compact(model).length < 5 || !compact(description).includes(compact(model)))) return null;
  const family = fold(match[2]) === "articulada" ? "articulada" : fold(match[2]) === "telescopica" ? "telescópica" : "de tijera";
  const drive = fold(match[3]) === "electrica" ? "eléctrica" : "diésel";
  return `Plataforma ${family} ${drive} ${brand} ${model} de ${match[4].replace(".", ",")} m`;
};

const resolveDocumentedElectricForkliftTitle = (record: ProductRecord, title: string, brand: string, model: string): string | null => {
  if (record.condition !== "Segunda mano" || fold(String(record.specs?.Estado ?? "")) !== "usado" ||
    fold(String(record.specs?.["Tipo de Batería"] ?? "")) !== "plomo-acido") return null;
  const match = /^(.+?)\s+CARRETILLA\s+ELEVADORA\s+ELECTRICA\s+(\d{3,5})\s+KG$/iu.exec(title);
  if (!match?.[1] || !match[2] || fold(match[1]) !== fold(`${brand} ${model}`) ||
    fold(String(record.specs?.["Título adicional"] ?? "")) !== fold(`CARRETILLA ELEVADORA ELECTRICA ${match[2]} KG`)) return null;
  const capacity = numberToken(match[2]);
  const specCapacity = /^(\d[\d., ]*)\s*kg$/iu.exec(String(record.specs?.["Capacidad máxima de elevación"] ?? ""));
  const description = fold(record.longDescription ?? "");
  const describedCapacity = /\bcarretilla\s+elevadora\s+electrica\s+(\d[\d., ]*)\s+kg\b/u.exec(description);
  const compact = (value: string): string => fold(value).replace(/[^\p{L}\p{N}]+/gu, "");
  if (capacity === null || !specCapacity?.[1] || !describedCapacity?.[1] ||
    numberToken(specCapacity[1]) !== capacity || numberToken(describedCapacity[1]) !== capacity ||
    !compact(description).includes(compact(`${brand} ${model}`))) return null;
  return `Carretilla elevadora eléctrica ${brand} ${model} de ${capacity.toLocaleString("es-ES")} kg`;
};

const resolveDocumentedTruckBasketTitle = (record: ProductRecord, title: string, brand: string, model: string): string | null => {
  if (record.condition !== "Segunda mano" || fold(String(record.specs?.Estado ?? "")) !== "usado" ||
    fold(String(record.specs?.["Tipo de motor"] ?? "")) !== "diesel") return null;
  const match = /^(.+?)\s+CAMION CESTA(?:\s+(\d+(?:[.,]\d+)?)\s+MT)?\s+(TELESCOPICO|ARTICULADO)\s+ALUMINIO\s+(\d+(?:[.,]\d+)?)\s+MT$/iu.exec(title);
  if (!match?.[1] || !match[3] || !match[4] ||
    fold(match[1]) !== fold(`${brand} ${model}`) ||
    fold(String(record.specs?.["Título adicional"] ?? "")) !== fold(title.slice(match[1].length).trim())) return null;
  const height = numberToken(match[4]);
  const specHeight = /^(\d+(?:[.,]\d+)?)\s+m$/iu.exec(String(record.specs?.["Altura de trabajo"] ?? ""));
  const description = fold(record.longDescription ?? "");
  const described = /\bcamion cesta(?:\s+(\d+(?:[.,]\d+)?)\s+mt)?\s+(telescopico|articulado)\s+aluminio\s+altura de trabajo\s+(\d+(?:[.,]\d+)?)\s+mt\b/u.exec(description);
  const compact = (value: string): string => fold(value).replace(/[^\p{L}\p{N}]+/gu, "");
  if (height === null || !specHeight?.[1] || !described?.[2] || !described[3] ||
    numberToken(specHeight[1]) !== height || numberToken(described[3]) !== height ||
    (match[2] !== undefined && numberToken(match[2]) !== height) ||
    (described[1] !== undefined && numberToken(described[1]) !== height) ||
    fold(described[2]) !== fold(match[3]) ||
    !compact(description).includes(compact(`${brand} ${model}`))) return null;
  const family = fold(match[3]) === "telescopico" ? "telescópico" : "articulado";
  return `Camión cesta ${family} de aluminio ${brand} ${model} de ${match[4].replace(".", ",")} m`;
};

export const resolveMercaelevaEditorialTitle = (record: ProductRecord): string | null => {
  if (!verifiedSource(record)) return null;
  const title = record.title?.trim();
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  if (!title || !brand || !model) return null;
  const platformTitle = resolveDocumentedPlatformTitle(record, title, brand, model);
  if (platformTitle) return platformTitle;
  const forkliftTitle = resolveDocumentedElectricForkliftTitle(record, title, brand, model);
  if (forkliftTitle) return forkliftTitle;
  const truckBasketTitle = resolveDocumentedTruckBasketTitle(record, title, brand, model);
  if (truckBasketTitle) return truckBasketTitle;
  if (record.condition === "Segunda mano" &&
    fold(title) === fold(`${brand} ${model} TRANSPALET ELECTRICO`) &&
    fold(String(record.specs?.["Título adicional"] ?? "")) === "transpalet electrico" &&
    fold(String(record.specs?.Estado ?? "")) === "usado" &&
    fold(record.longDescription ?? "").includes("transpalet electrico")) {
    return `Transpaleta eléctrica ${brand} ${model}`;
  }
  if (record.condition !== "Nuevo" ||
    fold(String(record.specs?.["Tipo de motor"] ?? "")) !== "electrico" ||
    !/^NUEVA!{2,3}\s+PLATAFORMA\b/iu.test(record.longDescription?.trim() ?? "")) return null;
  const match = /^(.+?)\s+NUEVA!{2,3}\s+PLATAFORMA\s+(ARTICULADA|TIJERA)\s+ELECTRICA\s+(\d+)\s+MT$/iu.exec(title);
  if (!match?.[1] || !match[2] || !match[3] ||
    fold(match[1]) !== fold(`${brand} ${model}`) ||
    fold(String(record.specs?.["Altura de trabajo"] ?? "")) !== `${match[3]} m` ||
    !fold(record.longDescription ?? "").includes(`plataforma ${fold(match[2])} electrica`)) return null;
  const family = fold(match[2]) === "articulada" ? "Plataforma articulada" : "Plataforma de tijera";
  return `${family} eléctrica ${brand} ${model} de ${match[3]} m`;
};
