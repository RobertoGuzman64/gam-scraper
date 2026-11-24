import type { ProductRecord } from "../../../contracts/catalog.js";
import { editorialMetricOf, editorialQuantityOf, formatEditorialQuantity } from "../measurements/editorial-measurements.js";
import { editorialFamilyFromSourceGeneral, editorialFamilyName, editorialFamilyOf, resolveConsistentEditorialFamily } from "../core/editorial-families.js";
import { verifiedEditorialIdentity, verifiedEditorialStructuredIdentity } from "../core/editorial-source-contract.js";
import { resolveEditorialSource } from "../core/editorial-source.js";
import { resolveEditorialFacts } from "../core/editorial-facts.js";
import type { EditorialFamily } from "../core/editorial-families.js";
import { containsEditorialBrandModel } from "../identity/editorial-identity-match.js";
import { containsEditorialSourceSlugModel } from "../source/editorial-source-url.js";
import { verifiedEditorialUnitPair } from "../identity/editorial-unit-provenance.js";

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
  const observed = unit === "m" ? editorialMetricOf(record.specs, keys) : editorialQuantityOf(record.specs, keys, unit);
  return expected !== null && observed === expected ? expected : null;
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
    fold(String(record.specs?.["Tipo de motor"] ?? "")) === "electrico") {
    const mentioned = /\bplataforma\s+(?:de\s+)?tijera\s+electrica\s+altura\s+de\s+trabajo\s+(\d+(?:[.,]\d{1,3})?)\s*(?:mt|m|metros?)\b/u.exec(description);
    const height = mentioned?.[1] ? matchedMetric(record, ["Altura de trabajo"], "m", mentioned[1]) : null;
    if (height !== null && height >= 3 && height <= 60) {
      return `Plataforma de tijera eléctrica ${brand} ${model} de ${formatEditorialQuantity(height)} m`;
    }
  }

  const forklift = /^CARRETILLA ELEVADORA DIESEL (\d{3,5}) KG$/iu.exec(additional);
  if (forklift?.[1]) {
    const capacity = matchedMetric(record, ["Capacidad máxima de elevación"], "kg", forklift[1]);
    return capacity !== null && description.includes(`carretilla elevadora diesel ${forklift[1]} kg`)
      ? `Carretilla elevadora diésel ${brand} ${model} de ${formatEditorialQuantity(capacity)} kg` : null;
  }
  return null;
};

const corroboratedHeadingFamily = (
  record: ProductRecord, prepared: ProductRecord, family: EditorialFamily
): boolean => {
  if (!verifiedEditorialUnitPair(record, prepared) ||
    record.title !== prepared.title || record.longDescription !== prepared.longDescription ||
    record.shortDescription?.trim() || prepared.shortDescription?.trim() ||
    !verifiedEditorialIdentity(prepared) || record.specs?.["Título adicional"] !== undefined ||
    prepared.specs?.["Título adicional"] !== undefined) return false;
  const heading = fold(record.longDescription ?? "");
  const platformHeading = /^(?:las?\s+)?(?:tijeras?|articuladas?)\s+(?:electricas?|diesel)\b|^(?:los?\s+)?(?:telescopicos?\s+(?:diesel|electricos?)|mastiles?\s+verticales?)\b/u;
  const generatorHeading = /^(?:contamos\s+con\s+)?grupos?\s+electrogenos?\b/u;
  if (!(family.startsWith("plataforma-") && platformHeading.test(heading) ||
    family === "grupo-electrogeno" && generatorHeading.test(heading))) return false;
  const original = resolveEditorialFacts(record, family);
  const current = resolveEditorialFacts(prepared, family);
  if (!original || !current || original.family !== current.family || original.energy !== current.energy) return false;
  if (family === "grupo-electrogeno") return original.powerKva !== null && original.powerKva === current.powerKva;
  return original.workingHeightM !== null && original.workingHeightM === current.workingHeightM &&
    original.loadCapacityKg !== null && original.loadCapacityKg === current.loadCapacityKg &&
    original.platformHeightM === current.platformHeightM &&
    (original.platformHeightM === null || original.platformHeightM < original.workingHeightM);
};

