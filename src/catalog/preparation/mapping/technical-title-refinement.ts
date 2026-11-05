import type { ProductRecord } from "../../../contracts/catalog.js";
import { findBrandTypo } from "../../normalization/technical-title-identity.js";

const fold = (value: string): string => value.normalize("NFKD").replace(/\p{M}/gu, "")
  .toLocaleLowerCase("es").replace(/[^\p{L}\p{N}]+/gu, "").trim().replace(/\s+/gu, " ");
const compact = (value: string): string => fold(value).replace(/\s/gu, "");
const escapePattern = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const matchesSpec = (source: ProductRecord, key: string, expected: string): boolean => {
  const value = source.specs?.[key];
  return typeof value === "string" && compact(value) === compact(expected);
};
const contains = (text: string | null, value: string): boolean =>
  !!text && compact(value).length >= 3 && compact(text).includes(compact(value));

const reconcileBrand = (source: ProductRecord, title: string): string => {
  const brand = source.brand?.trim();
  const model = source.model?.trim();
  if (!brand || !model || !contains(title, model) || contains(title, brand) ||
    !matchesSpec(source, "Marca", brand)) return title;

  if (matchesSpec(source, "Modelo", model) && !/\s/u.test(brand) && brand.length >= 6) {
    const typo = findBrandTypo(title, brand);
    if (typo) return `${title.slice(0, typo.index)}${brand}${title.slice(typo.index + typo.length)}`;
  }

  if (!contains(source.shortDescription, brand) || !contains(source.longDescription, brand) ||
    !contains(source.shortDescription, model)) return title;
  const modelAt = title.toLocaleLowerCase("es").indexOf(model.toLocaleLowerCase("es"));
  return modelAt < 0 ? title : `${title.slice(0, modelAt)}${brand} ${title.slice(modelAt)}`;
};

const reconcileModel = (source: ProductRecord, title: string): string => {
  const brand = source.brand?.trim();
  const model = source.model?.trim();
  if (!brand || !model || !/^[\p{L}\p{N}.-]+$/u.test(model) ||
    !contains(title, brand) || contains(title, model) ||
    !matchesSpec(source, "Modelo", model) ||
    !contains(source.shortDescription, model) || !contains(source.longDescription, model)) return title;
  const atEnd = new RegExp(`(${escapePattern(brand)}\\s+)([\\p{L}\\p{N}.-]+)$`, "iu").exec(title);
  return atEnd && /\d/u.test(atEnd[2] ?? "")
    ? `${title.slice(0, atEnd.index)}${atEnd[1]}${model}` : title;
};

export const refineTechnicalTitle = (source: ProductRecord, preparedTitle: string | null): string | null => {
  if (!preparedTitle?.trim()) return preparedTitle;
  let title = preparedTitle.trim();
  if (source.providerId === "gam") {
    title = title.replace(/\s*\|\s*GAM Online\s*$/iu, "");
    title = title.replace(/\bPlataformas(\s+)articulada\b/giu, "Plataforma$1articulada");
    title = title.replace(/\bplatafora\s+4\s+ejes\b/iu, "Plataforma de 4 ejes");
    title = title.replace(/(tijera|el[eé]ctrica)(\d+\s*(?:m|mt)\b)/giu, "$1 $2");
    if (source.brand && source.model && compact(title) === compact(`${source.brand} ${source.model}`) &&
      /\bbicicleta\s+el[eé]ctrica\b/iu.test(source.shortDescription ?? "") &&
      /\bbicicleta\s+el[eé]ctrica\b/iu.test(source.longDescription ?? "")) {
      title = `Bicicleta eléctrica ${title}`;
    }
  }
  if (source.providerId === "gomariz" && source.categoryKey === "venta" &&
    /^Los camiones cesta\b/iu.test(source.longDescription?.trim() ?? "") &&
    !/\b(?:cami[oó]n(?:es)? cesta|plataforma sobre cami[oó]n)\b/iu.test(title)) {
    title = `Camión cesta ${title}`;
  }
  if (source.providerId === "mercaeleva" && /\bCAMION CESTA\b/iu.test(title)) {
    const repeated = /\s+(\d+(?:[.,]\d+)?)\s+MT\s*$/iu.exec(title);
    if (repeated && new RegExp(`\\b${escapePattern(repeated[1] ?? "")}\\s+MT\\b`, "giu")
      .test(title.slice(0, repeated.index)) &&
      matchesSpec(source, "Altura de trabajo", `${repeated[1]} m`)) {
      title = title.slice(0, repeated.index);
    }
  }
  if (source.providerId === "gam") {
    title = reconcileBrand(source, title);
    title = reconcileModel(source, title);
    title = title.replace(/\s*\|\s*/gu, " | ");
  }
  return title.trim();
};
