import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { invalidGomarizPlatformHeight, verifiedGomarizPlatformHeight } from "../../../../normalization/providers/gomariz/technical.js";
import { resolveGomarizAdditionalShortDescription } from "./additional-short-description.js";
import { verifiedGomarizPriorityShortDescription } from "../../../evidence/providers/gomariz/priority-short-descriptions.js";

const familyNames: Readonly<Record<string, string>> = {
  "elevador-tijera": "Plataforma de tijera",
  "brazo-articulado": "Plataforma articulada",
  oruga: "Plataforma sobre orugas"
};

const sourceFamily = (record: ProductRecord): string | null => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta") return null;
  try {
    const url = new URL(record.url);
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || !["www.gomarizrent.com", "gomarizrent.com"].includes(url.hostname) ||
      segments.length !== 4 || segments[0] !== "venta" || segments[1] !== "elevacion-y-trabajos-en-altura") return null;
    const family = segments[2];
    return family && Object.hasOwn(familyNames, family) ? family : null;
  } catch {
    return null;
  }
};

const quantity = (value: unknown, unit: "m" | "kg"): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const match = unit === "m" ? /^(\d+(?:[.,]\d{1,2})?)\s*m$/i.exec(text) : /^(\d+)\s*kg$/i.exec(text);
  if (!match?.[1] || Number(match[1].replace(",", ".")) <= 0) return null;
  return match[1].replace(".", ",");
};

export const resolveGomarizShortDescription = (record: ProductRecord): string | null => {
  if (record.shortDescription?.trim()) return null;
  const verified = verifiedGomarizPriorityShortDescription(record);
  if (verified) return verified;
  const family = sourceFamily(record);
  if (!family) return resolveGomarizAdditionalShortDescription(record);
  if (!record.title?.trim() || !record.brand?.trim() || !record.model?.trim() ||
    !/^(?:19|20)\d{2}$/.test(record.year ?? "")) return null;
  const title = record.title.trim();
  const lowered = title.toLocaleLowerCase("es");
  if (!lowered.includes(record.brand.trim().toLocaleLowerCase("es")) ||
    !lowered.includes(record.model.trim().toLocaleLowerCase("es"))) return null;
  const specs = record.specs ?? {};
  if (invalidGomarizPlatformHeight(record.url, specs) && verifiedGomarizPlatformHeight(record) === null) return null;
  const height = quantity(specs["Altura de trabajo"], "m");
  const capacity = quantity(specs.Capacidad, "kg");
  if (!height || !capacity) return null;
  const reach = family === "brazo-articulado" || family === "oruga"
    ? quantity(specs["Alcance lateral"], "m") : null;
  if ((family === "brazo-articulado" || family === "oruga") && !reach) return null;

  const rawMotor = specs.Motor;
  if (rawMotor !== undefined && typeof rawMotor !== "string") return null;
  const motor = rawMotor?.trim();
  if (motor !== undefined && !["Eléctrico", "Diésel", "Eléctrico, Gasolina"].includes(motor)) return null;
  if (family !== "oruga" && motor === "Eléctrico, Gasolina") return null;
  const longDescription = record.longDescription ?? "";
  if ((motor === "Eléctrico" && /\bdi[eé]sel\b/i.test(longDescription)) ||
    (motor === "Diésel" && /\bel[eé]ctric[oa]s?\b/i.test(longDescription))) return null;
  const motorName = motor === "Eléctrico" ? " eléctrica" : motor === "Diésel" ? " diésel" : "";
  if (motorName && ((motorName === " eléctrica" && /\bdi[eé]sel\b/i.test(title)) ||
    (motorName === " diésel" && /\bel[eé]ctric[oa]\b/i.test(title)))) return null;
  const familyName = familyNames[family];
  if (!familyName) return null;
  const qualification = family === "oruga" ? "" : motorName;
  const reachText = reach ? `, alcance lateral de ${reach} m` : "";
  return `${familyName}${qualification} ${title}, año ${record.year}. Altura de trabajo de ${height} m${reachText} y capacidad de ${capacity} kg.`;
};
