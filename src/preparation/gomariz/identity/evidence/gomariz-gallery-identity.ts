import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialFamilyFromSourceGeneral, editorialFamilyOf } from "../../../shared/editorial/domain/editorial-families.js";
import { verifiedEditorialUrl } from "../../../shared/editorial/domain/editorial-source-url.js";

const hosts = ["www.gomarizrent.com", "gomarizrent.com"];

const token = (value: string): string => value.normalize("NFKD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es").replace(/[^a-z0-9]/gu, "");

const verifiedGallery = (record: ProductRecord): boolean => {
  const images = record.images ?? [];
  const reference = record.reference?.trim().toUpperCase();
  const name = token(`${record.brand ?? ""}${record.model ?? ""}`);
  if (!reference || !record.brand?.trim() || !record.model?.trim() || !name ||
    images.length < 2 || new Set(images).size !== images.length ||
    record.image !== images[0]) return false;
  return images.every((image) => {
    const url = verifiedEditorialUrl(image, hosts);
    if (!url) return false;
    const match = /^\/wp-content\/uploads\/20\d{2}\/(?:0[1-9]|1[0-2])\/([a-z]{1,5}\d{3,8})-(.+)-([1-9]\d{0,2})\.(?:jpe?g|png|webp)$/iu.exec(url.pathname);
    return match?.[1]?.toUpperCase() === reference && token(match[2] ?? "") === name;
  });
};

export const verifiedGomarizGallerySource = (record: ProductRecord, path: readonly string[]): boolean => {
  if (!verifiedGallery(record)) return false;
  const routeFamily = editorialFamilyOf(path.at(-2) ?? "");
  if (!routeFamily || routeFamily !== editorialFamilyFromSourceGeneral(record.longDescription)) return false;
  const slug = path.at(-1) ?? "";
  if (path[0] === "venta" && path.length === 4 && /^\d+$/u.test(slug)) return true;
  if (path[0] === "venta" || path.length !== 3 || !/-copia(?:-\d+)?$/u.test(slug)) return false;
  const source = token(slug.replace(/-copia(?:-\d+)?$/u, ""));
  const brand = token(record.brand ?? "");
  const model = token(record.model ?? "");
  const partialModel = source.startsWith(brand) ? source.slice(brand.length) : "";
  return partialModel.length >= 4 && model.startsWith(partialModel) && partialModel.length < model.length;
};
