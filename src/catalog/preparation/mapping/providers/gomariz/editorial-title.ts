import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { fold } from "../../attribute-utils.js";

type Family = {
  readonly section: string;
  readonly slug: string;
  readonly name: string;
  readonly evidence: RegExp;
};

const families: readonly Family[] = [
  { section: "elevacion-y-trabajos-en-altura", slug: "elevador-tijera", name: "Plataforma de tijera", evidence: /\btijeras?\b|\bscissor\b/u },
  { section: "elevacion-y-trabajos-en-altura", slug: "brazo-articulado", name: "Plataforma articulada", evidence: /\barticulad[ao]s?\b|\bboom lift\b/u },
  { section: "elevacion-y-trabajos-en-altura", slug: "brazo-articulado-boom-lift", name: "Plataforma articulada", evidence: /\barticulad[ao]s?\b|\bboom lift\b/u },
  { section: "elevacion-y-trabajos-en-altura", slug: "brazo-telescopico", name: "Plataforma telescópica", evidence: /\bbrazo telescopico\b|\btelescopic boom lift\b/u },
  { section: "elevacion-y-trabajos-en-altura", slug: "oruga", name: "Plataforma sobre orugas", evidence: /\borugas?\b|\btodoterreno\b/u },
  { section: "elevacion-y-trabajos-en-altura", slug: "elevador-mastil-vertical", name: "Elevador de mástil vertical", evidence: /\bmastil(?:es)? vertical(?:es)?\b|\belevador mastil vertical\b/u },
  { section: "manipulacion-de-materiales", slug: "manipulador-telescopico", name: "Manipulador telescópico", evidence: /\bmanipuladores?\b/u },
  { section: "manipulacion-de-materiales", slug: "carretilla-industrial", name: "Carretilla industrial", evidence: /\bcarretillas?\b|\bmaquinas destinadas al trabajo\b/u },
  { section: "manipulacion-de-materiales", slug: "carretilla-retractil", name: "Carretilla retráctil", evidence: /\bcarretillas?\b|\balmacenaje\b/u },
  { section: "energia-electrica-e-iluminacion", slug: "generador", name: "Grupo electrógeno", evidence: /\bgrupos? electrogenos?\b|\bgeneradores?\b/u },
  { section: "energia-electrica-e-iluminacion", slug: "torre-de-luz", name: "Torre de iluminación", evidence: /\btorres? de iluminacion\b|\btorres? de luz\b/u },
  { section: "limpieza", slug: "fregadora", name: "Fregadora industrial", evidence: /\bfregadoras?\b/u },
  { section: "movimiento-de-tierras-demolicion-y-compactacion", slug: "retroexcavadora", name: "Retroexcavadora", evidence: /\bretroexcavadoras?\b/u },
  { section: "movimiento-de-tierras-demolicion-y-compactacion", slug: "rodillo", name: "Rodillo compactador", evidence: /\brodillos? compactador(?:es)?\b/u },
  { section: "movimiento-de-tierras-demolicion-y-compactacion", slug: "dumper", name: "Dúmper", evidence: /\bdumper\b/u },
  { section: "camion", slug: "camion-porta-maquinaria", name: "Camión portamaquinaria", evidence: /\bcamion\b/u }
];

const slugify = (value: string): string => fold(value).replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");

export const resolveGomarizEditorialTitle = (record: ProductRecord): string | null => {
  if (record.providerId !== "gomariz" || record.categoryKey !== "venta" || record.condition !== "Segunda mano" ||
    !record.reference?.trim() || !record.brand?.trim() || !record.model?.trim() ||
    !record.title?.trim() || !record.longDescription?.trim() ||
    fold(record.title) !== fold(`${record.brand} ${record.model}`) ||
    (record.specs?.Marca !== undefined && (typeof record.specs.Marca !== "string" || fold(record.specs.Marca) !== fold(record.brand))) ||
    (record.specs?.Modelo !== undefined && (typeof record.specs.Modelo !== "string" || fold(record.specs.Modelo) !== fold(record.model))) ) return null;

  let url: URL;
  try {
    url = new URL(record.url);
  } catch {
    return null;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (url.protocol !== "https:" || !["gomarizrent.com", "www.gomarizrent.com"].includes(url.hostname) ||
    !!url.search || !!url.hash || segments.length !== 4 || segments[0] !== "venta") return null;

  const family = families.find((item) => item.section === segments[1] && item.slug === segments[2]);
  const slug = segments[3];
  const identity = slugify(`${record.brand} ${record.model}`);
  if (!family || !slug || !identity ||
    !new RegExp(`(?:^|-)${identity}(?:-|$)`, "u").test(slugify(slug)) ||
    !family.evidence.test(fold(record.longDescription))) return null;

  const semanticSlug = fold(slug).replace(/-/gu, " ");
  if ((family.slug === "elevador-tijera" && /\b(?:brazo articulado|brazo telescopico)\b/u.test(semanticSlug)) ||
    (family.slug === "generador" && /\btorre de (?:iluminacion|luz)\b/u.test(fold(record.longDescription))) ||
    (family.slug === "torre-de-luz" && /\bgrupos? electrogenos?\b/u.test(fold(record.longDescription)) &&
      !/\btorres? de (?:iluminacion|luz)\b/u.test(fold(record.longDescription)))) return null;

  return `${family.name} ${record.title.trim()}`;
};
