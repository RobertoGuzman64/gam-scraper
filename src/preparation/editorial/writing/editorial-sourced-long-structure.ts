import type { ProductRecord } from "../../../contracts/catalog.js";
import { sameEditorialUnit, verifiedEditorialIdentity } from "../core/editorial-source-contract.js";

import { reconcileVerifiedSourceFamily } from "../../technical/preparation-technical-stages.js";
import { editorialFamilyOf } from "../core/editorial-families.js";
import { containsEditorialBrandModel } from "../identity/editorial-identity-match.js";
import { editorialMetricOf, editorialQuantity, formatEditorialQuantity } from "../measurements/editorial-measurements.js";

const structureReachTruckListing = (source: ProductRecord, prepared: ProductRecord, current: string): string | null => {
  if (prepared.longDescription?.trim() !== current ||
    source.providerId !== prepared.providerId || source.condition !== "Segunda mano" ||
    !source.brand || !source.model || editorialFamilyOf(source.title ?? "") !== "carretilla-retractil") return null;
  const match = /^Ref\. ([A-Z0-9-]+) CARRETILLA RETR[AÁ]CTIL EL[EÉ]CTRICA (\d{3,5}) kg ALTURA DE ELEVACI[OÓ]N (\d[\d.,]*) mm (.+?) HORAS (\d+) AÑO DE FABRICACI[OÓ]N (\d{4})$/iu.exec(current);
  if (!match?.[1] || !match[2] || !match[3] || !match[4] || !match[5] || !match[6] ||
    !containsEditorialBrandModel(match[4], source.brand, source.model) ||
    reconcileVerifiedSourceFamily(source).longDescription?.trim() !== current) return null;
  const [reference, capacity, heightText, , hours, year] = match.slice(1);
  const height = editorialMetricOf({ Altura: `${heightText} mm` }, ["Altura"]);
  const numericHours = Number(hours);
  const capacityValue = Number(capacity);
  if (height === null || height < 1 || height > 20 || capacityValue < 500 || capacityValue > 10000 ||
    !Number.isSafeInteger(numericHours) || numericHours < 0 || numericHours > 100000 ||
    [source, prepared].some((record) => {
      const additional = String(record.specs?.["Título adicional"] ?? "");
      return record.year !== year || record.specs?.["Año de fabricación"] !== year ||
        record.specs?.["Artículo No."] !== reference ||
        Number(record.horometer?.replace(/\s/gu, "")) !== numericHours ||
        editorialQuantity(record.specs?.["Horas laborales"], "h") !== numericHours ||
        editorialFamilyOf(additional) !== "carretilla-retractil" ||
        ![record.title ?? "", additional].every((text) => {
          const values = [...text.matchAll(/\b(\d{3,5})\s*kg\b/giu)];
          return values.length === 1 && Number(values[0]?.[1]) === capacityValue;
        }) || ["Altura de elevación", "Altura máxima de elevación", "Altura de trabajo"].some((key) =>
          record.specs?.[key] !== undefined && editorialMetricOf(record.specs, [key]) !== height);
    })) return null;
  return `La ${source.brand} ${source.model} se anuncia como carretilla retráctil eléctrica de segunda mano. El texto comercial indica una capacidad nominal de ${formatEditorialQuantity(capacityValue)} kg y una altura de elevación de ${formatEditorialQuantity(height)} m. La unidad figura con referencia del vendedor ${reference}, año de fabricación ${year} y ${formatEditorialQuantity(numericHours)} horas declaradas. La capacidad disponible a la altura máxima debe comprobarse en el diagrama de cargas correspondiente a la configuración del mástil.`;
};

const countWords = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;

export const structureSourcedLongGeneral = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  const original = source.longDescription?.trim();
  const current = general?.trim();
  if (!authenticatedOrigin || !sameEditorialUnit(source, prepared) ||
    !verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared) ||
    !original || !current ||
    /\r|\n|<[^>]+>|https?:\/\/|@/u.test(original)) return null;
  const listing = structureReachTruckListing(source, prepared, current);
  if (listing !== null) return listing;
  if (original !== current) return null;
  const length = countWords(current);
  if (length < 200 || length > 320) return null;
  const boundaries = [...current.matchAll(/(?<=[.!?]) (?=[¿¡A-ZÁÉÍÓÚÜÑ0-9])/gu)];
  if (boundaries.length < 7) return null;
  const candidates = boundaries.flatMap((boundary) => {
    const offset = boundary.index;
    if (offset === undefined) return [];
    const before = countWords(current.slice(0, offset));
    const after = length - before;
    return before >= 85 && after >= 85 ? [{ offset, distance: Math.abs(before - after) }] : [];
  });
  candidates.sort((left, right) => left.distance - right.distance || left.offset - right.offset);
  const cut = candidates[0]?.offset;
  return cut === undefined ? null : `${current.slice(0, cut)}\n\n${current.slice(cut + 1)}`;
};
