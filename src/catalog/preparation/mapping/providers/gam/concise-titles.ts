import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../attribute-utils.js";

const compact = (value: string): string => fold(value).replace(/[^a-z0-9]/gu, "");

const kinds: Readonly<Record<string, { readonly name: string; readonly evidence: RegExp }>> = {
  "ciclomotores-electricos-segunda-mano": { name: "Ciclomotor eléctrico", evidence: /\bciclomotor electrico\b/u },
  "motocicletas-electricas-segunda-mano": { name: "Motocicleta eléctrica", evidence: /\bmotocicleta electrica\b/u }
};

export const resolveGamConciseTitle = (record: ProductRecord): string | null => {
  if (record.providerId !== "gam" || record.categoryKey !== "maquinaria" || record.condition !== "Segunda mano" ||
    !record.reference || !record.brand?.trim() || !record.model?.trim() || !record.title?.trim() ||
    fold(record.title) !== fold(`${record.brand} ${record.model}`) ||
    !record.shortDescription?.trim() || !record.longDescription?.trim() ||
    typeof record.specs?.Marca !== "string" || typeof record.specs?.Modelo !== "string" ||
    typeof record.specs?.["Tipo motor"] !== "string" ||
    fold(record.specs.Marca) !== fold(record.brand) ||
    fold(record.specs.Modelo) !== fold(record.model) ||
    fold(record.specs["Tipo motor"]) !== "electrico") return null;

  let url: URL;
  try {
    url = new URL(record.url);
  } catch {
    return null;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
    !!url.search || !!url.hash || segments.length !== 3 || segments[0] !== "es") return null;
  const section = segments[1];
  const kind = section ? kinds[section] : undefined;
  const slug = segments[2];
  if (!kind || !slug?.startsWith(`${record.reference}-`) ||
    !compact(slug.slice(record.reference.length + 1)).includes(compact(`${record.brand} ${record.model}`)) ||
    !kind.evidence.test(fold(record.shortDescription)) ||
    !kind.evidence.test(fold(record.longDescription)) ||
    !compact(record.shortDescription).includes(compact(record.model)) ||
    !compact(record.longDescription).includes(compact(record.model))) return null;

  return `${kind.name} ${record.title.trim()}`;
};