const documentedElectricMobilityTitle = (record: ProductRecord, prepared: ProductRecord, clues: string): string | null => {
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  if (!brand || !model || !verifiedEditorialUnitPair(record, prepared) ||
    !verifiedEditorialStructuredIdentity(record) || !verifiedEditorialStructuredIdentity(prepared) ||
    record.condition !== "Segunda mano" || record.title !== prepared.title ||
    record.shortDescription !== prepared.shortDescription || record.longDescription !== prepared.longDescription ||
    record.specs?.["Título adicional"] !== undefined || prepared.specs?.["Título adicional"] !== undefined) return null;
  const short = record.shortDescription ?? "";
  const general = record.longDescription ?? "";
  const texts = [fold(short), fold(general)];
  const motors = [record, prepared].flatMap((item) => [item.specs?.Motor, item.specs?.["Tipo motor"],
    item.specs?.["Tipo de motor"], item.specs?.Motorización]).filter((value) => value !== undefined);
  if (motors.some((value) => typeof value !== "string" || !/^electric[oa]$/u.test(fold(value)))) return null;
  const slug = new URL(record.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  if (!containsEditorialSourceSlugModel(slug, model, undefined)) return null;
  const families = [
    { name: "Bicicleta eléctrica", route: /\bbicicletas?[-\s]+electricas?\b/u, text: /\bbicicleta\s+electrica\b/u, claim: /\bes\s+una\s+bicicleta\s+electrica\b/u },
    { name: "Ciclomotor eléctrico", route: /\bciclomotores?[-\s]+electricos?\b/u, text: /\bciclomotor\s+electrico\b/u, claim: /\bes\s+un\s+ciclomotor\s+electrico\b/u }
  ];
  const matching = families.filter((family) => family.route.test(fold(clues)) &&
    texts.every((text) => {
      const heading = text.slice(0, 180);
      const match = family.claim.exec(heading);
      return match !== null && !/\bno\s+es\b/u.test(heading) &&
        containsEditorialBrandModel(heading.slice(0, match.index), brand, model);
    }));
  const family = matching[0];
  if (!family || matching.length !== 1 || texts.some((text) => /\b(?:motocicletas?|motos?|scooters?|cuatriciclos?)\b/u.test(text) ||
    families.some((other) => other !== family && other.text.test(text)))) return null;
  return `${family.name} ${record.title?.trim() ?? ""}`;
};

const documentedEquipmentTitle = (record: ProductRecord, prepared: ProductRecord): string | null => {
  if (!verifiedEditorialUnitPair(record, prepared) || !verifiedEditorialIdentity(prepared) ||
    record.condition !== "Segunda mano" || record.title !== prepared.title ||
    record.longDescription !== prepared.longDescription || record.shortDescription?.trim() ||
    prepared.shortDescription?.trim() || record.specs?.["Título adicional"] !== undefined ||
    prepared.specs?.["Título adicional"] !== undefined) return null;
  const model = record.model?.trim();
  if (!model) return null;
  const path = new URL(record.url).pathname.split("/").filter(Boolean);
  const slug = path.at(-1) ?? "";
  if (!containsEditorialSourceSlugModel(slug, model, undefined)) return null;
  const route = fold(path.at(-2) ?? "");
  const general = fold(record.longDescription ?? "");
  const family = editorialFamilyFromSourceGeneral(record.longDescription);
  if (!family || [record, prepared].some((item) => {
    const declared = editorialFamilyOf(`${item.subcategory ?? ""} | ${item.categoryName}`);
    return declared !== null && declared !== family;
  })) return null;
  const weight = editorialQuantityOf(record.specs, ["Peso", "Peso (kg)"], "kg");
  if (weight === null || weight !== editorialQuantityOf(prepared.specs, ["Peso", "Peso (kg)"], "kg")) return null;
  const width = editorialMetricOf(record.specs, ["Anchura", "Ancho"]);
  if (width === null || width !== editorialMetricOf(prepared.specs, ["Anchura", "Ancho"])) return null;
  if (/^(?:torres?-de-luz|torres?-de-iluminacion)$/u.test(route) &&
    /^(?:las?\s+)?torres?\s+de\s+iluminacion\b/u.test(general) && family === "torre-iluminacion") {
    return `Torre de iluminación ${record.title}`;
  }
  const rodillo = /^el\s+([a-z0-9-]+)\s+es\s+un\s+rodillo\b/u.exec(general);
  if (/^rodillos?$/u.test(route) && rodillo?.[1] && compact(rodillo[1]) === compact(model) &&
    family === "compactadora" && /\bcompactacion\b/u.test(general)) {
    return `Rodillo compactador ${record.title}`;
  }
  return null;
};

export const resolveDocumentedFamilyTitle = (record: ProductRecord, prepared: ProductRecord = record): string | null => {
  const source = resolveEditorialSource(record);
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  const title = record.title?.trim();
  if (!source || !verifiedEditorialIdentity(record) || !brand || !model || !title ||
    fold(title) !== fold(`${brand} ${model}`)) return null;
  const mobility = documentedElectricMobilityTitle(record, prepared, source.familyClues);
  if (mobility !== null) return mobility;
  const equipment = documentedEquipmentTitle(record, prepared);
  if (equipment !== null) return equipment;
  const sourceFamily = resolveConsistentEditorialFamily(source.familyClues, record.title,
    typeof record.specs?.["Título adicional"] === "string" ? record.specs["Título adicional"] : null,
    `${record.subcategory ?? ""} | ${record.categoryName}`);
  const describedFamily = editorialFamilyFromSourceGeneral(record.longDescription);
  if (!describedFamily || (sourceFamily !== null ? sourceFamily !== describedFamily :
    !corroboratedHeadingFamily(record, prepared, describedFamily))) return null;
  const noun = editorialFamilyName(describedFamily);
  return `${noun[0]?.toLocaleUpperCase("es") ?? ""}${noun.slice(1)} ${brand} ${model}`;
};
