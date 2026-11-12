import type { ProductRecord } from "../../../../contracts/catalog.js";
import { invalidGomarizPlatformHeight, verifiedGomarizPlatformHeight } from "../../../../catalog/normalization/gomariz/technical.js";
import { resolveGomarizEditorialFamily } from "./source-family.js";
import { platformMeasurements } from "../../../shared/editorial/domain/platform-measurements.js";
import { resolveGomarizAdditionalShortDescription } from "./additional-short-description.js";
import { verifiedGomarizPriorityShortDescription } from "../evidence/priority-short-descriptions.js";

const familyNames: Readonly<Record<string, string>> = {
  "elevador-tijera": "Plataforma de tijera",
  "brazo-articulado": "Plataforma articulada",
  oruga: "Plataforma sobre orugas"
};

const sourceFamily = (record: ProductRecord): string | null => {
  const source = resolveGomarizEditorialFamily(record);
  return source?.section === "elevacion-y-trabajos-en-altura" &&
    Object.hasOwn(familyNames, source.key) ? source.key : null;
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
  const measures = platformMeasurements(height, reach, capacity);
  return `${familyName}${qualification} ${title}, año ${record.year}. ${measures[0]?.toLocaleUpperCase("es")}${measures.slice(1)}.`;
};
