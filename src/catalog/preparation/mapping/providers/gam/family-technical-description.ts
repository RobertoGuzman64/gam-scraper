import type { ProductRecord } from "../../../../../contracts/catalog.js";

const families = new Set([
  "apiladores-hyster", "apiladores-yale", "transpaletas-hyster", "transpaletas-yale",
  "carretillas-elevadora-diesel-yale", "carretillas-elevadoras-diesel-hyster"
]);

const normalized = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

const specification = (record: ProductRecord, key: string): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const measurement = (record: ProductRecord, key: string, unit: "mm" | "KG", minimum: number, maximum: number): number | null => {
  const value = specification(record, key);
  const match = value ? /^(\d+)\s*(mm|kg)$/iu.exec(value) : null;
  if (!match?.[1] || match[2]?.toLowerCase() !== unit.toLowerCase()) return null;
  const amount = Number(match[1]);
  return Number.isSafeInteger(amount) && amount >= minimum && amount <= maximum ? amount : null;
};

const familyIdentity = (record: ProductRecord): boolean => {
  if (record.providerId !== "gam" || record.condition !== "Nuevo" || !record.reference ||
    !record.title || !record.brand || !record.model || !record.longDescription || !record.shortDescription ||
    normalized(specification(record, "Marca") ?? "") !== normalized(record.brand) ||
    normalized(specification(record, "Modelo") ?? "") !== normalized(record.model) ||
    (record.externalReference && normalized(record.externalReference) !== normalized(record.model)) ||
    !normalized(record.title).includes(normalized(record.brand)) ||
    !normalized(record.title).includes(normalized(record.model)) ||
    !normalized(record.longDescription).includes(normalized(record.model)) ||
    !normalized(record.shortDescription).includes(normalized(record.model))) return false;

  const description = `${record.title} ${record.longDescription}`;
  const engine = specification(record, "Motorización")?.toLowerCase();
  if (engine && (/el[eé]ctric/iu.test(engine) !== /el[eé]ctric/iu.test(description))) return false;
  const engineType = specification(record, "Tipo motor")?.toLowerCase();
  if (engine === "eléctrico" && engineType && /diesel|di[eé]sel|\blpg\b|\bglp\b/iu.test(engineType)) return false;
  if (/hyster/iu.test(`${record.shortDescription} ${record.longDescription}`) && normalized(record.brand) === "yale") return false;
  if (/yale/iu.test(`${record.shortDescription} ${record.longDescription}`) && normalized(record.brand) === "hyster") return false;

  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.protocol === "https:" && url.hostname === "online.gamrentals.com" &&
      parts[0] === "es" && families.has(parts[1] ?? "") &&
      parts[2]?.startsWith(`${record.reference}-`) === true &&
      normalized(parts[2] ?? "").includes(normalized(record.model)) && !url.search && !url.hash;
  } catch {
    return false;
  }
};

export const resolveGamFamilyTechnicalDescription = (record: ProductRecord): string | null => {
  const general = record.longDescription?.trim();
  if (!general || general.split(/\s+/u).length < 60 || general.split(/\s+/u).length > 125 ||
    !familyIdentity(record)) return null;

  const length = measurement(record, "Longitud", "mm", 900, 7500);
  const width = measurement(record, "Anchura", "mm", 500, 3000);
  const height = measurement(record, "Altura", "mm", 700, 4500);
  const weight = measurement(record, "Peso", "KG", 100, 25000);
  if (length === null || width === null || width > length ||
    (height === null && weight === null)) return null;

  const dimensions = [length, width, height, weight].filter((value): value is number => value !== null);
  if (dimensions.some((value) => new RegExp(`\\b${value}\\s*(?:mm|kg)\\b`, "iu").test(general))) return null;

  return `${general}\n\nLa ficha técnica de ${record.brand} ${record.model} indica una longitud de ` +
    `${length} mm y una anchura de ${width} mm` +
    `${height !== null ? `, con ${height} mm de altura del equipo` : ""}.` +
    `${weight !== null ? ` El peso publicado es de ${weight} kg.` : ""}`;
};
