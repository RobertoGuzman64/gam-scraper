import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCatalog } from "./prepare.js";

type Category = ImportCatalog["categories"][number];

const fold = (value: string): string => value.toLocaleLowerCase("es").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

const gamCategories: Readonly<Record<string, string>> = {
  "plataformas-elevadoras-tijera-electricas-segunda-mano": "plataformas-tijera-electricas-segunda-mano",
  "plataformas-elevadoras-tijera-diesel-segunda-mano": "plataformas-tijera-diesel-segunda-mano",
  "plataformas-elevadoras-articuladas-electricas-segunda-mano": "plataformas-articuladas-electricas-segunda-mano",
  "plataformas-elevadoras-articuladas-diesel-segunda-mano": "plataformas-articuladas-diesel-segunda-mano",
  "elevadores-telescopicos-segunda-mano": "plataformas-elevadoras-telescopicas-segunda-mano",
  "elevadores-unipersonales-segunda-mano": "plataformas-unipersonales-segunda-mano",
  "camiones-cesta-segunda-mano": "plataformas-elevadoras-sobre-camion-segunda-mano",
  "carretillas-elevadoras-electricas-segunda-mano": "carretillas-elevadoras-electricas-segunda-mano",
  "carretillas-elevadoras-diesel-segunda-mano": "carretillas-elevadoras-diesel-segunda-mano",
  "carretillas-elevadoras-glp-segunda-mano": "carretillas-elevadoras-glp-segunda-mano",
  "carretillas-elevadoras-retractiles-segunda-mano": "carretillas-elevadoras-retractiles-segunda-mano",
  "transpaletas-elevadoras-electricas-segunda-mano": "transpaletas-electricas-segunda-mano",
  "transpaletas-elevadoras-manuales-segunda-mano": "transpaletas-manuales-segunda-mano",
  "apiladoras-elevadoras-electricas-segunda-mano": "apiladores-electricos-segunda-mano",
  "preparapedidos-segunda-mano": "carretillas-elevadoras-recogepedidos-segunda-mano",
  "dumpers-segunda-mano": "dumpers-segunda-mano",
  "rodillo-tandem-segunda-mano": "rodillo-tandem-segunda-mano",
  "generadores-electricos-segunda-mano": "grupos-electrogenos-segunda-mano",
  "tractores-electricos-segunda-mano": "tractores-electricos-segunda-mano",
  "ciclomotores-electricos-segunda-mano": "ciclomotores-electricos-segunda-mano",
  "motocicletas-electricas-segunda-mano": "motocicletas-electricas-segunda-mano",
  "bicicletas-electricas-segunda-mano": "bicicletas-electricas-segunda-mano"
};

const energy = (value: string): "electric" | "diesel" | null => {
  const text = fold(value);
  const electric = /\belectric[oa]s?\b/.test(text);
  const diesel = /\bdiesel\b/.test(text);
  const other = /\bgasolina\b|\bglp\b|\bhibrid[oa]\b/.test(text);
  if (other) return null;
  return electric === diesel ? null : electric ? "electric" : "diesel";
};

