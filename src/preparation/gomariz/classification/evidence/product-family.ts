import type { ProductRecord } from "../../../../contracts/catalog.js";
import { energy, fold } from "../../../shared/classification/mapping/category-utils.js";

const describedFamilies: readonly { readonly prefix: string; readonly family: string }[] = [
  { prefix: "las tijeras electricas", family: "elevador-tijera" },
  { prefix: "las tijeras diesel", family: "elevador-tijera" },
  { prefix: "las articuladas electricas", family: "brazo-articulado" },
  { prefix: "las articuladas diesel", family: "brazo-articulado" },
  { prefix: "los telescopicos diesel", family: "brazo-telescopico" },
  { prefix: "los mastiles verticales", family: "elevador-mastil-vertical" },
  { prefix: "los camiones cesta", family: "camion-plataforma" },
  { prefix: "manipuladores. unifica", family: "manipulador-telescopico" },
  { prefix: "contamos con grupos electrogenos", family: "generador" }
];

const slugify = (value: string): string => fold(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/\bskayjack\b/g, "skyjack");

const identified = (record: ProductRecord, pathSlug: string): boolean => {
  const title = fold(record.title ?? "");
  const brand = fold(record.brand ?? "");
  const model = fold(record.model ?? "");
  const slug = slugify(pathSlug);
  const brandTokens = slugify(brand).split("-").filter(Boolean);
  const modelSlug = slugify(model);
  const slugTokens = slug.split("-");
  const titleTokens = slugify(title).split("-");
  return Boolean(brand && model && modelSlug && title.includes(model) &&
    slug.includes(modelSlug) && brandTokens.every((part) => slugTokens.includes(part) && titleTokens.includes(part)));
};

const documentedBrandScissor = (record: ProductRecord, path: readonly string[]): boolean =>
  path.length === 3 && energy(String(record.specs?.Motor ?? "")) === "electric" && /^\d+$/.test(path[2] ?? "") &&
  slugify(record.brand ?? "") === slugify(path[0] ?? "") &&
  slugify(record.model ?? "") === slugify(path[1] ?? "") &&
  identified(record, `${path[0]}-${path[1]}`) &&
  fold(record.longDescription ?? "").startsWith("las tijeras electricas ");

export const gomarizProductFamily = (record: ProductRecord, path: readonly string[]): string | null => {
  const description = fold(record.longDescription ?? "");
  if (documentedBrandScissor(record, path)) return "elevador-tijera";
  if (path.length !== 2 || path[0] !== "producto" || !identified(record, path[1] ?? "")) return null;
  return describedFamilies.find(({ prefix }) => description.startsWith(`${prefix} `))?.family ?? null;
};

export const gomarizDocumentedElectricScissor = (record: ProductRecord, path: readonly string[]): boolean =>
  (path.length === 3 && path[0] === "elevacion-y-trabajos-en-altura" && path[1] === "elevador-tijera" &&
    identified(record, path[2] ?? "") && fold(record.longDescription ?? "").startsWith("las tijeras electricas ")) ||
  documentedBrandScissor(record, path);
