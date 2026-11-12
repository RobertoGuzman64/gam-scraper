import type { ProductRecord } from "../../../../contracts/catalog.js";
import { invalidGomarizPlatformHeight } from "../../../../catalog/normalization/gomariz/technical.js";
import { sourceEditorialMeasurement } from "../../../shared/editorial/domain/source-measurement.js";
import { resolveGomarizEditorialFamily } from "./source-family.js";

const families: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "elevacion-y-trabajos-en-altura": {
    "elevador-tijera": "La plataforma de tijera",
    "brazo-articulado": "La plataforma articulada",
    "brazo-articulado-boom-lift": "La plataforma articulada",
    "elevador-mastil-vertical": "El elevador de mástil vertical"
  },
  "manipulacion-de-materiales": {
    "manipulador-telescopico": "El manipulador telescópico",
    "carretilla-industrial": "La carretilla industrial",
    "carretilla-retractil": "La carretilla retráctil"
  },
  "energia-electrica-e-iluminacion": { "torre-de-luz": "La torre de iluminación" },
  "movimiento-de-tierras-demolicion-y-compactacion": { dumper: "El dúmper" }
};

const genericGeneralPatterns: Readonly<Record<string, RegExp>> = {
  "elevador-tijera": /^Las Tijeras (?:Eléctricas|Diésel)\b/i,
  "brazo-articulado": /^Las Articuladas (?:Eléctricas|Diésel)\b/i,
  "brazo-articulado-boom-lift": /^Las Articuladas Diésel\b/i,
  "elevador-mastil-vertical": /^Los Mástiles Verticales\b/i,
  "manipulador-telescopico": /^Manipuladores\./i,
  "carretilla-industrial": /^(?:Indicadas especialmente|Máquinas destinadas)\b/i,
  "carretilla-retractil": /^Indicadas especialmente\b/i,
  "torre-de-luz": /^Las torres de iluminación\b/i,
  dumper: /^Un vehículo dúmper\b/i
};

type SourceFamily = { readonly name: string; readonly key: string };

const sourceFamily = (record: ProductRecord): SourceFamily | null => {
  const source = resolveGomarizEditorialFamily(record);
  const name = source && families[source.section]?.[source.key];
  return name && source ? { name, key: source.key } : null;
};

const measurement = sourceEditorialMeasurement;

const sourceIsCoherent = (record: ProductRecord, general: string, family: string): boolean => {
  const motor = record.specs?.Motor;
  if (motor !== undefined && typeof motor !== "string") return false;
  const title = record.title ?? "";
  if (motor === "Eléctrico" && /\bdi[eé]sel\b/i.test(`${title} ${general}`)) return false;
  if (motor === "Diésel" && /\bel[eé]ctric[oa]s?\b/i.test(`${title} ${general}`)) return false;
  if (motor === undefined && /\b(?:di[eé]sel|el[eé]ctric[oa]s?)\b/i.test(general)) return false;
  if (family === "elevador-mastil-vertical" && /\b(?:carretillas?|almacenaje)\b/i.test(general)) return false;
  return true;
};

const sourcedDieselScissorModels: Readonly<Record<string, readonly string[]>> = {
  GENIE: ["GS4390RT", "GS-3384 RT", "GS-5390"],
  SNORKEL: ["S3970RT"],
  HAULOTTE: ["COMPACT 10DX"],
  LGMG: ["SR1018D", "SR1623D", "SR1218D"]
};

const dieselScissorSource = "Las Tijeras Diésel destacan por tener una cesta de gran dimensión, cuya plataforma es extensible. Además, cuenta con estabilizadores para obtener una mayor seguridad en trabajos de gran altura y superficies con pendiente. Disponibles con altura de 10m a 28m";

const dieselScissorFeatures = (record: ProductRecord, family: string, original: string): string | null => {
  if (record.providerId !== "gomariz" || family !== "elevador-tijera" ||
    record.condition !== "Segunda mano" || record.specs?.Motor !== "Diésel" ||
    original !== dieselScissorSource ||
    !record.brand || !record.model || !record.title ||
    !sourcedDieselScissorModels[record.brand.toLocaleUpperCase("es")]?.includes(record.model)) return null;
  const slug = (value: string): string => value.toLocaleLowerCase("es")
    .normalize("NFD").replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  if (!slug(record.title).includes(slug(record.brand)) ||
    !slug(record.title).includes(slug(record.model))) return null;
  try {
    const url = new URL(record.url);
    const path = url.pathname.split("/").filter(Boolean);
    const prefix = `${slug(record.brand)}-${slug(record.model)}`;
    if (url.protocol !== "https:" || url.hostname !== "www.gomarizrent.com" ||
      url.search || url.hash || path.length !== 4 || path[0] !== "venta" ||
      path[2] !== "elevador-tijera" ||
      !(path[3] === prefix || path[3]?.startsWith(`${prefix}-`))) return null;
  } catch {
    return null;
  }
  return "El proveedor menciona plataformas extensibles y estabilizadores en la descripción de esta familia de tijeras diésel; su presencia debe verificarse para cada unidad.";
};

const sourcedScissorModels: Readonly<Record<string, readonly string[]>> = {
  LGMG: [
    "S0607E-2", "S0812II", "AS0812", "S0607EII-LI", "S1413EII", "S0808E II",
    "AS1012E", "AS1212", "AS0808E", "S0607EII", "AS0607WE"
  ],
  JLG: ["R2646", "R4045", "1930ES"],
  HAULOTTE: ["Compact 8"],
  GENIE: ["GS2632"]
};

