import type { ProductRecord, SpecValue } from "../../../../contracts/catalog.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";
import { verifiedEditorialUnitPair, resolvedEditorialUnitFamilies } from "./editorial-unit-provenance.js";
import { editorialFamilyName, editorialFamilyOf } from "./editorial-families.js";
import type { EditorialFamily } from "./editorial-families.js";
import { resolveEditorialFacts } from "./editorial-facts.js";
import { formatEditorialQuantity } from "./editorial-measurements.js";
import { resolveAssertedBatteryVoltage } from "./editorial-battery-claims.js";
import { hasUnconditionalEditorialClaim } from "./editorial-claim-evidence.js";
import { resolveSourcedApplications } from "./editorial-sourced-applications.js";

type EditorialSourceClaim = Readonly<{
  key: string;
  declaration: RegExp;
  mention: RegExp;
  statement: string;
}>;

const claims: readonly EditorialSourceClaim[] = [
  {
    key: "Frenado regenerativo",
    declaration: /\b(?:frenado|frenos?)\s+regenerativ[oa]s?\b/giu,
    mention: /\b(?:frenado|frenos?)\s+regenerativ[oa]s?\b/iu,
    statement: "La descripción de origen declara frenado regenerativo."
  },
  {
    key: "Frenado automático",
    declaration: /\bfrenado\s+autom[aá]tico\b/giu,
    mention: /\bfren(?:ado|os?)\s+autom[aá]tic[oa]s?\b/iu,
    statement: "La descripción de origen declara frenado automático."
  },
  {
    key: "Controles proporcionales",
    declaration: /\b(?:controles?|mandos?)\s+proporcionales?\b/giu,
    mention: /\b(?:controles?|mandos?)\s+proporcionales?\b/iu,
    statement: "La descripción de origen declara mandos proporcionales."
  },
  {
    key: "Dirección asistida",
    declaration: /\b(?:direcci[oó]n\s+asistida|servodirecci[oó]n)\b/giu,
    mention: /\b(?:direcci[oó]n\s+asistida|servodirecci[oó]n)\b/iu,
    statement: "La descripción de origen declara dirección asistida."
  },
  {
    key: "Detección de obstáculos",
    declaration: /\b(?:detecci[oó]n|sensores?)\s+de\s+obst[aá]culos\b/giu,
    mention: /\b(?:detecci[oó]n|sensores?)\s+de\s+obst[aá]culos\b/iu,
    statement: "La descripción de origen declara detección de obstáculos."
  },
  {
    key: "Control de estabilidad",
    declaration: /\bcontrol\s+de\s+estabilidad\b/giu,
    mention: /\bcontrol\s+de\s+estabilidad\b/iu,
    statement: "La descripción de origen declara control de estabilidad."
  },
  {
    key: "Control de tracción TCS",
    declaration: /\b(?:sistema\s+de\s+)?control\s+de\s+tracci[oó]n\s+TCS\b/giu,
    mention: /\b(?:control\s+de\s+tracci[oó]n\s+TCS|tracci[oó]n\s+TCS)\b/iu,
    statement: "La descripción de origen declara control de tracción TCS."
  },
  {
    key: "Sistema antivuelco ACS",
    declaration: /\bsistema\s+antivuelco\s+ACS\b/giu,
    mention: /\b(?:sistema\s+antivuelco|antivuelco\s+ACS)\b/iu,
    statement: "La descripción de origen declara sistema antivuelco ACS."
  },
  {
    key: "Parada de emergencia",
    declaration: /\b(?:parada|paro)\s+de\s+emergencia\b/giu,
    mention: /\b(?:parada|paro)\s+de\s+emergencia\b/iu,
    statement: "La descripción de origen declara parada de emergencia."
  }
];

type EditorialSourceFeature = Readonly<{
  families: readonly EditorialFamily[];
  declaration: RegExp;
  mention: RegExp;
  label: string;
}>;

const platformFamilies: readonly EditorialFamily[] = ["plataforma-tijera", "plataforma-oruga"];
const cleaningFamilies: readonly EditorialFamily[] = ["barredora", "fregadora", "maquina-limpieza"];
const elevatedPlatforms: readonly EditorialFamily[] = [
  "plataforma-tijera", "plataforma-articulada", "plataforma-telescopica", "plataforma-oruga"
];
const allTerrainLifting: readonly EditorialFamily[] = [
  "plataforma-tijera", "plataforma-articulada", "plataforma-telescopica", "manipulador-telescopico"
];

