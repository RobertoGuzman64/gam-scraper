import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialFamilyOf } from "./editorial-families.js";
import type { EditorialFamily } from "./editorial-families.js";
import { editorialMetricOf, editorialQuantity, formatEditorialQuantity } from "./editorial-measurements.js";
import { resolvedEditorialUnitFamilies } from "./editorial-unit-provenance.js";

const equalSpec = (source: ProductRecord, prepared: ProductRecord, key: string): string | null => {
  const raw = source.specs?.[key];
  return typeof raw === "string" && raw.trim() && raw === prepared.specs?.[key] ? raw.trim() : null;
};

const metres = (source: ProductRecord, prepared: ProductRecord, key: string, min: number, max: number): string | null => {
  if (!equalSpec(source, prepared, key)) return null;
  const value = editorialMetricOf(source.specs, [key]);
  return value !== null && value >= min && value <= max && value === editorialMetricOf(prepared.specs, [key]) ?
    `${formatEditorialQuantity(value)} m` : null;
};

const quantity = (source: ProductRecord, prepared: ProductRecord, key: string,
  unit: "mm" | "kW", min: number, max: number): string | null => {
  const raw = equalSpec(source, prepared, key);
  const value = editorialQuantity(raw ?? undefined, unit);
  return value !== null && value >= min && value <= max ? `${formatEditorialQuantity(value)} ${unit}` : null;
};

const watts = (source: ProductRecord, prepared: ProductRecord): string | null => {
  const raw = equalSpec(source, prepared, "Potencia absorbida");
  const match = raw && /^(\d{3,5})\s*W$/iu.exec(raw);
  const value = match?.[1] ? Number(match[1]) : null;
  return value !== null && value >= 100 && value <= 10000 ? `${formatEditorialQuantity(value)} W` : null;
};

const forkDimensions = (source: ProductRecord, prepared: ProductRecord): string | null => {
  const raw = equalSpec(source, prepared, "Horquillas");
  const match = raw && /^(\d{3,4})\s*[x×]\s*(\d{3,4})\s*mm$/iu.exec(raw);
  if (!match?.[1] || !match[2]) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  return first >= 300 && first <= 2500 && second >= 300 && second <= 2500 ?
    `${formatEditorialQuantity(first)} × ${formatEditorialQuantity(second)} mm` : null;
};

const hammerCompatibility = (source: ProductRecord, prepared: ProductRecord): string | null => {
  const machine = equalSpec(source, prepared, "Maquina");
  const attachment = equalSpec(source, prepared, "Enganche");
  if (!machine || !attachment || !/^mini\s*excavadora\b[\p{L}\p{N} .-]{3,75}$/iu.test(machine) ||
    !/^[\p{L}\p{N} .-]{2,32}$/u.test(attachment)) return null;
  return `La tabla del proveedor relaciona este implemento con «${machine}» e indica el enganche «${attachment}». ` +
    "Son datos declarados en el anuncio: la adecuación de la máquina portadora, el tipo de acoplamiento " +
    "y el montaje deben verificarse antes de utilizar el implemento.";
};

const equipmentDetails = (source: ProductRecord, prepared: ProductRecord, family: EditorialFamily): readonly string[] => {
  const details: string[] = [];
  const add = (label: string, value: string | null): void => {
    if (value !== null) details.push(`${label} de ${value}`);
  };
  if (family === "plataforma-unipersonal") {
    add("altura replegada", metres(source, prepared, "Altura replegada", 0.5, 5));
    add("longitud de plataforma", metres(source, prepared, "Longitud plataforma", 0.4, 5));
    add("anchura de plataforma", metres(source, prepared, "Ancho plataforma", 0.3, 3));
  }
  if (["cargadora", "equipo-corte-disco", "radial-electrica", "martillo-electrico", "hidrolimpiadora"].includes(family)) {
    add("altura exterior", metres(source, prepared, "Alto", 0.1, 8));
  }
  if (family === "miniexcavadora") add("altura exterior", metres(source, prepared, "Altura", 0.5, 8));
  if (["radial-electrica", "martillo-electrico", "hidrolimpiadora"].includes(family) &&
    source.specs?.Motor === "Eléctrico" && prepared.specs?.Motor === "Eléctrico") {
    add("potencia eléctrica absorbida", watts(source, prepared));
  }
  if (family === "compactadora") {
    add("anchura de bandeja", quantity(source, prepared, "Ancho bandeja", "mm", 100, 2500));
    add("longitud de bandeja", quantity(source, prepared, "Largo bandeja", "mm", 100, 2500));
    add("potencia indicada", quantity(source, prepared, "Potencia", "kW", 0.1, 30));
  }
  if (family === "bomba-sumergible") {
    add("potencia indicada", quantity(source, prepared, "Potencia", "kW", 0.1, 100));
    add("altura máxima de elevación", metres(source, prepared, "Altura elevacion max", 0.5, 200));
  }
  if (family === "hidrolimpiadora") {
    const pressure = equalSpec(source, prepared, "Presion max.");
    const pressureMatch = pressure && /^(\d{2,3})\s*bar$/iu.exec(pressure);
    const bar = pressureMatch?.[1] ? Number(pressureMatch[1]) : null;
    if (bar !== null && bar >= 30 && bar <= 500) add("presión máxima indicada", `${bar} bar`);
    const flow = equalSpec(source, prepared, "Caudal nominal");
    const flowMatch = flow && /^(\d{1,3}(?:[.,]\d{1,2})?)\s*l\/min$/iu.exec(flow);
    const litres = flowMatch?.[1] ? Number(flowMatch[1].replace(",", ".")) : null;
    if (litres !== null && litres >= 0.5 && litres <= 100) add("caudal nominal indicado", `${formatEditorialQuantity(litres)} l/min`);
  }
  if (family === "dumper") {
    add("altura total", metres(source, prepared, "Altura total", 0.5, 8));
    const traction = equalSpec(source, prepared, "Tracción");
    if (traction && /^4[x×]4(?:\s+hidrost[aá]tic[ao])?$/iu.test(traction)) {
      details.push(`tracción declarada ${traction}`);
    }
  }
  if (family === "transpaleta") add("dimensiones de horquillas declaradas", forkDimensions(source, prepared));
  return details;
};

export const resolveSourcedEquipmentDetails = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  if (!authenticatedOrigin || !general?.trim() || source.longDescription?.trim() || source.shortDescription?.trim() ||
    /La tabla técnica de esta misma referencia especifica|La tabla del proveedor relaciona este implemento/iu.test(general)) return null;
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (!families || !families[0] || families[0] !== families[1]) return null;
  const family = editorialFamilyOf(general) ??
    (families[0] === "plataforma-unipersonal" && /\bplataforma unipersonal\b/iu.test(general) ?
      "plataforma-unipersonal" : null);
  if (family !== families[0]) return null;
  if (family === "martillo-miniexcavadora") {
    const compatibility = hammerCompatibility(source, prepared);
    return compatibility;
  }
  const details = equipmentDetails(source, prepared, family);
  if (details.length === 0) return null;
  const listed = details.length === 1 ? details[0] :
    `${details.slice(0, -1).join(", ")} y ${details[details.length - 1]}`;
  return `La tabla técnica de esta misma referencia especifica ${listed}. ` +
    "Son valores declarados por el proveedor que deben contrastarse con la unidad anunciada.";
};
