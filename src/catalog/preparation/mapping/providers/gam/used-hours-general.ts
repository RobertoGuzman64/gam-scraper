import type { ProductRecord } from "../../../../../contracts/catalog.js";

const verifiedHours: Readonly<Record<string, string>> = {
  "6901": "1616 horas",
  "6979": "2998 horas",
  "6985": "2613 horas",
  "6077": "327 horas",
  "6202": "444 horas",
  "5730": "1642 horas",
  "6998": "2214 horas",
  "6614": "4679 horas",
  "6616": "3446 horas",
  "6615": "3639 horas",
  "6854": "410 horas",
  "6855": "234 horas",
  "6856": "369 horas",
  "6864": "288 horas",
  "5979": "673 horas",
  "6362": "434 horas",
  "6063": "964 horas",
  "6064": "946 horas",
  "6065": "1042 horas",
  "6109": "1260 horas",
  "6204": "612 horas"
};

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

export const resolveGamUsedHoursGeneral = (record: ProductRecord, general: string | null): string | null => {
  const reference = record.reference;
  const model = record.model?.trim();
  const brand = record.brand?.trim();
  const title = record.title?.trim();
  const year = record.year?.trim();
  const hourText = record.horometer?.trim();
  const sourceGeneral = record.longDescription?.trim();
  const originalHours = record.specs?.["Horómetro"];
  if (record.providerId !== "gam" || record.categoryKey !== "elevacion" ||
    record.condition !== "Segunda mano" || !reference || !Object.hasOwn(verifiedHours, reference) ||
    !model || !brand || !title || !year || !hourText || !sourceGeneral || !general ||
    general.trim() !== sourceGeneral ||
    typeof originalHours !== "string" || originalHours.trim() !== hourText ||
    verifiedHours[reference] !== hourText ||
    !/^[1-9]\d{0,5} horas$/u.test(hourText) || !/^(?:19|20)\d{2}$/u.test(year) ||
    !normalize(title).includes(normalize(model)) || !normalize(title).includes(normalize(brand)) ||
    !normalize(sourceGeneral).includes(normalize(model)) ||
    !normalize(sourceGeneral).includes(normalize(brand)) ||
    !normalize(general).includes(normalize(model)) ||
    !normalize(general).includes(normalize(brand)) ||
    /\b\d+\s*horas\b|\bhor[oó]metro\b/iu.test(general) ||
    [...sourceGeneral.matchAll(/\b(?:19|20)\d{2}\b/gu)].some((match) => match[0] !== year)) return null;

  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    const slug = path[2] ?? "";
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      path.length !== 3 || path[0] !== "es" ||
      !/^plataformas-elevadoras-(?:tijera|articuladas)/u.test(path[1] ?? "") ||
      !slug.startsWith(`${reference}-${year}-`) ||
      !normalize(slug).includes(normalize(model)) || url.search || url.hash) return null;
  } catch {
    return null;
  }

  return `El horómetro de esta unidad registra ${hourText}, según la ficha del proveedor.\n\n${general}`;
};
