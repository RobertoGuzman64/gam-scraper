import type { ProductRecord } from "../../../../contracts/catalog.js";
import { numberToken } from "../../classification/mapping/attribute-utils.js";
import { editorialFamilyName, editorialFamilyOf } from "./editorial-families.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";
import { verifiedEditorialUnitPair } from "./editorial-unit-provenance.js";

const read = (record: ProductRecord, key: string): string | null => {
  const value = record.specs?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const parse = (value: string | null, unit: string): number | null => {
  if (!value) return null;
  const captured = new RegExp(`^(\\d[\\d., ]*)\\s*${unit}$`, "iu").exec(value)?.[1];
  return captured ? numberToken(captured) : null;
};

const quantity = (value: number): string => {
  const [integer, fraction] = String(value).split(".");
  return `${(integer ?? "").replace(/\B(?=(\d{3})+(?!\d))/gu, ".")}${fraction ? `,${fraction}` : ""}`;
};

export const resolveMissingTechnicalEditorialGeneral = (
  source: ProductRecord, prepared: ProductRecord
): string | null => {
  if (!verifiedEditorialUnitPair(source, prepared) || source.condition !== "Nuevo" ||
    source.longDescription?.trim() || prepared.longDescription?.trim() ||
    !verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared) ||
    !source.brand || !source.model || read(source, "Estado") !== "Nuevo" ||
    read(source, "Marca") !== source.brand || read(source, "Modelo") !== source.model ||
    source.title !== prepared.title) return null;
  const family = editorialFamilyOf(source.title ?? "");
  if (!family || !["apilador", "transpaleta", "carretilla-elevadora", "carretilla-retractil"].includes(family)) return null;
  const amounts = [...(source.title ?? "").matchAll(/\b(\d[\d., ]*)\s*kg\b/giu)];
  if (amounts.length !== 1 || !amounts[0]?.[1]) return null;
  const advertised = numberToken(amounts[0][1]);
  const sourceKg = parse(read(source, "Capacidad máxima de elevación"), "kg");
  const preparedKg = parse(read(prepared, "Capacidad máxima de elevación"), "kg");
  if (advertised === null || advertised < 50 || advertised > 50000 ||
    advertised !== sourceKg || advertised !== preparedKg) return null;
  const technicalKeys = ["Estado", "Marca", "Modelo", "Capacidad máxima de elevación", "Tipo de motor", "Tipo de Batería",
    "Voltaje de la batería", "Capacidad de la batería", "Altura máxima de elevación", "Tipo de mástil", "Título adicional"];
  if (technicalKeys.some((key) => read(source, key) !== read(prepared, key))) return null;
  const additional = read(source, "Título adicional");
  if (additional && !(source.title ?? "").normalize("NFD").replace(/[\u0300-\u036f]/gu, "").replace(/[^a-z0-9]/giu, "").toLowerCase()
    .includes(additional.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").replace(/[^a-z0-9]/giu, "").toLowerCase())) return null;
  const title = (source.title ?? "").normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
  if (!/\belectric[oa]\b/u.test(title) || /\bdiesel\b/u.test(title)) return null;
  const motor = read(source, "Tipo de motor");
  if (motor && !/^el[eé]ctrico$/iu.test(motor)) return null;
  const battery = read(source, "Tipo de Batería");
  if (battery && !["Li-ion", "Plomo-ácido", "Gel"].includes(battery)) return null;
  if (!battery) return null;
  if (title.includes("litio") && battery !== "Li-ion") return null;
  const volts = read(source, "Voltaje de la batería");
  const amps = read(source, "Capacidad de la batería");
  if (!volts || !amps || parse(volts, "V") === null || parse(amps, "Ah") === null) return null;
  const height = read(source, "Altura máxima de elevación");
  const measuredHeight = height ? parse(height, "mm") : null;
  if (height && (measuredHeight === null || measuredHeight <= 0)) return null;
  const mast = read(source, "Tipo de mástil");
  if (mast && !["Triple", "Triplex", "Dúplex", "Dúplex/estándar", "Simple", "Simplex"].includes(mast)) return null;
  if (title.includes("triplex") && mast && !["Triple", "Triplex"].includes(mast)) return null;
  const noun = editorialFamilyName(family);
  const familyName = `${noun[0]?.toLocaleUpperCase("es") ?? ""}${noun.slice(1)}`;
  const label = `${familyName} ${source.brand} ${source.model}`;
  const condition = family === "apilador" ? "nuevo" : "nueva";
  const parts = [`${label}, ${condition}, con capacidad máxima de elevación indicada de ${quantity(advertised)} kg`];
  if (measuredHeight !== null) parts.push(`altura máxima de elevación de ${quantity(measuredHeight)} mm`);
  parts.push(`batería ${battery === "Li-ion" ? "de litio" : battery === "Gel" ? "de gel" : "de plomo-ácido"} de ${volts} y ${amps}`);
  if (mast) parts.push(`mástil ${["Triple", "Triplex"].includes(mast) ? "tríplex" : mast.startsWith("Dúplex") ? "dúplex" : "simple"}`);
  return `${parts.join("; ")}. La capacidad disponible a la altura máxima requiere comprobar la configuración y la placa de cargas de la unidad.`;
};