export const sourcedGomarizScissorFeatures = (record: ProductRecord, family: string, original: string): string | null => {
  const diesel = dieselScissorFeatures(record, family, original);
  if (diesel !== null) return diesel;
  if (family !== "elevador-tijera" || record.condition !== "Segunda mano" ||
    !record.brand || !record.model ||
    !sourcedScissorModels[record.brand.toLocaleUpperCase("es")]?.includes(record.model) ||
    original !== "Las Tijeras Eléctricas están diseñadas para trabajar en interior, alcanzan una altura desde los 5m a los 26,5m. Se caracterizan por llevas ruedas anti-huellas y plataforma extensible, lo que permite ampliar la zona de trabajo.") return null;
  const motor = record.specs?.Motor;
  if (motor !== "Eléctrico" && !(motor === undefined && record.brand === "LGMG" && record.model === "AS0607WE")) return null;
  const url = new URL(record.url);
  const slug = url.pathname.split("/").filter(Boolean)[3];
  const prefix = `${record.brand.toLocaleLowerCase("es")}-${record.model.toLocaleLowerCase("es").replace(/[^\p{L}\p{N}]+/gu, "-")}`;
  if (url.search || url.hash ||
    !(slug === prefix || slug?.startsWith(`${prefix}-`)) ||
    slug?.includes("brazo-articulado") ||
    (motor === undefined && !slug?.includes("tijera-electrica"))) return null;
  return "El proveedor también describe las tijeras eléctricas de esta categoría como equipos para trabajar en interiores, con ruedas antihuellas y plataforma extensible.";
};

const joinPhrases = (phrases: readonly string[]): string => {
  if (phrases.length === 1) return phrases[0] ?? "";
  return `${phrases.slice(0, -1).join(", ")} y ${phrases[phrases.length - 1]}`;
};

export const resolveGomarizGeneralDescription = (record: ProductRecord): string | null => {
  const family = sourceFamily(record);
  const title = record.title?.trim();
  const brand = record.brand?.trim();
  const model = record.model?.trim();
  const general = record.longDescription?.trim();
  if (!family || !record.reference?.trim() || !title || !brand || !model || !general ||
    !title.toLocaleLowerCase("es").includes(brand.toLocaleLowerCase("es")) ||
    !title.toLocaleLowerCase("es").includes(model.toLocaleLowerCase("es")) ||
    general.toLocaleLowerCase("es").includes(model.toLocaleLowerCase("es")) ||
    !genericGeneralPatterns[family.key]?.test(general) ||
    !sourceIsCoherent(record, general, family.key) ||
    invalidGomarizPlatformHeight(record.url, record.specs ?? {})) return null;

  const specs = record.specs ?? {};
  const workingHeight = measurement(specs["Altura de trabajo"], "m");
  const platformHeight = measurement(specs["Altura plataforma"], "m");
  const storedHeight = measurement(specs["Altura almacenaje"], "m");
  const coherentStoredHeight = storedHeight && (!workingHeight ||
    Number(storedHeight.replace(",", ".")) <= Number(workingHeight.replace(",", "."))) ? storedHeight : null;
  const capacity = measurement(specs.Capacidad, "kg");
  const length = measurement(specs.Longitud, "m");
  const width = measurement(specs.Anchura, "m");
  const weight = measurement(specs.Peso, "kg");
  const lateralReach = measurement(specs["Alcance lateral"], "m");
  if ((specs["Altura de trabajo"] !== undefined && !workingHeight) ||
    (specs["Altura plataforma"] !== undefined && !platformHeight) ||
    (specs.Capacidad !== undefined && !capacity)) return null;
  if (!workingHeight && !capacity) return null;
  if (![platformHeight, length, width, weight].some(Boolean)) return null;
  if ([workingHeight, platformHeight, capacity, length, width, weight].filter(Boolean).length < 3) return null;

  const facts = [
    workingHeight ? `una altura de trabajo de ${workingHeight} m` : null,
    capacity ? `una capacidad de ${capacity} kg` : null
  ].filter((item): item is string => item !== null);
  const details = [
    platformHeight ? `una altura de plataforma de ${platformHeight} m` : null,
    coherentStoredHeight ? `una altura de almacenaje de ${coherentStoredHeight} m` : null,
    lateralReach ? `un alcance lateral de ${lateralReach} m` : null,
    length ? `una longitud de ${length} m` : null,
    width ? `una anchura de ${width} m` : null,
    weight ? `un peso de ${weight} kg` : null
  ].filter((item): item is string => item !== null);
  const motor = specs.Motor;
  const energy = motor === "Eléctrico" ? " motorización eléctrica" : motor === "Diésel" ? " motorización diésel" : null;
  const year = record.year && /^(?:19|20)\d{2}$/.test(record.year) ? `, año ${record.year},` : "";
  const first = `${family.name} ${title}${year}`;
  const sourcedFeatures = sourcedGomarizScissorFeatures(record, family.key, general);
  return `${first}${energy ? " cuenta con" + energy + "." : "."} Su ficha técnica indica ${joinPhrases(facts)}. ` +
    `También constan ${joinPhrases(details)}.` + (sourcedFeatures ? ` ${sourcedFeatures}` : "");
};
