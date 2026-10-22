import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { Attribute, Candidate } from "../../attribute-types.js";
import { fold } from "../../attribute-utils.js";

const cteIdentity = (record: ProductRecord): { brand: string; model: string } | null => {
  if (record.categoryKey !== "elevacion-nueva" || !/\bplataformas?\b.*\bcami[oó]n\b/i.test(record.title ?? "")) return null;
  const title = record.title ?? "";
  const short = record.shortDescription ?? "";
  const long = record.longDescription ?? "";
  const models = [...short.matchAll(/\bCTE\s+((?:DZ|B-LIFT|MP|ZED)(?:\s+[A-Z0-9]+(?:[.-][A-Z0-9]+)*){1,5})\b/g)];
  if (models.length !== 1 || !models[0]?.[1] || !/\bCTE\b/i.test(title)) return null;
  const model = models[0][1];
  const prefix = model.split(/\s+/).slice(0, 2).join(" ");
  if (!fold(title).includes(fold(model)) || !fold(long).includes(fold(`CTE ${prefix}`))) return null;
  const mentions = [...long.matchAll(/\bCTE\s+(DZ|B-LIFT|MP|ZED)\s+(\d+(?:\.\d+)?)/g)];
  if (mentions.some((match) => fold(`${match[1]} ${match[2]}`) !== fold(prefix))) return null;
  return { brand: "CTE", model };
};

const motorcycleIdentity = (record: ProductRecord): { brand: string; model: string } | null => {
  if (record.categoryKey !== "maquinaria" || !/\bciclomotor\b/i.test(`${record.shortDescription ?? ""} ${record.longDescription ?? ""}`)) return null;
  const models = [...(record.title ?? "").matchAll(/\bLVNENG\s+([A-Z]{1,3}\d{2,4})\b/g)];
  if (models.length !== 1 || !models[0]?.[1]) return null;
  const model = models[0][1];
  for (const description of [record.shortDescription ?? "", record.longDescription ?? ""]) {
    const mentions = [...description.matchAll(/\bLVNENG\s+([A-Z]{1,3}\d{2,4})\b/g)];
    if (mentions.length === 0 || mentions.some((match) => match[1] !== model)) return null;
  }
  return { brand: "LVNENG", model };
};

export const gamEquipmentIdentityCandidate = (record: ProductRecord, attribute: Attribute): Candidate | null => {
  if (record.providerId !== "gam" || attribute.type !== "TEXT" ||
    !["Marca", "Modelo"].includes(attribute.name)) return null;
  let section = "";
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "online.gamrentals.com" || path[0] !== "es") return null;
    section = path[1] ?? "";
  } catch {
    return null;
  }
  const identity = section === "cte" ? cteIdentity(record) :
    section === "ciclomotores-electricos-segunda-mano" ? motorcycleIdentity(record) : null;
  if (!identity) return null;
  return { key: attribute.name, value: attribute.name === "Marca" ? identity.brand : identity.model };
};