const sourceFeatures: readonly EditorialSourceFeature[] = [
  {
    families: allTerrainLifting,
    declaration: /\btracci[oó]n\s+(?:(?:total|integral)\s+)?(?:(?:en|a)\s+las\s+)?(?:cuatro\s+ruedas|4\s*[x×]\s*4)\b/giu,
    mention: /\b(?:tracci[oó]n\s+(?:(?:total|integral)\s+)?(?:(?:en|a)\s+las\s+)?(?:cuatro\s+ruedas|4\s*[x×]\s*4)|tracci[oó]n\s+integral)\b/iu,
    label: "tracción a las cuatro ruedas"
  },
  {
    families: elevatedPlatforms,
    declaration: /\bnivelaci[oó]n\s+autom[aá]tica\b/giu,
    mention: /\bnivelaci[oó]n\s+autom[aá]tica\b/iu,
    label: "nivelación automática"
  },
  {
    families: elevatedPlatforms,
    declaration: /\bdescenso\s+manual\b(?!\s+de\s+emergencia)/giu,
    mention: /\bdescenso\s+manual\b/iu,
    label: "descenso manual"
  },
  {
    families: elevatedPlatforms,
    declaration: /\bdescenso\s+(?:manual\s+de\s+emergencia|de\s+emergencia)\b/giu,
    mention: /\bdescenso\s+(?:manual\s+de\s+emergencia|de\s+emergencia)\b/iu,
    label: "descenso de emergencia"
  },
  {
    families: elevatedPlatforms,
    declaration: /\bprotecci[oó]n\s+contra\s+(?:la\s+)?sobrecarga\b/giu,
    mention: /\bprotecci[oó]n\s+contra\s+(?:la\s+)?sobrecarga\b/iu,
    label: "protección contra sobrecarga"
  },
  {
    families: platformFamilies,
    declaration: /\b(?:plataforma(?:s)?\s+(?:de\s+trabajo\s+)?(?:extensible|ampliable)|extensi[oó]n\s+de\s+(?:la\s+)?plataforma)\b/giu,
    mention: /\b(?:plataforma(?:s)?\s+(?:de\s+trabajo\s+)?(?:extensible|ampliable)|extensi[oó]n\s+de\s+(?:la\s+)?plataforma)\b/iu,
    label: "plataforma extensible"
  },
  {
    families: platformFamilies,
    declaration: /\b(?:estabilizadores?|patas\s+estabilizadoras?|apoyos\s+estabilizadores?)\b/giu,
    mention: /\b(?:estabilizadores?|patas\s+estabilizadoras?|apoyos\s+estabilizadores?)\b/iu,
    label: "estabilizadores"
  },
  {
    families: ["plataforma-tijera", "plataforma-mastil"],
    declaration: /\b(?:ruedas?\s+anti[- ]?huellas?|neum[aá]ticos?\s+no\s+marcantes?)\b/giu,
    mention: /\b(?:ruedas?\s+anti[- ]?huellas?|neum[aá]ticos?\s+no\s+marcantes?)\b/iu,
    label: "ruedas antihuellas"
  },
  {
    families: cleaningFamilies,
    declaration: /\b(?:sistema\s+de\s+)?control\s+de\s+polvo\b/giu,
    mention: /\bcontrol\s+de\s+polvo\b/iu,
    label: "control de polvo"
  },
  {
    families: cleaningFamilies,
    declaration: /\b(?:filtraci[oó]n|filtro)\s+HEPA\b/giu,
    mention: /\b(?:filtraci[oó]n|filtro)\s+HEPA\b/iu,
    label: "filtración HEPA"
  },
  {
    families: cleaningFamilies,
    declaration: /\b(?:operari[oa]|conductor|conducci[oó]n)\s+sentad[oa]\b/giu,
    mention: /\b(?:operari[oa]|conductor|conducci[oó]n)\s+sentad[oa]\b/iu,
    label: "conducción con operario sentado"
  },
  {
    families: ["carretilla-elevadora", "carretilla-retractil"],
    declaration: /\b(?:desplazamiento\s+lateral(?:\s+de\s+horquillas)?|side[- ]?shift)\b/giu,
    mention: /\b(?:desplazamiento\s+lateral|side[- ]?shift)\b/iu,
    label: "desplazamiento lateral"
  },
  {
    families: ["carretilla-elevadora", "carretilla-retractil", "transpaleta", "apilador", "recogepedidos"],
    declaration: /\b(?:frenos?|frenado)\s+electromagn[eé]tic[oa]s?\b/giu,
    mention: /\b(?:frenos?|frenado)\s+electromagn[eé]tic[oa]s?\b/iu,
    label: "freno electromagnético"
  },
  {
    families: ["carretilla-elevadora", "carretilla-retractil"],
    declaration: /\bcabina\s+cerrada\b/giu,
    mention: /\bcabina\s+cerrada\b/iu,
    label: "cabina cerrada"
  },
  {
    families: ["carretilla-elevadora", "carretilla-retractil"],
    declaration: /\bcintur[oó]n\s+de\s+seguridad\b/giu,
    mention: /\bcintur[oó]n\s+de\s+seguridad\b/iu,
    label: "cinturón de seguridad"
  }
];

