import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialQuantityOf, formatEditorialQuantity } from "./editorial-measurements.js";
import { editorialFamilyFromSourceGeneral, editorialFamilyName, resolveConsistentEditorialFamily } from "./editorial-families.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";
import { resolveEditorialSource } from "./editorial-source.js";

const fold = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "")
  .toLocaleLowerCase("es").trim().replace(/\s+/gu, " ");
const compact = (value: string): string => fold(value).replace(/[^\p{L}\p{N}]+/gu, "");
const positive = (value: string): number | null => {
  if (!/^\d+(?:[.,]\d{1,2})?$/u.test(value)) return null;
  const number = Number(value.replace(",", "."));
  return number > 0 && Number.isFinite(number) ? number : null;
};
const matchedMetric = (record: ProductRecord, keys: readonly string[], unit: "m" | "kg", raw: string): number | null => {
  const expected = positive(raw);
  return expected !== null && editorialQuantityOf(record.specs, keys, unit) === expected ? expected : null;
};

export const resolveDocumentedEditorialTitle = (record: ProductRecord): string | null => {
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  const title = record.title?.trim();
  const additional = record.specs?.["Título adicional"];
  if (!verifiedEditorialIdentity(record) || !resolveEditorialSource(record) ||
    record.condition !== "Segunda mano" || fold(String(record.specs?.Estado ?? "")) !== "usado" ||
    !brand || !model || !title || typeof additional !== "string" ||
    !title.startsWith(`${brand} ${model} `) ||
    fold(title.slice(`${brand} ${model}`.length)) !== fold(additional) ||
    (record.specs?.Marca !== undefined && compact(String(record.specs.Marca)) !== compact(brand)) ||
    (record.specs?.Modelo !== undefined && compact(String(record.specs.Modelo)) !== compact(model))) return null;
  const description = fold(record.longDescription ?? "");
  if (!compact(description).includes(compact(`${brand} ${model}`))) return null;

  const offroad = /^CARRETILLA 4x4 (\d{3,5})KG$/iu.exec(additional);
  if (offroad?.[1]) {
    const capacity = matchedMetric(record, ["Capacidad máxima de elevación"], "kg", offroad[1]);
    return capacity !== null && description.includes(`carretilla 4x4 ${formatEditorialQuantity(capacity).replace(".", "")}kg`)
      ? `Carretilla todoterreno 4x4 ${brand} ${model} de ${formatEditorialQuantity(capacity)} kg` : null;
  }

  const dumper = /^DUMPER GIRATORIO (\d{3,5}) KG$/iu.exec(additional);
  if (dumper?.[1]) {
    const capacity = positive(dumper[1]);
    return capacity !== null && description.includes(`dumper giratorio capacidad de carga ${dumper[1]} kg`)
      ? `Dúmper giratorio ${brand} ${model} de ${formatEditorialQuantity(capacity)} kg` : null;
  }

  const handler = /^MANIPULADOR TELESCOPICO (\d+(?:[.,]\d+)?) MT$/iu.exec(additional);
  if (handler?.[1]) {
    const height = matchedMetric(record, ["Altura máxima de elevación"], "m", handler[1]);
    return height !== null && fold(String(record.specs?.["Tipo de motor"] ?? "")) === "diesel" &&
      description.includes(`manipulador telescopico altura de trabajo ${handler[1]} mt`)
      ? `Manipulador telescópico ${brand} ${model} de ${formatEditorialQuantity(height)} m` : null;
  }

  const vertical = /^PLATAFORMA VERTICAL AUTOPROPULSADA (\d+(?:[.,]\d+)?) MT$/iu.exec(additional);
  if (vertical?.[1]) {
    const height = matchedMetric(record, ["Altura de trabajo"], "m", vertical[1]);
    return height !== null && fold(String(record.specs?.["Tipo de motor"] ?? "")) === "electrico" &&
      description.includes(`plataforma vertical autopropulsada altura de trabajo ${vertical[1]} mt`)
      ? `Plataforma vertical autopropulsada eléctrica ${brand} ${model} de ${formatEditorialQuantity(height)} m` : null;
  }

  if (fold(additional) === "plataforma de tijera electrica" &&
    fold(String(record.specs?.["Tipo de motor"] ?? "")) === "electrico" &&
    matchedMetric(record, ["Altura de trabajo"], "m", "8") === 8 &&
    /plataforma tijera electrica altura de trabajo 8 mt/u.test(description)) {
    return `Plataforma de tijera eléctrica ${brand} ${model} de 8 m`;
  }

  const forklift = /^CARRETILLA ELEVADORA DIESEL (\d{3,5}) KG$/iu.exec(additional);
  if (forklift?.[1]) {
    const capacity = matchedMetric(record, ["Capacidad máxima de elevación"], "kg", forklift[1]);
    return capacity !== null && description.includes(`carretilla elevadora diesel ${forklift[1]} kg`)
      ? `Carretilla elevadora diésel ${brand} ${model} de ${formatEditorialQuantity(capacity)} kg` : null;
  }
  return null;
};

export const resolveDocumentedFamilyTitle = (record: ProductRecord): string | null => {
  const source = resolveEditorialSource(record);
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  const title = record.title?.trim();
  if (!source || !verifiedEditorialIdentity(record) || !brand || !model || !title ||
    fold(title) !== fold(`${brand} ${model}`)) return null;
  const sourceFamily = resolveConsistentEditorialFamily(source.familyClues, record.title,
    typeof record.specs?.["Título adicional"] === "string" ? record.specs["Título adicional"] : null,
    `${record.subcategory ?? ""} | ${record.categoryName}`);
  const describedFamily = editorialFamilyFromSourceGeneral(record.longDescription);
  if (!sourceFamily || sourceFamily !== describedFamily) return null;
  const noun = editorialFamilyName(sourceFamily);
  return `${noun[0]?.toLocaleUpperCase("es") ?? ""}${noun.slice(1)} ${brand} ${model}`;
};
