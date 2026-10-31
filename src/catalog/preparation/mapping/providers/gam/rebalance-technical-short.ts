import { createHash } from "node:crypto";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import type { RebalancedGamDescriptions } from "./short-description.js";

const entries: Readonly<Record<string, { readonly url: string; readonly title: string; readonly model: string; readonly condition: "Nuevo" | "Segunda mano"; readonly sourceSha256: string }>> = {
  "4030": { url: "https://online.gamrentals.com/es/barredoras-industriales-nuevas/4030-bcs-s16l-descarga-baja", title: "Barredora TENNANT BCS S16L Descarga baja", model: "BCS S16L Descarga baja", condition: "Nuevo", sourceSha256: "61527c761ed708c494aa6aa04dda696c46a25ef20601ef8a138562eae6ff1f89" },
  "4039": { url: "https://online.gamrentals.com/es/tennant/4039-apl-v-wd-62", title: "Aspiradora TENNANT APL V-WD-62", model: "APL V-WD-62", condition: "Nuevo", sourceSha256: "a9a4e823c0f00e50bfbdff541bda97ba91cc04e4ec57dc801d1ab9f4875cd6aa" },
  "4018": { url: "https://online.gamrentals.com/es/tennant/4018-fcs-t20-c", title: "Fregadora TENNANT FCS T20 C", model: "T20", condition: "Nuevo", sourceSha256: "24feba9e1b5ce58b9727d474309f56a2a2f516281726adf52a35e4d17f9e80ef" },
  "4778": { url: "https://online.gamrentals.com/es/plataforma-articulada-hibrida-xcmg/4778-plataforma-articulada-hibrida-xcmg-xga16h", title: "Plataforma articulada híbrida 16M XCMG XGA16H", model: "XGA16H", condition: "Nuevo", sourceSha256: "32cd3d90dbf0120469ba1d44dc3ba7643439b457dc02a919bd096582fa77de13" },
  "2110": { url: "https://online.gamrentals.com/es/carretillas-trilaterales-hyster/2110-carretilla-para-pasillos-estrechos-hyster-c10", title: "Carretilla para pasillos estrechos Hyster C1.0", model: "C1.0", condition: "Nuevo", sourceSha256: "ff05c3ca5512011ed67dfab6864c259546d75ae6b38782267184eb5523a7aba8" },
  "6806": { url: "https://online.gamrentals.com/es/furgonetas-electricas-de-ocasion/6806-musoshi-pop-up-mini", title: "Musoshi PoP Up Mini", model: "P1.6", condition: "Segunda mano", sourceSha256: "f7b9ebc963e3993e8ac504bb259c5240bb1e65fab8c3a96a1ec880905b31a4aa" },
  "12": { url: "https://online.gamrentals.com/es/carretillas-elevadoras-diesel-hyster/12-carretilla-elevadora-glp-o-diesel-contrapesada-hyster-h40ft", title: "Carretilla elevadora GLP o diésel contrapesada Hyster H4.0FT", model: "H4.0FT", condition: "Nuevo", sourceSha256: "625efe8871e298377061d90dbdad68e68a36f939fa9115ebfa370b9084afcac2" },
  "912": { url: "https://online.gamrentals.com/es/transpaletas-yale/912-transpaleta-de-plataforma-de-alta-productividad", title: "Transpaleta Yale MP20XV 2000 Kg", model: "MP20 XV", condition: "Nuevo", sourceSha256: "de593cc5a8d0406aad0f50faa4672b7207092316f2d825dfb9aad9d7e6fb0874" }
};

const normalized = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLowerCase().replace(/[^a-z0-9]/gu, "");

const wordCount = (value: string): number => value.split(/\s+/u).filter(Boolean).length;

export const rebalanceGamTechnicalShort = (
  record: ProductRecord, preparedGeneral: string | null
): RebalancedGamDescriptions | null => {
  const expected = record.reference ? entries[record.reference] : undefined;
  const source = record.shortDescription?.trim();
  const general = preparedGeneral?.trim();
  if (!expected || record.providerId !== "gam" || record.condition !== expected.condition ||
    record.url !== expected.url || record.title !== expected.title || record.model !== expected.model ||
    !source || !general || createHash("sha256").update(source).digest("hex") !== expected.sourceSha256 ||
    wordCount(source) <= 45 || wordCount(general) > 700 ||
    typeof record.specs?.Modelo !== "string" ||
    normalized(record.specs.Modelo) !== normalized(expected.model) ||
    (record.brand !== null && (typeof record.specs?.Marca !== "string" ||
      normalized(record.specs.Marca) !== normalized(record.brand))) ||
    (record.brand === null && record.specs?.Marca !== undefined)) return null;

  const sentences = source.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u).map((value) => value.trim());
  const first = sentences[0];
  if (!first || sentences.length < 2 || wordCount(first) < 12) return null;
  const short = normalized(first).includes(normalized(expected.model)) &&
    (!record.brand || normalized(first).includes(normalized(record.brand))) ||
    record.brand === null && normalized(first).includes(normalized(record.title)) ?
    first : `${record.title.trim()}. ${first}`;
  if (wordCount(short) > 45 || wordCount(short) < 12) return null;
  const completeDetails = sentences.slice(1).filter((sentence) => /[.!?]$/u.test(sentence));
  const numbers = (value: string): ReadonlySet<string> => new Set(value.match(/\d+(?:[.,]\d+)*/gu) ?? []);
  const documentedNumbers = new Set(numbers(`${short} ${general}`));
  const selected = completeDetails.filter((sentence) =>
    [...numbers(sentence)].some((number) => !documentedNumbers.has(number)));
  const addition = selected.join(" ");
  const balancedGeneral = addition ? `${general}\n\n${addition}` : general;
  if (wordCount(balancedGeneral) > 800 ||
    [first, ...completeDetails].some((sentence) =>
      [...numbers(sentence)].some((number) => !numbers(`${short} ${balancedGeneral}`).has(number)))) return null;

  return { short, general: balancedGeneral };
};
