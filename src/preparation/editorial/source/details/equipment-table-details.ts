import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { EditorialFamily } from "../../core/editorial-families.js";
import { formatEditorialQuantity } from "../../measurements/editorial-measurements.js";
import { equalSpec, metres, quantity } from "./equipment-detail-values.js";

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

export const hammerCompatibility = (source: ProductRecord, prepared: ProductRecord): string | null => {
  const machine = equalSpec(source, prepared, "Maquina");
  const attachment = equalSpec(source, prepared, "Enganche");
  if (!machine || !attachment || !/^mini\s*excavadora\b[\p{L}\p{N} .-]{3,75}$/iu.test(machine) ||
    !/^[\p{L}\p{N} .-]{2,32}$/u.test(attachment)) return null;
  return `La tabla del proveedor relaciona este implemento con «${machine}» e indica el enganche «${attachment}». ` +
    "Son datos declarados en el anuncio: la adecuación de la máquina portadora, el tipo de acoplamiento " +
    "y el montaje deben verificarse antes de utilizar el implemento.";
};

export const dumperGeometryAndTraction = (source: ProductRecord, prepared: ProductRecord): readonly string[] => {
  const details: string[] = [];
  const hasAny = (keys: readonly string[]): boolean => keys.some((key) =>
    source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined);
  if (!hasAny(["Altura", "Alto", "Altura exterior", "Altura almacenaje", "Altura replegada"])) {
    const height = metres(source, prepared, "Altura total", 0.5, 8);
    if (height !== null) details.push(`altura total declarada de ${height}`);
  }
  const traction = equalSpec(source, prepared, "Tracción");
  if (traction && /^4[x×]4(?:\s+hidrost[aá]tic[ao])?$/iu.test(traction) &&
    !hasAny(["Tracción 4x4"])) details.push(`tracción declarada ${/hidrost/iu.test(traction) ? "4×4 hidrostática" : "4×4"}`);
  return details;
};

export const equipmentDetails = (source: ProductRecord, prepared: ProductRecord, family: EditorialFamily): readonly string[] => {
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
  if (family === "dumper") details.push(...dumperGeometryAndTraction(source, prepared));
  if (family === "transpaleta") add("dimensiones de horquillas declaradas", forkDimensions(source, prepared));
  return details;
};
