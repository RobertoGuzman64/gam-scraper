import type { ProductRecord } from "../../../contracts/catalog.js";
import { sameEditorialUnit, verifiedEditorialIdentity, verifiedEditorialStructuredIdentity } from "../core/editorial-source-contract.js";
import { verifiedEditorialUnitPair } from "./editorial-unit-provenance.js";
import { hasUnconditionalEditorialClaim } from "../claims/editorial-claim-evidence.js";

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

const conflictingSourceYears = (record: ProductRecord): boolean => {
  const year = record.year?.trim();
  return Boolean(year && /^(?:19|20)\d{2}$/u.test(year) &&
    [...(record.longDescription ?? "").matchAll(/\b(?:19|20)\d{2}\b/gu)]
      .some(([published]) => published !== year));
};

const corroboratedSourceDetails = (
  source: ProductRecord, prepared: ProductRecord, general: string
): readonly string[] => {
  if (!source.specs?.["Nº de serie"] && !source.horometer ||
    !verifiedEditorialUnitPair(source, prepared) || conflictingSourceYears(source)) return [];
  const serial = source.specs?.["Nº de serie"];
  const verifiedSerial = typeof serial === "string" &&
    /^[a-z0-9][a-z0-9./-]{5,35}$/iu.test(serial) &&
    prepared.specs?.["Nº de serie"] === serial &&
    (!source.serialNumber || source.serialNumber.trim() === serial) &&
    (!prepared.serialNumber || prepared.serialNumber.trim() === serial) ? serial : null;
  const hours = source.horometer?.trim();
  const verifiedHours = hours && /^[1-9]\d{0,5} horas$/u.test(hours) &&
    source.specs?.Horómetro === hours && prepared.specs?.Horómetro === hours &&
    (!prepared.horometer || prepared.horometer.trim() === hours) ? hours : null;
  const additions: string[] = [];
  if (verifiedSerial && !general.includes(verifiedSerial) &&
    !/\b(?:n[uú]mero\s+de\s+serie|n[ºo]\s*de\s+serie|serie\s*[:#-])/iu.test(general)) {
    additions.push(`número de serie ${verifiedSerial}`);
  }
  if (verifiedHours && !/\bhor[oó]metro\b|\b\d[\d., ]*\s*(?:horas?|h)\b/iu.test(general)) {
    additions.push(`horómetro de ${verifiedHours}`);
  }
  return additions;
};

const declaredSourceModelVariant = (source: ProductRecord, prepared: ProductRecord, general: string): string | null => {
  const brand = source.brand?.trim();
  const model = source.model?.trim();
  if (!brand || !model || source.specs?.Marca !== brand || source.specs.Modelo !== model ||
    prepared.specs?.Marca !== brand || prepared.specs.Modelo !== model || !source.longDescription) return null;
  const literal = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(/\s+/gu, "\\s+");
  const denomination = `${brand} ${model} AC`;
  const pattern = new RegExp(`\\b${literal(brand)}\\s+${literal(model)}\\s+AC\\b`, "giu");
  if (!hasUnconditionalEditorialClaim(source.longDescription, pattern) ||
    new RegExp(pattern.source, "iu").test(general)) return null;
  return `El anuncio denomina esta unidad «${denomination}»; esa denominación no acredita por sí sola equipamiento ni prestaciones diferentes.`;
};

const corroboratedSellerDetails = (
  source: ProductRecord, prepared: ProductRecord, general: string
): readonly string[] => {
  if (!sameEditorialUnit(source, prepared) || conflictingSourceYears(source)) return [];
  const additions: string[] = [];
  const announcedVariant = declaredSourceModelVariant(source, prepared, general);
  if (announcedVariant !== null) additions.push(announcedVariant);
  const article = source.specs?.["Artículo No."];
  if (typeof article === "string" && /^[\p{L}\d/-]+$/u.test(article) &&
    prepared.specs?.["Artículo No."] === article && !general.includes(article)) {
    additions.push(`Referencia comercial declarada por el vendedor: ${article}.`);
  }
  const certification = source.specs?.["Certificación CE"];
  const contradictoryCertification = /\b(?:sin|no\s+(?:dispone\s+de|tiene|cuenta\s+con)|pendiente\s+de)\s+(?:la\s+)?(?:certificaci[oó]n|marcado)\s*CE\b|\bno\s+certificad[ao]\s+CE\b/iu;
  if (certification === "Yes" && prepared.specs?.["Certificación CE"] === certification &&
    !contradictoryCertification.test(`${source.title ?? ""} ${source.longDescription ?? ""}`) &&
    !/\b(?:certificaci[oó]n|marcado|conformidad)\s+CE\b/iu.test(general)) {
    additions.push("La ficha del proveedor declara certificación CE para esta unidad; el certificado no se ha verificado documentalmente.");
  }
  const hours = source.specs?.["Horas laborales"];
  if (typeof hours === "string" && /^(?:0|[1-9]\d*) h$/u.test(hours) &&
    prepared.specs?.["Horas laborales"] === hours &&
    source.horometer === hours.slice(0, -2) && prepared.horometer === source.horometer &&
    !/\bhor[oó]metro\b|\b\d[\d., ]*\s*(?:horas?|h)\b/iu.test(general)) {
    const announced = /\bHORAS\s*:?\s*(\d{1,6})\b/iu.exec(source.longDescription ?? "")?.[1];
    additions.push(announced && announced !== source.horometer
      ? `El anuncio de origen indica ${announced} horas y la ficha técnica ${hours}; las lecturas no se consideran equivalentes.`
      : `La ficha del proveedor declara ${hours} de uso para esta unidad.`);
  }
  const unstructuredZeroHours = /\b(?:HORAS?|HOURS?)\s*:?\s*0\b/giu;
  if (source.horometer === null && prepared.horometer === null &&
    source.specs?.["Horas laborales"] === undefined && prepared.specs?.["Horas laborales"] === undefined &&
    source.longDescription && hasUnconditionalEditorialClaim(source.longDescription, unstructuredZeroHours) &&
    !/\b(?:hor[oó]metro|horas?|hours?)\s*(?:(?:de\s+)?(?:uso|trabajo)\s*)?(?:de\s*)?0\b|\b0\s*(?:horas?|h)\b/iu.test(general)) {
    additions.push("El anuncio de origen declara «0 horas», sin una lectura de horómetro estructurada para esta unidad.");
  }
  const label = /\b(SECOND LIFE|PINTADA)\s*$/iu.exec(source.longDescription?.trim() ?? "")?.[1]?.toUpperCase();
  if (label === "SECOND LIFE" && !general.includes("SECOND LIFE")) {
    additions.push("El anuncio incluye la etiqueta comercial «SECOND LIFE», sin acreditar una rehabilitación concreta.");
  } else if (label === "PINTADA" && !/\bpintad[ao]\b/iu.test(general)) {
    additions.push("El anuncio indica «PINTADA», lo que no acredita una revisión mecánica.");
  }
  return additions;
};

export const resolveVerifiedEditorialUnitContext = (
  record: ProductRecord, general: string | null, prepared: ProductRecord = record
): string | null => {
  if (!general?.trim() || !(verifiedEditorialIdentity(record) || verifiedEditorialStructuredIdentity(record)) ||
    !verifiedEditorialUnitPair(record, prepared)) return general;
  const location = record.specs?.Ubicación === prepared.specs?.Ubicación ? sourceLocation(record) : null;
  const serial = record.specs?.["Nº de serie"] === prepared.specs?.["Nº de serie"] &&
    (!prepared.serialNumber || prepared.serialNumber.trim() === record.serialNumber?.trim())
    ? sourceSerial(record) : null;
  const additions: string[] = [];
  if (location !== null && !/\b(?:ubicaci[oó]n|situad[ao]s?\s+en)\b/iu.test(general)) {
    additions.push(`Ubicación declarada para esta unidad: ${location}.`);
  }
  if (serial !== null && !general.includes(serial)) {
    additions.push(`Número de serie declarado para esta unidad: ${serial}.`);
  }
  const sellerDetails = corroboratedSellerDetails(record, prepared, `${general} ${additions.join(" ")}`);
  additions.push(...sellerDetails);
  const details = corroboratedSourceDetails(record, prepared, `${general} ${additions.join(" ")}`);
  if (details.length > 0) {
    additions.push(`Según la ficha del proveedor, esta unidad tiene ${details.join(" y ")}.`);
  }
  return additions.length > 0 ? `${general.trim()}\n\n${additions.join(" ")}` : general;
};