const sourceCategorySlug = (record: ProductRecord): string | null => {
  let path: string[];
  let hostname: string;
  try {
    const url = new URL(record.url);
    path = url.pathname.split("/").filter(Boolean);
    hostname = url.hostname;
  } catch {
    return null;
  }
  if (record.providerId === "gam" && hostname === "online.gamrentals.com" && path[0] === "es") {
    const parent = path.at(-2) ?? "";
    const title = fold(record.title ?? "");
    if (parent === "mini-cargadoras-segunda-mano" && /\bminiexcavadora\b/.test(title)) {
      return "miniexcavadoras-segunda-mano";
    }
    if (parent === "carretillas-elevadoras-electricas-segunda-mano" && /\btrilateral\b/.test(title)) {
      return "carretillas-elevadoras-trilaterales-segunda-mano";
    }
    if (parent.startsWith("transpaletas-elevadoras-") && /\btranspaleta\b/.test(title)) {
      if (/\belectrica\b/.test(title) && !/\bmanual\b/.test(title)) return "transpaletas-electricas-segunda-mano";
      if (/\bmanual\b/.test(title) && !/\belectrica\b/.test(title)) return "transpaletas-manuales-segunda-mano";
      if (/\belectrica\b/.test(title) && /\bmanual\b/.test(title)) return null;
    }
    return gamCategories[parent] ?? null;
  }
  if (record.providerId === "gomariz" && ["gomarizrent.com", "www.gomarizrent.com"].includes(hostname) &&
    path[0] === "venta" && path.length >= 4) {
    const family = path[2] ?? "";
    const motor = fold(String(record.specs?.Motor ?? ""));
    const power = energy(motor || (record.title ?? ""));
    if (family === "elevador-tijera" && power) return power === "electric"
      ? "plataformas-tijera-electricas-segunda-mano" : "plataformas-tijera-diesel-segunda-mano";
    if (["brazo-articulado", "brazo-articulado-boom-lift"].includes(family) && power) return power === "electric"
      ? "plataformas-articuladas-electricas-segunda-mano" : "plataformas-articuladas-diesel-segunda-mano";
    if (family === "carretilla-industrial" && power) return power === "electric"
      ? "carretillas-elevadoras-electricas-segunda-mano" : "carretillas-elevadoras-diesel-segunda-mano";
    const types: Readonly<Record<string, string>> = {
      "brazo-telescopico": "plataformas-elevadoras-telescopicas-segunda-mano",
      "camion-plataforma": "plataformas-elevadoras-sobre-camion-segunda-mano",
      "oruga": "plataformas-elevadoras-sobre-orugas-segunda-mano",
      "generador": "grupos-electrogenos-segunda-mano",
      "torre-de-luz": "torres-iluminacion-segunda-mano",
      "carretilla-retractil": "carretillas-elevadoras-retractiles-segunda-mano",
      "dumper": "dumpers-segunda-mano",
      "fregadora": "fregadoras-segunda-mano"
    };
    return types[family] ?? null;
  }
  if (record.providerId === "mercaeleva" && hostname === "sales.mercaeleva.com" &&
    /^(?:es|en)\/for-sale\/machine\/[^/]+\/?$/i.test(path.join("/"))) {
    const text = fold(String(record.specs?.["Título adicional"] ?? record.title ?? ""));
    if (/\btranspalet(?:a)?\b/.test(text)) {
      if (/\belectric[oa]\b/.test(text)) return "transpaletas-electricas-segunda-mano";
      if (/\bmanual\b/.test(text)) return "transpaletas-manuales-segunda-mano";
    }
    if (/\bcarretilla\b/.test(text)) {
      if (/\bretractil\b/.test(text)) return "carretillas-elevadoras-retractiles-segunda-mano";
      if (/\b4x4\b|\btodoterreno\b/.test(text)) return "carretillas-todoterreno-segunda-mano";
      if (/\bglp\b/.test(text)) return "carretillas-elevadoras-glp-segunda-mano";
      if (/\bdiesel\b/.test(text)) return "carretillas-elevadoras-diesel-segunda-mano";
      if (/\belectric[oa]\b/.test(text)) return "carretillas-elevadoras-electricas-segunda-mano";
    }
    if (/\bplataforma\b/.test(text)) {
      if (/\btijera\b/.test(text)) {
        const power = energy(text);
        return power === "electric" ? "plataformas-tijera-electricas-segunda-mano"
          : power === "diesel" ? "plataformas-tijera-diesel-segunda-mano" : null;
      }
      if (/\barticulada\b/.test(text)) {
        const power = energy(text);
        return power === "electric" ? "plataformas-articuladas-electricas-segunda-mano"
          : power === "diesel" ? "plataformas-articuladas-diesel-segunda-mano" : null;
      }
      if (/\btelescopica\b/.test(text)) return "plataformas-elevadoras-telescopicas-segunda-mano";
      if (/\bvertical\b/.test(text) && /\bautopropulsada\b/.test(text)) return "plataformas-unipersonales-segunda-mano";
    }
    return null;
  }
  return null;
};

export const resolveCategory = (record: ProductRecord, categories: ImportCatalog["categories"]): Category | null => {
  const root = categories.find((category) => fold(category.name) === fold("Maquinaria de Ocasión"));
  if (!root) return null;
  const byId = new Map(categories.map((category) => [category.id, category]));
  const parents = new Set(categories.map((category) => category.parentId));
  const counts = new Map<number, number>();
  for (const category of categories) counts.set(category.id, (counts.get(category.id) ?? 0) + 1);
  const leaf = categories.filter((category) => {
    if (counts.get(category.id) !== 1) return false;
    if (parents.has(category.id)) return false;
    let parentId = category.parentId;
    const visited = new Set<number>();
    while (parentId !== null && !visited.has(parentId)) {
      if (parentId === root.id) return true;
      visited.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return false;
  });
  const sourceSlug = sourceCategorySlug(record);
  if (sourceSlug) {
    const matches = leaf.filter((category) => fold(category.slug) === fold(sourceSlug));
    return matches.length === 1 ? matches[0] ?? null : null;
  }
  const direct = leaf.filter((category) => fold(category.slug) === fold(record.categoryKey));
  if (direct.length === 1) return direct[0] ?? null;
  if (record.providerId !== "gam") return null;
  const byName = leaf.filter((category) => fold(category.name) === fold(record.categoryName));
  return byName.length === 1 ? byName[0] ?? null : null;
};
