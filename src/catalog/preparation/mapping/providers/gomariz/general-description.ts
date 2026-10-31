import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { invalidGomarizPlatformHeight } from "../../../../normalization/providers/gomariz/technical.js";

const families: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "elevacion-y-trabajos-en-altura": {
    "elevador-tijera": "La plataforma de tijera",
    "brazo-articulado": "La plataforma articulada",
    "brazo-articulado-boom-lift": "La plataforma articulada",
    "elevador-mastil-vertical": "El elevador de mástil vertical"
  },
  "manipulacion-de-materiales": {
    "manipulador-telescopico": "El manipulador telescópico",
    "carretilla-industrial": "La carretilla industrial",
    "carretilla-retractil": "La carretilla retráctil"
  },
  "energia-electrica-e-iluminacion": { "torre-de-luz": "La torre de iluminación" },
  "movimiento-de-tierras-demolicion-y-compactacion": { dumper: "El dúmper" }
};

const genericGeneralPatterns: Readonly<Record<string, RegExp>> = {
  "elevador-tijera": /^Las Tijeras (?:Eléctricas|Diésel)\b/i,
  "brazo-articulado": /^Las Articuladas (?:Eléctricas|Diésel)\b/i,
  "brazo-articulado-boom-lift": /^Las Articuladas Diésel\b/i,
  "elevador-mastil-vertical": /^Los Mástiles Verticales\b/i,
  "manipulador-telescopico": /^Manipuladores\./i,
  "carretilla-industrial": /^(?:Indicadas especialmente|Máquinas destinadas)\b/i,
  "carretilla-retractil": /^Indicadas especialmente\b/i,
  "torre-de-luz": /^Las torres de iluminación\b/i,
  dumper: /^Un vehículo dúmper\b/i
};

type SourceFamily = { readonly name: string; readonly key: string };

const sourceFamily = (record: ProductRecord): SourceFamily | null => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta") return null;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || !["gomarizrent.com", "www.gomarizrent.com"].includes(url.hostname) ||
      path.length !== 4 || path[0] !== "venta") return null;
    const branch = path[1];
    const key = path[2];
    const name = branch && key ? families[branch]?.[key] : undefined;
    return name && key ? { name, key } : null;
  } catch {
    return null;
  }
};

const measurement = (value: unknown, unit: "m" | "kg"): string | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d+(?:[.,]\d{1,2})?)\s*(m|kg)$/i.exec(value.trim());
  if (!match?.[1] || match[2]?.toLowerCase() !== unit) return null;
  const numeric = Number(match[1].replace(",", "."));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return match[1].replace(".", ",");
};

const sourceIsCoherent = (record: ProductRecord, general: string, family: string): boolean => {
  const motor = record.specs?.Motor;
  if (motor !== undefined && typeof motor !== "string") return false;
  const title = record.title ?? "";
  if (motor === "Eléctrico" && /\bdi[eé]sel\b/i.test(`${title} ${general}`)) return false;
  if (motor === "Diésel" && /\bel[eé]ctric[oa]s?\b/i.test(`${title} ${general}`)) return false;
  if (motor === undefined && /\b(?:di[eé]sel|el[eé]ctric[oa]s?)\b/i.test(general)) return false;
  if (family === "elevador-mastil-vertical" && /\b(?:carretillas?|almacenaje)\b/i.test(general)) return false;
  return true;
};

const joinPhrases = (phrases: readonly string[]): string => {
  if (phrases.length === 1) return phrases[0] ?? "";
  return `${phrases.slice(0, -1).join(", ")} y ${phrases[phrases.length - 1]}`;
};

export const resolveGomarizGeneralDescription = (record: ProductRecord): string | null => {
  const family = sourceFamily(record);
  const title = record.title?.trim();
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  const general = record.longDescription?.trim();
  if (!family || !record.reference?.trim() || !title || !brand || !model || !general ||
    !title.toLocaleLowerCase("es").includes(brand.toLocaleLowerCase("es")) ||
    !title.toLocaleLowerCase("es").includes(model.toLocaleLowerCase("es")) ||
    general.toLocaleLowerCase("es").includes(model.toLocaleLowerCase("es")) ||
    !genericGeneralPatterns[family.key]?.test(general) ||
    !sourceIsCoherent(record, general, family.key) ||
    invalidGomarizPlatformHeight(record.url, record.specs ?? {})) return null;

  const specs = record.specs ?? {};
  const workingHeight = measurement(specs["Altura de trabajo"], "m");
  const platformHeight = measurement(specs["Altura plataforma"], "m");
  const capacity = measurement(specs.Capacidad, "kg");
  const length = measurement(specs.Longitud, "m");
  const width = measurement(specs.Anchura, "m");
  const weight = measurement(specs.Peso, "kg");
  const lateralReach = measurement(specs["Alcance lateral"], "m");
  if ((specs["Altura de trabajo"] !== undefined && !workingHeight) ||
    (specs["Altura plataforma"] !== undefined && !platformHeight) ||
    (specs.Capacidad !== undefined && !capacity)) return null;
  if (!workingHeight && !capacity) return null;
  if (![platformHeight, length, width, weight].some(Boolean)) return null;
  if ([workingHeight, platformHeight, capacity, length, width, weight].filter(Boolean).length < 3) return null;

  const facts = [
    workingHeight ? `una altura de trabajo de ${workingHeight} m` : null,
    capacity ? `una capacidad de ${capacity} kg` : null
  ].filter((item): item is string => item !== null);
  const details = [
    platformHeight ? `una altura de plataforma de ${platformHeight} m` : null,
    lateralReach ? `un alcance lateral de ${lateralReach} m` : null,
    length ? `una longitud de ${length} m` : null,
    width ? `una anchura de ${width} m` : null,
    weight ? `un peso de ${weight} kg` : null
  ].filter((item): item is string => item !== null);
  const motor = specs.Motor;
  const energy = motor === "Eléctrico" ? " motorización eléctrica" : motor === "Diésel" ? " motorización diésel" : null;
  const year = record.year && /^(?:19|20)\d{2}$/.test(record.year) ? `, año ${record.year},` : "";
  const first = `${family.name} ${title}${year}`;
  return `${first}${energy ? " cuenta con" + energy + "." : "."} Su ficha técnica indica ${joinPhrases(facts)}. ` +
    `También constan ${joinPhrases(details)}.`;
};
