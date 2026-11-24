import type { ProductRecord } from "../../contracts/catalog.js";
import { fold } from "../../preparation/classification/category-utils.js";

export const isVerifiedManainHandTool = (source: ProductRecord): boolean => {
  if (source.providerId !== "manain" || source.categoryKey !== "venta" || source.condition !== "Segunda mano") {
    return false;
  }
  let url: URL;
  try {
    url = new URL(source.url);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.hostname !== "manain.com" || url.search || url.hash) return false;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0] !== "producto") return false;
  const route = /^venta-pequena-maquinaria-(radiales-electricas|martillos-electricos)-bosch-(.+)$/u.exec(segments[1] ?? "");
  if (!route || !route[1] || !route[2]) return false;
  const family = route[1];
  const slug = route[2];
  const brand = fold(source.brand ?? "");
  const model = fold(source.model ?? "");
  const specsBrand = source.specs?.["Marca"];
  const specsModel = source.specs?.["Modelo"];
  const specsMotor = source.specs?.["Motor"];
  if (brand !== "bosch" || !model || typeof specsBrand !== "string" || fold(specsBrand) !== brand ||
    typeof specsModel !== "string" || fold(specsModel) !== model ||
    typeof specsMotor !== "string" || fold(specsMotor) !== "electrico" ||
    fold(source.title ?? "") !== model) return false;
  const modelSlug = model.replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  const matchesFamily = family === "radiales-electricas" ? /^gws-/u.test(modelSlug) : /^g(?:sh|bh)-/u.test(modelSlug);
  return matchesFamily && (slug === modelSlug ||
    (slug.startsWith(`${modelSlug}-`) && /^-[2-9]\d*$/u.test(slug.slice(modelSlug.length))));
};
