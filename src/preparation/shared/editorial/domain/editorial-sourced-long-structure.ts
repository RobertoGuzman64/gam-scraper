import type { ProductRecord } from "../../../../contracts/catalog.js";
import { sameEditorialUnit, verifiedEditorialIdentity } from "./editorial-source-contract.js";

const countWords = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;

export const structureSourcedLongGeneral = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  const original = source.longDescription?.trim();
  const current = general?.trim();
  if (!authenticatedOrigin || !sameEditorialUnit(source, prepared) ||
    !verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared) ||
    !original || !current || original !== current ||
    /\r|\n|<[^>]+>|https?:\/\/|@/u.test(original)) return null;
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
