import type { ProductRecord } from "../../../../../contracts/catalog.js";

const verifiedUnits: Readonly<Record<string, { readonly model: string; readonly location: string }>> = {
  "6937": { model: "OPTIMUM 8", location: "GIRONA" },
  "6967": { model: "OPTIMUM 8", location: "TOLEDO" },
  "6682": { model: "H3.5FT", location: "TARRAGONA" },
  "6683": { model: "H3.5FT", location: "MURCIA" },
  "6703": { model: "H3.5FT", location: "MURCIA" },
  "6694": { model: "H2.5FT", location: "VIGO" },
  "6695": { model: "H2.5FT", location: "VIGO" },
  "6696": { model: "H2.5FT", location: "VIGO" },
  "6677": { model: "H2.5FT", location: "MURCIA" },
  "6678": { model: "H2.5FT", location: "MURCIA" },
  "6884": { model: "H2.5FT", location: "TARRAGONA" },
  "6697": { model: "H2.5FT", location: "VIGO" },
  "6803": { model: "IBIZA DOGMA", location: "OVIEDO" },
  "5950": { model: "IBIZA DOGMA", location: "MADRID" },
  "5952": { model: "IBIZA DOGMA", location: "MADRID" },
  "5953": { model: "IBIZA DOGMA", location: "MADRID" }
};

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

export const resolveGamUsedUnitGeneral = (record: ProductRecord, general: string | null): string | null => {
  const reference = record.reference;
  const evidence = reference && Object.hasOwn(verifiedUnits, reference) ? verifiedUnits[reference] : undefined;
  const model = record.model?.trim();
  const brand = record.brand?.trim();
  const title = record.title?.trim();
  const sourceGeneral = record.longDescription?.trim();
  const location = record.location?.trim();
  if (record.providerId !== "gam" || record.condition !== "Segunda mano" || !reference || !evidence ||
    !model || !brand || !title || !sourceGeneral || !general || !location ||
    model !== evidence.model || location !== evidence.location ||
    record.specs?.Ubicación !== location ||
    (record.specs.Marca !== undefined && (typeof record.specs.Marca !== "string" || normalize(record.specs.Marca) !== normalize(brand))) ||
    (record.specs.Modelo !== undefined && (typeof record.specs.Modelo !== "string" || normalize(record.specs.Modelo) !== normalize(model))) ||
    !normalize(title).includes(normalize(brand)) || !normalize(title).includes(normalize(model)) ||
    !normalize(sourceGeneral).includes(normalize(brand)) ||
    !normalize(sourceGeneral).includes(normalize(model)) ||
    !normalize(general).includes(normalize(brand)) || !normalize(general).includes(normalize(model)) ||
    general.includes(`Referencia GAM ${reference}`) ||
    /\b(?:ubicaci[oó]n|situad[ao]s?\s+en)\b/iu.test(general) ||
    !/^[A-ZÁÉÍÓÚÜÑ\s-]{3,40}$/u.test(location)) return null;

  if (record.year && /^(?:19|20)\d{2}$/u.test(record.year) &&
    [...sourceGeneral.matchAll(/\b(?:19|20)\d{2}\b/gu)].some((match) => match[0] !== record.year)) return null;

  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      parts.length !== 3 || parts[0] !== "es" || !parts[1]?.endsWith("-segunda-mano") ||
      !parts[2]?.startsWith(`${reference}-`) ||
      !normalize(parts[2]).includes(normalize(brand)) ||
      !normalize(parts[2]).includes(normalize(model)) || url.search || url.hash) return null;
  } catch {
    return null;
  }

  return `Referencia GAM ${reference}. Ubicación indicada en la ficha de origen: ${location}.\n\n${general}`;
};
