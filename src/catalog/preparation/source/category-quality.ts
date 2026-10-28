import type { ProductRecord } from "../../../contracts/catalog.js";
import { fold } from "../mapping/category-utils.js";
import { gamDocumentedSourceType } from "../evidence/providers/gam/source-category.js";
import { gomarizDocumentedSourceType } from "../evidence/providers/gomariz/source-category.js";
import { mercaelevaDocumentedSourceType } from "../evidence/providers/mercaeleva/source-category.js";

export const SOURCE_CATEGORY_ISSUE = "Tipo de máquina de origen sin confirmar";

const typeSignals: readonly { readonly source: RegExp; readonly title: RegExp }[] = [
  { source: /(?:^|-)barredoras?(?:-|$)/, title: /\bbarredora\b/ },
  { source: /(?:^|-)fregadoras?(?:-|$)/, title: /\bfregadora\b/ },
  { source: /(?:^|-)carretillas?(?:-|$)/, title: /\bcarretilla\b/ },
  { source: /(?:^|-)apiladores?(?:-|$)/, title: /\bapilador(?:a)?\b/ },
  { source: /(?:^|-)transpaletas?(?:-|$)/, title: /\btranspaleta\b/ },
  { source: /(?:^|-)plataformas?(?:-|$)/, title: /\bplataforma\b/ },
  { source: /(?:^|-)manipuladores?(?:-|$)/, title: /\bmanipulador\b/ },
  { source: /(?:^|-)tractores?(?:-|$)/, title: /\btractor\b/ },
  { source: /(?:^|-)camiones?(?:-|$)/, title: /\bcamion\b/ },
  { source: /(?:^|-)furgonetas?(?:-|$)/, title: /\bfurgoneta\b/ },
  { source: /(?:^|-)generadores?(?:-|$)|(?:^|-)grupos-electrogenos(?:-|$)/, title: /\b(?:generador|grupo electrogeno)\b/ },
  { source: /(?:^|-)remolques?(?:-|$)/, title: /\b(?:remolque|semiremolque)\b/ },
  { source: /(?:^|-)dumpers?(?:-|$)/, title: /\bdumper\b/ },
  { source: /(?:^|-)elevadores?(?:-|$)/, title: /\belevador\b/ },
  { source: /(?:^|-)gruas?(?:-|$)/, title: /\bgrua\b/ }
];

const sourcePath = (record: ProductRecord): readonly string[] | null => {
  try {
    const url = new URL(record.url);
    const expected = record.providerId === "gam" ? "online.gamrentals.com" :
      record.providerId === "gomariz" ? "www.gomarizrent.com" :
        record.providerId === "mercaeleva" ? "sales.mercaeleva.com" : null;
    return url.hostname === expected ? url.pathname.split("/").filter(Boolean) : null;
  } catch {
    return null;
  }
};

const gamSourceConfirmed = (record: ProductRecord, path: readonly string[]): boolean => {
  if (path[0] !== "es" || path.length < 3) return false;
  const route = fold(path[1] ?? "").replace(/\s+/g, "-");
  const title = fold(record.title ?? "");
  if (!title) return false;
  const documented = gamDocumentedSourceType(record, route);
  if (documented !== undefined) return documented;
  if (!typeSignals.some((signal) => signal.source.test(route) && signal.title.test(title))) return false;
  if (/\bbarredora\b/.test(title) && /\bfregadora\b/.test(title)) {
    const model = fold(typeof record.specs?.["Modelo"] === "string" ? record.specs["Modelo"] : "");
    const descriptions = [fold(record.shortDescription ?? ""), fold(record.longDescription ?? "")];
    const corroborated = model.length > 0 && title.includes(model) && descriptions.every((description) =>
      description.includes(model) && /\bbarrido\b/.test(description) && /\bfregado\b/.test(description));
    if (!corroborated || !/(?:^|-)(?:barredoras|fregadoras)(?:-|$)/.test(route)) return false;
  }
  if (/plataforma/.test(route)) {
    for (const subtype of ["tijera", "articulada", "telescopica", "unipersonal"]) {
      if (route.includes(subtype) && !new RegExp(`\\b${subtype}\\b`).test(title)) return false;
    }
    if (/\b(?:tijera|articulada|telescopica)\b/.test(title) &&
      !["tijera", "articulada", "telescopica"].some((subtype) => route.includes(subtype))) return false;
  }
  const routeEnergy = /(?:^|-)diesel(?:-|$)/.test(route) ? "diesel" :
    /(?:^|-)electric[ao]s?(?:-|$)/.test(route) ? "electrico" :
      /(?:^|-)glp(?:-|$)/.test(route) ? "glp" : null;
  if (routeEnergy) {
    const energies = new Set<string>();
    for (const evidence of [title, fold(String(record.specs?.["Tipo motor"] ?? "")), fold(String(record.specs?.["Motorización"] ?? ""))]) {
      if (/\bdiesel\b/.test(evidence)) energies.add("diesel");
      if (/\belectric[ao]s?\b/.test(evidence)) energies.add("electrico");
      if (/\b(?:glp|lpg)\b/.test(evidence)) energies.add("glp");
    }
    if (energies.size !== 1 || !energies.has(routeEnergy)) return false;
  }
  return true;
};

export const sourceCategoryQualityIssue = (record: ProductRecord): string | null => {
  const path = sourcePath(record);
  if (!path) return SOURCE_CATEGORY_ISSUE;
  const confirmed = record.providerId === "gam" ? gamSourceConfirmed(record, path) :
    record.providerId === "gomariz" ? gomarizDocumentedSourceType(record, path) :
      record.providerId === "mercaeleva" ? mercaelevaDocumentedSourceType(record, path) : false;
  return confirmed ? null : SOURCE_CATEGORY_ISSUE;
};
