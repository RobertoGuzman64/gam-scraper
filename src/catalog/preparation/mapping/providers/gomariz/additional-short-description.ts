import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../category-utils.js";

const families: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "elevacion-y-trabajos-en-altura": {
    "brazo-telescopico": "Plataforma telescópica",
    "brazo-articulado-boom-lift": "Plataforma articulada",
    "elevador-mastil-vertical": "Elevador de mástil vertical",
    "camion-plataforma": "Camión cesta"
  },
  "manipulacion-de-materiales": {
    "manipulador-telescopico": "Manipulador telescópico",
    "carretilla-industrial": "Carretilla industrial",
    "carretilla-retractil": "Carretilla retráctil"
  },
  "energia-electrica-e-iluminacion": {
    generador: "Grupo electrógeno",
    "torre-de-luz": "Torre de iluminación"
  },
  limpieza: { fregadora: "Fregadora" },
  "movimiento-de-tierras-demolicion-y-compactacion": {
    dumper: "Dúmper",
    rodillo: "Rodillo compactador",
    retroexcavadora: "Retroexcavadora"
  },
  camion: { "camion-porta-maquinaria": "Camión portamaquinaria" }
};

type SourceFamily = { readonly family: string; readonly name: string };

const sourceFamily = (record: ProductRecord): SourceFamily | null => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta") return null;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || !["www.gomarizrent.com", "gomarizrent.com"].includes(url.hostname) ||
      path.length !== 4 || path[0] !== "venta") return null;
    const branch = path[1];
    const family = path[2];
    if (!branch || !family) return null;
    const name = families[branch]?.[family];
    return name ? { family, name } : null;
  } catch {
    return null;
  }
};

const measurement = (value: unknown, unit: "m" | "kg" | "kVA" | "V"): string | null => {
  if (typeof value !== "string") return null;
  const match = /^([0-9]+(?:[.,][0-9]{1,2})?)\s*(m|kg|kva|v)$/i.exec(value.trim());
  if (!match?.[1] || match[2]?.toLowerCase() !== unit.toLowerCase()) return null;
  const numeric = Number(match[1].replace(",", "."));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return match[1].replace(".", ",");
};

const lamps = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d+)\s*[x×]\s*(\d+)\s*W$/i.exec(value.trim());
  if (!match?.[1] || !match[2] || Number(match[1]) <= 0 || Number(match[2]) <= 0) return null;
  return `${Number(match[1])} focos de ${Number(match[2])} W`;
};

const motor = (record: ProductRecord): "eléctrica" | "diésel" | null => {
  const value = record.specs?.Motor;
  if (value !== "Eléctrico" && value !== "Diésel") return null;
  const title = `${record.title ?? ""} ${record.model ?? ""}`;
  const general = record.longDescription ?? "";
  if (value === "Eléctrico" && /\bdi[eé]sel\b/i.test(`${title} ${general}`)) return null;
  if (value === "Diésel" && /\bel[eé]ctric[oa]s?\b/i.test(`${title} ${general}`)) return null;
  return value === "Eléctrico" ? "eléctrica" : "diésel";
};

