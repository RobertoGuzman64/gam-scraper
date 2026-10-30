import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold, numberToken } from "../../attribute-utils.js";
import { validMercaelevaTechnicalSource } from "./technical.js";

export type MissingMercaelevaDescriptions = {
  readonly short: string | null;
  readonly long: string | null;
};

const unavailable: MissingMercaelevaDescriptions = { short: null, long: null };

const sourceString = (record: ProductRecord, key: string): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const kilograms = (value: string): number | null => {
  const found = /^(\d[\d., ]*)\s*kg$/i.exec(value.trim());
  return found?.[1] ? numberToken(found[1]) : null;
};

const formatted = (value: number): string => {
  const [integer, fraction] = String(value).split(".");
  return `${(integer ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${fraction ? `,${fraction}` : ""}`;
};

const modelInUrl = (record: ProductRecord): boolean => {
  if (!record.model || !record.reference || !/^[A-Z0-9]+$/i.test(record.model) || !/^M\d+-\d+$/.test(record.reference)) return false;
  return record.url.endsWith(`/MB-${record.model}-${record.reference}`);
};

const newMbMachine = (record: ProductRecord): MissingMercaelevaDescriptions => {
  if (record.categoryKey !== "venta" || record.condition !== "Nuevo" || record.longDescription?.trim() ||
    fold(record.brand ?? "") !== "mb" || fold(sourceString(record, "Marca") ?? "") !== "mb" ||
    sourceString(record, "Estado") !== "Nuevo" || !modelInUrl(record) ||
    sourceString(record, "Modelo") !== record.model) return unavailable;

  const title = record.title?.trim() ?? "";
  const heading = `MB ${record.model} `;
  if (!title.startsWith(heading)) return unavailable;
  const additional = sourceString(record, "Título adicional");
  const details = title.slice(heading.length).trim();
  if (!additional || fold(additional) !== fold(details)) return unavailable;

  const family = fold(details);
  const patterns: readonly [RegExp, string][] = [
    [/^carretilla electrica de \d[\d., ]*\s*kg con bateria de litio$/, "Carretilla eléctrica"],
    [/^transpaleta electrica (?:con )?bateria de litio de \d[\d., ]*\s*kg$/, "Transpaleta eléctrica"],
    [/^transpaleta electrica \d[\d., ]*\s*kg$/, "Transpaleta eléctrica"],
    [/^apilador electrico de \d[\d., ]*\s*kg con bateria de litio$/, "Apilador eléctrico"],
    [/^apilador de elevacion inicial con mastil triplex de \d[\d., ]*\s*kg$/, "Apilador de elevación inicial"]
  ];
  const matches = patterns.filter(([pattern]) => pattern.test(family));
  if (matches.length !== 1) return unavailable;
  const machine = matches[0]?.[1];
  if (!machine) return unavailable;

  const loads = [...family.matchAll(/\b(\d[\d., ]*)\s*kg\b/g)];
  if (loads.length !== 1 || !loads[0]?.[1]) return unavailable;
  const titleLoad = numberToken(loads[0][1]);
  const technicalLoad = sourceString(record, "Capacidad máxima de elevación");
  if (titleLoad === null || titleLoad <= 0 || titleLoad !== kilograms(technicalLoad ?? "")) return unavailable;

  const battery = fold(sourceString(record, "Tipo de Batería") ?? "");
  const engine = fold(sourceString(record, "Tipo de motor") ?? "");
  if (engine && engine !== "electrico") return unavailable;
  const lithium = family.includes("bateria de litio");
  if (lithium && battery !== "li-ion") return unavailable;
  if (!engine && !["li-ion", "plomo-acido", "gel"].includes(battery)) return unavailable;

  const mast = fold(sourceString(record, "Tipo de mástil") ?? "");
  const triplex = family.includes("mastil triplex");
  if (triplex && !["triple", "triplex"].includes(mast)) return unavailable;
  if (mast && !["triple", "triplex", "duplex", "duplex/estandar", "simple", "simplex"].includes(mast)) return unavailable;

  const height = sourceString(record, "Altura máxima de elevación");
  const heightValue = height ? /^(\d[\d., ]*)\s*mm$/i.exec(height)?.[1] : null;
  const heightNumber = heightValue ? numberToken(heightValue) : null;
  if (height && (heightNumber === null || heightNumber <= 0)) return unavailable;

  const name = `${machine} MB ${record.model}`;
  const capacity = `capacidad máxima de elevación de ${formatted(titleLoad)} kg`;
  const energy = lithium ? " con batería de litio" : "";
  const short = `${name}${energy}, ${capacity}${heightNumber ? ` y altura máxima de elevación de ${formatted(heightNumber)} mm` : ""}.`;

  const volts = sourceString(record, "Voltaje de la batería");
  const amps = sourceString(record, "Capacidad de la batería");
  const validVolts = volts && /^\d+(?:[.,]\d+)?\s*V$/i.test(volts);
  const validAmps = amps && /^\d+(?:[.,]\d+)?\s*Ah$/i.test(amps);
  const long = heightNumber && validVolts && validAmps && battery ?
    `${name}. ${capacity[0]?.toUpperCase()}${capacity.slice(1)}. Altura máxima de elevación de ${formatted(heightNumber)} mm. Batería ${battery === "li-ion" ? "de litio" : battery} de ${volts} y ${amps}.${mast ? ` Mástil ${["triple", "triplex"].includes(mast) ? "tríplex" : ["duplex", "duplex/estandar"].includes(mast) ? "dúplex" : "simple"}.` : ""}` : null;
  return { short, long };
};

const modularCabin = (record: ProductRecord): string | null => {
  const title = fold(record.title ?? "");
  const general = fold(record.longDescription ?? "");
  const match = /^modulo caseta diafana con aire (\d+(?:[.,]\d+)?)m x (\d+(?:[.,]\d+)?)m$/.exec(title);
  if (!match || !general.startsWith(`${title} puerta en lateral (lado corto)`)) return null;
  if (record.brand || record.model) return null;
  return `Módulo caseta diáfana con aire de ${match[1]} x ${match[2]} m y puerta lateral en el lado corto.`;
};

export const mercaelevaMissingDescriptions = (record: ProductRecord): MissingMercaelevaDescriptions => {
  if (!validMercaelevaTechnicalSource(record) || record.shortDescription?.trim()) return unavailable;
  const mb = newMbMachine(record);
  if (mb.short) return mb;
  return { short: modularCabin(record), long: null };
};
