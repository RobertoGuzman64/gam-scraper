import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialQuantityOf } from "./editorial-measurements.js";
import { sameEditorialUnit } from "./editorial-source-contract.js";

const folded = (text: string): string => text.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");

const numericValue = (value: string): string => value.replace(/[.,]/gu, "");

const isMissing = (general: string, ...values: string[]): boolean => values.some((value) =>
  ![...general.matchAll(/\d+(?:[.,]\d+)*/gu)].some((match) => numericValue(match[0]) === numericValue(value))
);

const sourcedShortClaim = (source: ProductRecord, prepared: ProductRecord, short: string, general: string): string | null => {
  const volume = /\bdep[oó]sito\s+de\s+soluci[oó]n\s+de\s+(\d{2,4})\s+litros\b/iu.exec(short);
  if (volume?.[1] && Number(volume[1]) >= 50 && Number(volume[1]) <= 1000 && isMissing(general, volume[1])) {
    return `La descripción breve del anuncio identifica un depósito de solución de ${volume[1]} litros. Es una característica mencionada en la fuente, sujeta a comprobación de la máquina ofrecida.`;
  }
  const nominal = /\bmotor\s+el[eé]ctrico\s+brushless\s+de\s+(\d{1,2})\s+kW\s+nominal\s*\(\s*(\d{1,2})\s+kW\s+pico\s*\).*?\((\d{1,2}[,.]\d{1,2})\s+kWh\)/iu.exec(short);
  if (nominal?.[1] && nominal[2] && nominal[3] &&
    Number(nominal[1]) >= 1 && Number(nominal[2]) >= Number(nominal[1]) && Number(nominal[2]) <= 60 &&
    isMissing(general, nominal[1], nominal[2], nominal[3])) {
    return `El anuncio menciona un motor de ${nominal[1]} kW nominales y ${nominal[2]} kW de pico y batería de ${nominal[3]} kWh. Son cifras documentales cuya configuración debe confirmarse en esta unidad.`;
  }
  const pairedBatteries = /\b(?:dos\s+)?bater[ií]as?\s+de\s+litio\s+extra[ií]ble\s*\(\s*(\d{2,3})\s*V\s+(\d{2,3})\s*Ah\s*\)/iu.exec(short);
  if (pairedBatteries?.[1] && pairedBatteries[2] && Number(pairedBatteries[1]) >= 12 && Number(pairedBatteries[1]) <= 120 &&
    Number(pairedBatteries[2]) >= 10 && Number(pairedBatteries[2]) <= 600 &&
    isMissing(general, pairedBatteries[1], pairedBatteries[2])) {
    return `La descripción del anuncio menciona baterías extraíbles de litio de ${pairedBatteries[1]} V y ${pairedBatteries[2]} Ah. Su presencia y configuración deben comprobarse sobre el vehículo anunciado.`;
  }
  const battery = /\bbater[ií]a\s+de\s+litio\s+extra[ií]ble\s+de\s+(\d{1,2}[,.]\d{1,2})\s*kWh\b/iu.exec(short);
  if (battery?.[1] && Number(battery[1].replace(",", ".")) >= 1 && Number(battery[1].replace(",", ".")) <= 50 &&
    isMissing(general, battery[1])) {
    return `La descripción comercial cita una batería extraíble de litio de ${battery[1]} kWh; su presencia y estado deben comprobarse para esta unidad.`;
  }
  const capacity = /\bcapacidad\s+de\s+carga\s+de\s+(\d{3,5})\s*kg\b/iu.exec(short);
  if (capacity?.[1] && Number(capacity[1]) >= 50 && Number(capacity[1]) <= 100000 &&
    editorialQuantityOf(source.specs, ["Capacidad de carga (kg)"], "kg") === Number(capacity[1]) &&
    editorialQuantityOf(prepared.specs, ["Capacidad de carga (kg)"], "kg") === Number(capacity[1]) &&
    isMissing(general, capacity[1])) {
    return `La tabla técnica de la misma referencia consigna capacidad de carga de ${capacity[1]} kg, un dato que debe verificarse para la configuración suministrada.`;
  }
  return null;
};

export const resolveSourcedShortClaimsGeneral = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  const short = prepared.shortDescription?.trim();
  const original = source.shortDescription?.trim();
  if (!authenticatedOrigin || !general?.trim() || !short || !original ||
    !sameEditorialUnit(source, prepared) ||
    !source.title || !prepared.title ||
    short.split(/\s+/u).length <= 45 || short.split(/\s+/u).length > 180 ||
    /\b(?:opcional(?:es)?|no\s+incluid[oa]s?|bajo\s+pedido|sin\s+bater[ií]a)\b/iu.test(short) ||
    folded(short.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u)[0] ?? "") !==
    folded(original.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u)[0] ?? "")) return null;
  const addition = sourcedShortClaim(source, prepared, short, general);
  return addition ? `${general.trim()} ${addition}` : null;
};