export const resolveGomarizAdditionalShortDescription = (record: ProductRecord): string | null => {
  if (record.shortDescription?.trim()) return null;
  const source = sourceFamily(record);
  const title = record.title?.trim();
  if (source?.family === "camion-plataforma" && title && /^(?:19|20)\d{2}$/.test(record.year ?? "") &&
    /^SOCAGE IVECO [A-Z0-9 ]+$/.test(title) &&
    (!record.model || fold(title).includes(fold(record.model))) &&
    fold(record.longDescription ?? "").includes("camiones cesta")) {
    const urlName = new URL(record.url).pathname.split("/").filter(Boolean)[3] ?? "";
    const expected = fold(title).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const height = measurement(record.specs?.["Altura de trabajo"], "m");
    const reach = measurement(record.specs?.["Alcance lateral"], "m");
    const capacity = measurement(record.specs?.Capacidad, "kg");
    if ((urlName === expected || /^\d+$/.test(urlName.slice(expected.length + 1)) && urlName.startsWith(`${expected}-`)) &&
      height && reach && capacity) {
      return `Camión cesta ${title}, año ${record.year}. Altura de trabajo de ${height} m, alcance lateral de ${reach} m y capacidad de ${capacity} kg.`;
    }
  }
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  if (!source || !title || !brand ||
    !title.toLocaleLowerCase("es").includes(brand.toLocaleLowerCase("es")) ||
    (model && !title.toLocaleLowerCase("es").includes(model.toLocaleLowerCase("es"))) ||
    (!model && source.family !== "torre-de-luz") ||
    (record.year !== null && !/^(?:19|20)\d{2}$/.test(record.year))) return null;

  const specs = record.specs ?? {};
  const height = measurement(specs["Altura de trabajo"], "m");
  const reach = measurement(specs["Alcance lateral"], "m");
  const capacity = measurement(specs.Capacidad, "kg");
  const weight = measurement(specs.Peso, "kg");
  const engine = motor(record);
  const prefix = `${source.name} ${title}${record.year ? `, año ${record.year}` : ""}.`;

  switch (source.family) {
    case "manipulador-telescopico":
      return height && reach && capacity && engine === "diésel"
        ? `${prefix} Altura de trabajo de ${height} m, alcance lateral de ${reach} m y capacidad de ${capacity} kg.` : null;
    case "brazo-telescopico":
    case "brazo-articulado-boom-lift":
      return height && capacity && engine === "diésel" &&
        (source.family === "brazo-telescopico" || reach)
        ? `${prefix} Altura de trabajo de ${height} m${reach ? `, alcance lateral de ${reach} m` : ""} y capacidad de ${capacity} kg.` : null;
    case "elevador-mastil-vertical":
      return height && capacity
        ? `${prefix} Altura de trabajo de ${height} m y capacidad de ${capacity} kg.` : null;
    case "carretilla-industrial":
    case "carretilla-retractil":
      return capacity && engine
        ? `${source.name} ${engine} ${title}${record.year ? `, año ${record.year}` : ""}. Capacidad de ${capacity} kg.` : null;
    case "generador": {
      if (/\btorres? de iluminaci[oó]n\b/i.test(record.longDescription ?? "")) return null;
      const power = measurement(specs.Potencia, "kVA");
      const voltage = measurement(specs.Voltaje, "V");
      if (power) return `${prefix} Potencia aparente indicada de ${power} kVA.`;
      return engine === "diésel" && voltage ? `${prefix} Motor diésel y tensión indicada de ${voltage} V.` : null;
    }
    case "torre-de-luz": {
      const lights = lamps(specs.Potencia);
      return lights ? `${prefix} Equipamiento indicado de ${lights}.` : null;
    }
    case "fregadora": {
      const cleaningWidth = measurement(specs["Anchura limpieza"], "m");
      return cleaningWidth && engine === "eléctrica"
        ? `${prefix} Motorización eléctrica y anchura de limpieza de ${cleaningWidth} m.` : null;
    }
    case "dumper":
      return capacity && engine === "diésel" ? `${prefix} Motor diésel y capacidad de ${capacity} kg.` : null;
    case "rodillo":
      return weight && engine === "diésel" ? `${prefix} Motor diésel y peso indicado de ${weight} kg.` : null;
    case "camion-porta-maquinaria": {
      const length = measurement(specs.Longitud, "m");
      if (length && weight) return `${prefix} Longitud de ${length} m y peso indicado de ${weight} kg.`;
      return engine === "diésel" && /\bcami[oó]n\b/i.test(record.longDescription ?? "")
        ? `${prefix} Motorización diésel según la ficha del proveedor.` : null;
    }
    case "retroexcavadora":
      return weight && /\bretroexcavadora\b/i.test(record.longDescription ?? "")
        ? `${prefix} Peso indicado de ${weight} kg.` : null;
    default:
      return null;
  }
};