const assertedSpec = (value: SpecValue | undefined): boolean => value === true;

const join = (values: readonly string[]): string => values.length === 1 ? values[0] ?? "" :
  values.length === 2 ? `${values[0]} y ${values[1]}` :
    `${values.slice(0, -1).join(", ")} y ${values[values.length - 1]}`;

const sourceDeclaredGeneral = (source: ProductRecord, prepared: ProductRecord): string | null => {
  if (source.longDescription?.trim() || prepared.longDescription?.trim()) return null;
  if (!source.brand || !source.model || !verifiedEditorialIdentity(prepared)) return null;
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (!families) return null;
  const [family, preparedFamily] = families;
  if (!family || family !== preparedFamily ||
    editorialFamilyOf(source.title ?? "") !== family ||
    editorialFamilyOf(prepared.title ?? "") !== family) return null;
  const declarations = claims.filter((claim) => assertedSpec(source.specs?.[claim.key]) &&
    assertedSpec(prepared.specs?.[claim.key])).map((claim) =>
    `${claim.key[0]?.toLocaleLowerCase("es") ?? ""}${claim.key.slice(1)}`);
  if (declarations.length === 0) return null;
  return `La ficha de origen de ${editorialFamilyName(family)} ${source.brand} ${source.model} declara ${join(declarations)}; su configuración debe comprobarse para esta unidad.`;
};

const sourcedFamilyFeatures = (source: ProductRecord, prepared: ProductRecord, general: string): string | null => {
  const original = resolveEditorialFacts(source);
  const reconciled = resolveEditorialFacts(prepared);
  if (!original || !reconciled || original.family !== reconciled.family) return null;
  const description = source.longDescription ?? "";
  const features = sourceFeatures.filter((feature) =>
    feature.families.includes(original.family) && !feature.mention.test(general) &&
    hasUnconditionalEditorialClaim(description, feature.declaration)
  ).map((feature) => feature.label);
  if (features.length === 0) return null;
  const labels = features.length === 1 ? features[0] :
    `${features.slice(0, -1).join(", ")} y ${features[features.length - 1]}`;
  return `El proveedor menciona ${labels} en su descripción; su presencia y configuración deben comprobarse para esta unidad.`;
};

const sourcedForkliftMeasures = (
  source: ProductRecord, prepared: ProductRecord, general: string
): readonly string[] => {
  if (!["Centro de carga", "Radio de giro"].some((key) =>
    source.specs?.[key] !== undefined && source.specs[key] === prepared.specs?.[key])) return [];
  const original = resolveEditorialFacts(source);
  const reconciled = resolveEditorialFacts(prepared);
  if (!original || !reconciled || original.family !== reconciled.family ||
    !["carretilla-elevadora", "carretilla-retractil"].includes(original.family)) return [];
  const supported = (key: "Centro de carga" | "Radio de giro"): boolean =>
    source.specs?.[key] !== undefined && source.specs[key] === prepared.specs?.[key];
  const additions: string[] = [];
  if (supported("Centro de carga") && original.loadCenterMm !== null &&
    original.loadCenterMm === reconciled.loadCenterMm &&
    !/\bcentro\s+(?:de\s+)?(?:carga|gravedad)\b/iu.test(general)) {
    additions.push(`El centro de carga declarado en la ficha técnica es de ${formatEditorialQuantity(original.loadCenterMm)} mm, referencia para interpretar la capacidad nominal de elevación.`);
  }
  if (supported("Radio de giro") && original.turningRadiusM !== null &&
    original.turningRadiusM === reconciled.turningRadiusM &&
    !/\bradio\s+(?:(?:m[ií]nimo|exterior)\s+)?(?:de\s+)?(?:giro|viraje)\b/iu.test(general)) {
    additions.push(`El radio de giro indicado por el proveedor es de ${formatEditorialQuantity(original.turningRadiusM * 1000)} mm, dato útil para comprobar el espacio disponible para maniobrar.`);
  }
  return additions;
};

