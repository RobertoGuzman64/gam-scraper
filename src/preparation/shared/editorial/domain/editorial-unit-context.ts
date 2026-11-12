import type { ProductRecord } from "../../../../contracts/catalog.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";
import { resolveEditorialSource } from "./editorial-source.js";

const plain = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").trim().toLocaleLowerCase("es");

const sourceLocation = (record: ProductRecord): string | null => {
  const location = record.location?.trim();
  const declared = record.specs?.Ubicación;
  if (!location || typeof declared !== "string" || plain(declared) !== plain(location) ||
    !/^[\p{L}\s-]{3,60}$/u.test(location)) return null;
  return location;
};

const sourceSerial = (record: ProductRecord): string | null => {
  const serial = record.serialNumber?.trim();
  const declared = record.specs?.["Nº de serie"];
  if (!serial || typeof declared !== "string" || declared.trim() !== serial ||
    !/^[\p{L}\p{N}./-]{4,60}$/u.test(serial)) return null;
  return serial;
};

export const resolveVerifiedEditorialUnitContext = (
  record: ProductRecord, general: string | null
): string | null => {
  if (!general?.trim() || !verifiedEditorialIdentity(record) || !resolveEditorialSource(record)) return general;
  const location = sourceLocation(record);
  const serial = sourceSerial(record);
  const additions: string[] = [];
  if (location !== null && !/\b(?:ubicaci[oó]n|situad[ao]s?\s+en)\b/iu.test(general)) {
    additions.push(`Ubicación declarada para esta unidad: ${location}.`);
  }
  if (serial !== null && !general.includes(serial)) {
    additions.push(`Número de serie declarado para esta unidad: ${serial}.`);
  }
  return additions.length > 0 ? `${general.trim()}\n\n${additions.join(" ")}` : general;
};
