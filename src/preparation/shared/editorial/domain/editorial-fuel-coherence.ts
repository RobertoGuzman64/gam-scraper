import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../../commercial/legacy-export/contracts.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";
import { resolveEditorialSource } from "./editorial-source.js";
import { editorialFamilyOf } from "./editorial-families.js";
import type { EditorialFamily } from "./editorial-families.js";

type Energy = "diésel" | "GLP" | "eléctrica" | "gasolina";

const plain = (text: string): string => text.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");

const compact = (text: string): string => plain(text).replace(/[^a-z0-9]/gu, "");

const declaredEnergy = (text: string): Energy | null => {
  const normalized = plain(text).trim();
  return normalized === "diesel" || normalized === "gasoil" ? "diésel" :
    normalized === "glp" || normalized === "lpg" ? "GLP" :
      normalized === "electrico" || normalized === "electrica" ? "eléctrica" :
        normalized === "gasolina" ? "gasolina" : null;
};

const assertedEnergy = (text: string): Energy | null => {
  const tokens = [...plain(text).matchAll(/\b(?:diesel|glp|lpg|gasolina|electrico|electrica)\b/gu)]
    .map(([value]) => declaredEnergy(value));
  const valid = new Set(tokens.filter((value): value is Energy => value !== null));
  return valid.size === 1 ? [...valid][0] ?? null : null;
};

const sourceEnergy = (source: ProductRecord): Energy | null => {
  const keys = ["Tipo motor", "Tipo de motor", "Motorización", "Motor"] as const;
  const tokens = keys.flatMap((key) => {
    const raw = source.specs?.[key];
    return typeof raw === "string" && raw.trim() ? [declaredEnergy(raw)] : [];
  });
  if (tokens.length === 0 || tokens.some((token) => token === null)) return null;
  const distinct = new Set(tokens);
  return distinct.size === 1 ? tokens[0] ?? null : null;
};

const energyWord = /\b(?:di[eé]sel|glp|lpg|gasolina|el[eé]ctric[oa])\b/iu;

const masculineFamilies: ReadonlySet<EditorialFamily> = new Set([
  "tractor-arrastre", "manipulador-telescopico", "camion-cesta", "dumper",
  "grupo-electrogeno", "compresor", "elevador-materiales", "almacen-vertical",
  "recogepedidos", "apilador"
]);

const revised = (source: ProductRecord, text: string, energy: Energy): string | null => {
  const family = energy === "eléctrica" ? editorialFamilyOf(source.title ?? "") : null;
  if (energy === "eléctrica" && family === null) return null;
  const label = energy === "eléctrica" && family && masculineFamilies.has(family) ? "eléctrico" : energy;
  return text.replace(energyWord, label);
};

export const normalizeCorroboratedEditorialFuel = (
  source: ProductRecord, published: ImportCandidate
): Pick<ImportCandidate, "title" | "description"> => {
  const unchanged = { title: published.title, description: published.description };
  if (!source.brand || !source.model || !source.title || !source.shortDescription ||
    !source.longDescription || !published.title || !published.description ||
    source.url !== published.sourceUrl || source.reference !== published.reference ||
    !verifiedEditorialIdentity(source) || !resolveEditorialSource(source) ||
    !compact(source.longDescription).includes(compact(`${source.brand} ${source.model}`))) return unchanged;

  const energy = sourceEnergy(source);
  const longEnergy = assertedEnergy(source.longDescription);
  if (!energy || longEnergy !== energy ||
    /\b(?:versiones?|alternativas?|opcional(?:es)?|compatible\s+con|puede\s+(?:equipar|montar|funcionar))\b/iu.test(source.longDescription)) return unchanged;

  const titleEnergy = assertedEnergy(source.title);
  const shortEnergy = assertedEnergy(source.shortDescription);
  if (!titleEnergy || !shortEnergy || titleEnergy === shortEnergy) return unchanged;
  const publishedTitleEnergy = assertedEnergy(published.title);
  const publishedShortEnergy = assertedEnergy(published.description);
  if (shortEnergy === energy && titleEnergy !== energy &&
    publishedTitleEnergy === titleEnergy && publishedShortEnergy === energy &&
    compact(published.title) === compact(source.title)) {
    return { title: revised(source, published.title, energy) ?? published.title, description: published.description };
  }
  if (titleEnergy === energy && shortEnergy !== energy &&
    publishedTitleEnergy === energy && publishedShortEnergy === shortEnergy &&
    compact(published.description) === compact(source.shortDescription)) {
    return { title: published.title, description: revised(source, published.description, energy) ?? published.description };
  }
  return unchanged;
};