const compactWorkFamilies: readonly EditorialFamily[] = [
  "apilador", "transpaleta", "carretilla-elevadora", "carretilla-retractil", "recogepedidos", "tractor-arrastre",
  "plataforma-oruga", "cargadora", "barredora"
];

type SourcedHandlingApplication = Readonly<{
  declaration: RegExp;
  mention: RegExp;
  statement: string;
}>;

const handlingApplications: readonly SourcedHandlingApplication[] = [
  {
    declaration: /\b(?:higiene\s+(?:rigurosa|especial|estricta)|m[aá]xima\s+higiene|industria\s+alimentaria|manipulaci[oó]n\s+de\s+(?:carne|pescado|medicamentos))\b/giu,
    mention: /\b(?:higiene|industria\s+alimentaria)\b/iu,
    statement: "La fuente recomienda usos en actividades con exigencias de higiene, como la manipulación de productos alimentarios o sensibles; corresponde verificar la adecuación del equipo al entorno concreto."
  },
  {
    declaration: /\b(?:tim[oó]n\s+ergon[oó]mico|dise[nñ]o\s+(?:c[oó]modo\s+y\s+)?ergon[oó]mico|ergonom[ií]a\s+y\s+seguridad)\b/giu,
    mention: /\b(?:ergonom[ií]a|ergon[oó]mic[oa])\b/iu,
    statement: "La descripción del fabricante se refiere a la ergonomía en el manejo del equipo y a las condiciones de trabajo del operario; deben contrastarse los mandos y su configuración real."
  },
  {
    declaration: /\b(?:pesaje\s+en\s+[aá]reas|c[eé]lulas?\s+de\s+peso|funciones?\s+de\s+pesado)\b/giu,
    mention: /\b(?:pesaje|c[eé]lulas?\s+de\s+peso)\b/iu,
    statement: "El proveedor describe su aplicación en el pesaje de mercancías durante las operaciones de almacén o recepción, con elementos de lectura cuyo alcance debe contrastarse en la unidad anunciada."
  },
  {
    declaration: /\b(?:inclinaci[oó]n\s+de\s+hasta\s+90\s*[º°]|horquillas\s+se\s+pueden\s+inclinar\s+90\s*[º°])/giu,
    mention: /\b(?:inclinaci[oó]n\s+de\s+hasta\s+90|inclinar\s+90)\b/iu,
    statement: "El anuncio documenta una función de inclinación de hasta 90° para facilitar la manipulación de cajas o contenedores; debe comprobarse su operación en la configuración ofrecida."
  },
  {
    declaration: /\bbater[ií]as?\s+de\s+litio\b/giu,
    mention: /\bbater[ií]as?\s+de\s+litio\b/iu,
    statement: "El texto del fabricante describe una solución con batería de litio y sus operaciones de recarga; los tiempos de autonomía y la batería concreta requieren comprobación por unidad."
  },
  {
    declaration: /\breducci[oó]n\s+de\s+ruido\b/giu,
    mention: /\b(?:reducci[oó]n\s+de\s+ruido|funcionamiento\s+silencioso)\b/iu,
    statement: "El proveedor destaca la reducción de ruido para desplazamientos en tiendas y espacios compartidos; su idoneidad acústica debe comprobarse en las condiciones reales de utilización."
  },
  {
    declaration: /\bcentralizaci[oó]n\s+de\s+todos\s+los\s+mandos\b/giu,
    mention: /\b(?:centralizaci[oó]n\s+de\s+(?:todos\s+los\s+)?mandos|mandos\s+centralizados)\b/iu,
    statement: "La descripción cita la centralización de mandos como recurso de operación y seguridad; no se presupone que otras variantes dispongan de idéntico diseño de controles."
  },
  {
    declaration: /\balmacenes,?\s+talleres\b/giu,
    mention: /\b(?:almacenes\s+y\s+talleres|entornos\s+de\s+almac[eé]n\s+y\s+taller)\b/iu,
    statement: "El proveedor identifica almacenes y talleres entre los ámbitos de utilización de la transpaleta, sin que esa aplicación sustituya la comprobación de su capacidad y dimensiones."
  }
];

const documentedHandlingApplications = (
  source: ProductRecord, prepared: ProductRecord, general: string
): string | null => {
  const original = resolveEditorialFacts(source);
  const reconciled = resolveEditorialFacts(prepared);
  if (original?.family !== "transpaleta" || reconciled?.family !== original.family) return null;
  const description = source.longDescription ?? "";
  const additions = handlingApplications.filter((application) =>
    !application.mention.test(general) &&
    hasUnconditionalEditorialClaim(description, application.declaration)
  ).map((application) => application.statement);
  return additions.length ? additions.join(" ") : null;
};

