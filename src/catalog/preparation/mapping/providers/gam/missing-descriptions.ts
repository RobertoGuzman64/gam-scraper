import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold, numberToken } from "../../attribute-utils.js";
import { braviSkydeckEditorialEvidence } from "../../../evidence/providers/gam/bravi-skydeck-editorial.js";

type MissingGamDescriptions = {
  readonly short: string | null;
  readonly long: string | null;
};

const unavailable: MissingGamDescriptions = { short: null, long: null };

const sourceValue = (record: ProductRecord, key: string): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const skydeckDescriptions = (record: ProductRecord): MissingGamDescriptions => {
  const evidence = braviSkydeckEditorialEvidence;
  if (record.providerId !== "gam" || record.categoryKey !== "marcas-nuevas" ||
    record.condition !== "Nuevo" || record.reference !== evidence.reference ||
    record.url !== evidence.sellerUrl || record.title !== evidence.model ||
    record.brand !== evidence.brand || record.model !== evidence.model ||
    record.externalReference !== evidence.model || record.shortDescription?.trim() ||
    record.longDescription?.trim() ||
    Object.keys(record.specs ?? {}).length !== 2 ||
    sourceValue(record, "Marca") !== evidence.brand ||
    sourceValue(record, "Modelo") !== evidence.model) return unavailable;
  return {
    short: "Soporte de paneles BRAVI SKY DECK para uso como accesorio en plataformas elevadoras compatibles.",
    long: "El SKY DECK de BRAVI es un accesorio de sujeción de paneles destinado a plataformas elevadoras compatibles, no una plataforma elevadora autónoma. El manual del fabricante describe el montaje del soporte en la cesta y especifica una carga nominal de 16 kg por soporte para un panel. La compatibilidad con la plataforma, el montaje autorizado y los límites de carga deben comprobarse en los manuales de ambos equipos antes de utilizarlo."
  };
};

export const gamMissingDescriptions = (record: ProductRecord): MissingGamDescriptions => {
  const skydeck = skydeckDescriptions(record);
  if (skydeck.short || skydeck.long) return skydeck;
  if (record.providerId !== "gam" || record.categoryKey !== "carretillas-nuevas" ||
    record.condition !== "Nuevo" || record.shortDescription?.trim() || record.longDescription?.trim() ||
    fold(record.brand ?? "") !== "heli" || !record.model || !record.reference ||
    record.externalReference?.trim() !== record.model ||
    !/^CPQYD\d{2}-RC1H$/.test(record.model)) return unavailable;

  const title = fold(record.title ?? "");
  const titleMatch = /^grua horquilla glp(?: (\d[\d.,]*)\s*kg)? heli (cpqyd\d{2}-rc1h)$/.exec(title);
  if (!titleMatch || fold(record.model) !== titleMatch[2]) return unavailable;

  try {
    const url = new URL(record.url);
    const path = `/es/carretillas-elevadoras-glp-nuevas/${record.reference}-grua-horquilla-glp-heli-${record.model.toLowerCase()}`;
    if (url.protocol !== "https:" || url.hostname !== "online.gamrentals.com" ||
      url.pathname !== path || url.search || url.hash) return unavailable;
  } catch {
    return unavailable;
  }

  const expectedSpecs = ["Marca", "Modelo", "Tipo motor", "Capacidad de carga (kg)"];
  const specs = record.specs;
  if (!specs || Object.keys(specs).length !== expectedSpecs.length ||
    expectedSpecs.some((key) => !Object.hasOwn(specs, key)) ||
    fold(sourceValue(record, "Marca") ?? "") !== "heli" ||
    sourceValue(record, "Modelo") !== record.model ||
    fold(sourceValue(record, "Tipo motor") ?? "") !== "glp") return unavailable;

  const capacityMatch = /^(\d[\d., ]*)\s*kg$/i.exec(sourceValue(record, "Capacidad de carga (kg)") ?? "");
  const capacity = capacityMatch?.[1] ? numberToken(capacityMatch[1]) : null;
  if (capacity === null || !Number.isInteger(capacity) || capacity <= 0) return unavailable;
  if (titleMatch[1] && numberToken(titleMatch[1]) !== capacity) return unavailable;

  const load = String(capacity).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const machine = `grúa horquilla HELI ${record.model}`;
  return {
    short: `Nueva ${machine} con motor GLP y capacidad de carga de ${load} kg.`,
    long: `La ${machine} se ofrece como maquinaria nueva. Su ficha técnica especifica un motor GLP y una capacidad de carga de ${load} kg.`
  };
};
