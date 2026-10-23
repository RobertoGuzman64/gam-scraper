import type { SpecsMap } from "../../../contracts/catalog.js";

const normalize = (value: string): string => value.replace(/\s+/g, " ").trim();

export const collectGomarizSpecs = (source: string): SpecsMap => {
  const specs: Record<string, string | readonly string[]> = {};
  const keys = [
    "Altura plataforma", "Altura de trabajo", "Alcance lateral", "Altura almacenaje",
    "Altura", "Longitud", "Anchura", "Peso", "Motor", "Capacidad",
    "Potencia motor", "Potencia", "Combustible", "Tipo de combustible", "Tipo de motor", "Consumo",
    "Voltaje", "Tensión", "Anchura limpieza", "Ancho de limpieza",
    "Capacidad de trabajo máxima", "Velocidad máxima", "Altura del mástil", "Nº y tipo de focos"
  ];
  const section = source.match(/(?:Dimensiones|Especificaciones técnicas)\s+(?=(?:Altura|Alcance|Longitud|Anchura|Ancho|Peso|Motor|Potencia|Combustible|Voltaje|Tensión|Capacidad|Velocidad|Consumo|Nº y tipo de focos)\b)(.*?)(?:Ver ficha técnica|Comparador|¿Te interesa|Máquinas similares|$)/is)?.[1] ?? "";
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  const fieldPattern = new RegExp(`(${sorted.join("|")}):\\s*(.*?)(?=\\s+(?:${sorted.join("|")}):|\\s+Especificaciones técnicas|$)`, "giu");
  for (const match of section.matchAll(fieldPattern)) {
    const key = normalize(match[1] ?? "");
    const value = normalize(match[2] ?? "");
    if (!key || !value) continue;
    const previous = specs[key];
    if (previous === undefined) specs[key] = value;
    else if (typeof previous === "string") {
      if (previous !== value) specs[key] = [previous, value];
    } else if (!previous.includes(value)) specs[key] = [...previous, value];
  }
  return specs;
};