const documentedFamilyContext = (
  source: ProductRecord, prepared: ProductRecord, general: string
): string | null => {
  const original = resolveEditorialFacts(source);
  const reconciled = resolveEditorialFacts(prepared);
  if (!original || !reconciled || original.family !== reconciled.family) {
    return null;
  }
  const description = source.longDescription ?? "";
  if (compactWorkFamilies.includes(original.family) &&
    !/\bno\b[^.!?;\n]{0,130}\b(?:espacios?|lugares)\b/iu.test(description) &&
    !/\b(?:espacios?\s+(?:(?:de\s+)?trabajo\s+)?(?:reducidos?|estrechos?|limitados?)|lugares\s+de\s+trabajo\s+ajustados)\b/iu.test(general) &&
    hasUnconditionalEditorialClaim(description,
      /\b(?:espacios?\s+(?:(?:de\s+)?trabajo\s+)?(?:reducidos?|estrechos?|limitados?)|lugares\s+de\s+trabajo\s+ajustados)\b/giu)) {
    return "El proveedor menciona el trabajo en espacios reducidos como ámbito de aplicación; corresponde contrastar las dimensiones y maniobras con la configuración concreta de la unidad.";
  }
  if (original.family === "compactadora" &&
    hasUnconditionalEditorialClaim(description, /\bcompactaci[oó]n\s+(?:eficiente\s+|efectiva\s+|de\s+)?(?:de\s+)?contenedores\b/giu)) {
    return "El anuncio identifica la compactación de contenedores como aplicación; las condiciones de trabajo deben contrastarse con el equipo concreto.";
  }
  if (original.family === "almacen-vertical" &&
    !/\bdise[nñ]o\s+modular\b/iu.test(general) &&
    hasUnconditionalEditorialClaim(description, /\bdise[nñ]o\s+modular\b/giu) &&
    hasUnconditionalEditorialClaim(description, /\bgesti[oó]n\s+de\s+inventario\b/giu)) {
    return "El anuncio describe un diseño modular destinado a la gestión del inventario; la configuración específica de bandejas debe comprobarse en cada instalación.";
  }
  if (original.family === "manipulador-telescopico" &&
    !/\b(?:posibles?\s+aplicaciones|aplicaciones\s+(?:posibles|opcionales)|puede\s+(?:emplearse|utilizarse)|podr[ií]a\s+(?:emplearse|utilizarse))\b/iu.test(description) &&
    !/\bconstrucci[oó]n\b/iu.test(general) &&
    hasUnconditionalEditorialClaim(description, /\bconstrucci[oó]n\b/giu) &&
    hasUnconditionalEditorialClaim(description, /\bagricultura\b/giu)) {
    return "El proveedor cita la construcción y la agricultura como ámbitos de aplicación; esto no acredita implementos instalados ni capacidades adicionales.";
  }
  return null;
};

export const resolveSourceEditorialClaims = (
  source: ProductRecord,
  prepared: ProductRecord,
  general: string | null
): string | null => {
  if (!verifiedEditorialIdentity(source) || !verifiedEditorialUnitPair(source, prepared)) return general;
  if (!general?.trim()) return sourceDeclaredGeneral(source, prepared);
  const description = source.longDescription ?? "";
  const additions = claims.filter((claim) => {
    if (claim.mention.test(general)) return false;
    const original = source.specs?.[claim.key];
    const reconciled = prepared.specs?.[claim.key];
    if (original !== undefined && !assertedSpec(original) || reconciled !== undefined && !assertedSpec(reconciled)) return false;
    return hasUnconditionalEditorialClaim(description, claim.declaration);
  }).map((claim) => claim.statement);
  const battery = resolveAssertedBatteryVoltage(source, prepared, general);
  if (battery !== null) additions.push(battery);
  additions.push(...sourcedForkliftMeasures(source, prepared, general));
  const features = sourcedFamilyFeatures(source, prepared, general);
  if (features !== null) additions.push(features);
  const contextual = documentedFamilyContext(source, prepared, general);
  if (contextual !== null) additions.push(contextual);
  const applications = documentedHandlingApplications(source, prepared, general);
  if (applications !== null) additions.push(applications);
  const sourcedApplications = resolveSourcedApplications(source, prepared, general);
  if (sourcedApplications !== null) additions.push(sourcedApplications);
  if (additions.length === 0) return general;
  const text = general.trim();
  return `${text}${/[.!?]$/u.test(text) ? "" : "."} ${additions.join(" ")}`;
};
