import type { ProductRecord } from "../../../contracts/catalog.js";
import { sameEditorialUnit, verifiedEditorialIdentity, verifiedEditorialStructuredIdentity } from "../core/editorial-source-contract.js";
import { verifiedEditorialUnitPair } from "./editorial-unit-provenance.js";
import { containsEditorialBrandModel } from "./editorial-identity-match.js";
import { resolveVerifiedEditorialCondition } from "./editorial-condition.js";
import { resolveDeclaredBatteryStatus } from "../claims/editorial-battery-claims.js";
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

const declaredHorometerReplacement = (source: ProductRecord, prepared: ProductRecord, texts: string): boolean => {
  const replacement = (value: unknown): boolean => typeof value === "string" &&
    /^horometro sustituido(?: horas)?$/u.test(plain(value));
  if (!replacement(source.specs?.["Horómetro"]) || !replacement(prepared.specs?.["Horómetro"]) ||
    (source.horometer !== null && !replacement(source.horometer)) ||
    (prepared.horometer !== null && !replacement(prepared.horometer))) return false;
  if ([source, prepared].some((record) => ["Horas (h)", "Horas laborales", "Horas de uso", "Horas"]
    .some((key) => record.specs?.[key] !== undefined))) return false;
  return !/\bhor[oó]metro\b|\b\d[\d., ]*\s*(?:horas?|h)\b/iu.test(texts);
};

const declaredMileage = (source: ProductRecord, prepared: ProductRecord, texts: string): string | null => {
  const keys = ["Kilómetros", "Kilómetros (km)"];
  const reading = (record: ProductRecord): number | null => {
    const values = keys.flatMap((key) => record.specs?.[key] === undefined ? [] : [record.specs[key]]);
    const parsed = values.map((value) => {
      const match = typeof value === "string" ? /^([1-9]\d{0,6}|[1-9]\d{0,2}(?: \d{3}){1,2})\s*km$/iu.exec(value.trim()) : null;
      return match?.[1] === undefined ? null : Number(match[1].replace(/ /gu, ""));
    });
    const first = parsed[0];
    return first !== undefined && first !== null && first <= 9999999 && parsed.every((value) => value === first) ? first : null;
  };
  if (!verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared)) return null;
  const original = reading(source);
  if (original === null || original !== reading(prepared)) return null;
  const distances = texts
    .replace(/\b\d+(?:[.,]\d+)?\s*km\s*\/\s*h\b/giu, "")
    .replace(/\bautonom[ií]a(?:\s+(?:m[aá]xima|anunciada|nominal))?\s*(?::|de)?\s*(?:hasta\s+)?\d+(?:[.,]\d+)?\s*km\b/giu, "")
    .replace(/\b(?:hasta\s+)?\d+(?:[.,]\d+)?\s*km\s+de\s+autonom[ií]a\b/giu, "");
  if (/\b(?:kilometraje|kil[oó]metros?|od[oó]metro)\b|\b\d[\d., ]*\s*km\b/iu.test(distances)) return null;
  return `La ficha del proveedor declara un kilometraje de ${original.toLocaleString("es-ES")} km para esta unidad; no se ha verificado la lectura.`;
};

const declaredUnitHistory = (source: ProductRecord, prepared: ProductRecord, general: string): readonly string[] => {
  if (!source.brand || !source.model ||
    !containsEditorialBrandModel(general, source.brand, source.model) ||
    resolveVerifiedEditorialCondition(source) !== "Segunda mano" ||
    resolveVerifiedEditorialCondition(prepared) !== "Segunda mano" || conflictingSourceYears(source)) return [];
  const texts = [source.title, source.shortDescription, source.longDescription,
    prepared.title, prepared.shortDescription, prepared.longDescription, general].join(" ");
  const affirmative = (key: string): boolean => {
    const value = source.specs?.[key];
    return typeof value === "string" && plain(value) === "si" &&
      typeof prepared.specs?.[key] === "string" && plain(prepared.specs[key]) === "si";
  };
  const additions: string[] = [];
  const batteryStatus = resolveDeclaredBatteryStatus(source, prepared, texts);
  if (batteryStatus !== null) additions.push(batteryStatus);
  const mileage = declaredMileage(source, prepared, texts);
  if (mileage !== null) additions.push(mileage);
  if (declaredHorometerReplacement(source, prepared, texts)) {
    additions.push("El proveedor declara que el horómetro ha sido sustituido; no consta una lectura total de horas de uso acreditada.");
  }
  if (affirmative("Matriculada") && !/\b(?:matr[ií]cul\p{L}*|ITV|homolog\p{L}*)\b/iu.test(texts) &&
    source.specs?.Matrícula === undefined && prepared.specs?.Matrícula === undefined &&
    source.specs?.["Reg. no."] === undefined && prepared.specs?.["Reg. no."] === undefined) {
    additions.push("El proveedor declara que la unidad está matriculada; no se ha comprobado la vigencia de su documentación ni la habilitación para circular.");
  }
  if (affirmative("Restaurada") && !/\b(?:restaur\p{L}*|reacondicion\p{L}*|rehabilit\p{L}*|reconstru\p{L}*|second life)\b/iu.test(texts)) {
    additions.push("El proveedor declara que la unidad está restaurada, sin especificar el alcance de los trabajos ni acreditar una revisión mecánica.");
  }
  return additions;
};

export const resolveVerifiedEditorialUnitContext = (
  record: ProductRecord, general: string | null, prepared: ProductRecord = record
): string | null => {
  if (!general?.trim() || !verifiedEditorialUnitPair(record, prepared)) return general;
  const history = declaredUnitHistory(record, prepared, general);
  if (!(verifiedEditorialIdentity(record) || verifiedEditorialStructuredIdentity(record))) {
    return history.length > 0 ? `${general.trim()}\n\n${history.join(" ")}` : general;
  }
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
  additions.push(...sellerDetails, ...history);
  const details = corroboratedSourceDetails(record, prepared, `${general} ${additions.join(" ")}`);
  if (details.length > 0) {
    additions.push(`Según la ficha del proveedor, esta unidad tiene ${details.join(" y ")}.`);
  }
  return additions.length > 0 ? `${general.trim()}\n\n${additions.join(" ")}` : general;
};
