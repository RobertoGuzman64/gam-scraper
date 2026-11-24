import type { ProductRecord } from "../../../../contracts/catalog.js";
import { hasUnconditionalEditorialClaim } from "../../claims/editorial-claim-evidence.js";
import { resolveEditorialFacts } from "../../core/editorial-facts.js";
import { editorialFamilyOf, type EditorialFamily } from "../../core/editorial-families.js";
import { verifiedEditorialIdentity } from "../../core/editorial-source-contract.js";
import { containsEditorialIdentity } from "../../identity/editorial-identity-match.js";
import { resolvedEditorialUnitFamilies, verifiedEditorialUnitPair } from "../../identity/editorial-unit-provenance.js";

type DocumentedFeature = Readonly<{
  name: string;
  declaration: RegExp;
  alreadyPresent: RegExp;
  requiresVerifiedEnergy?: true;
  requiresElectricEnergy?: true;
  requiresUnambiguousIdentity?: true;
  families?: readonly EditorialFamily[];
}>;

const features: readonly DocumentedFeature[] = [
  { name: "comunicación CANbus", declaration: /\bCANbus\b/giu, alreadyPresent: /\bCANbus\b/iu },
  { name: "motor eléctrico sin escobillas", declaration: /\bmotor\s+(?:el[eé]ctrico\s+)?(?:AC\s+)?(?:sin\s+escobillas|brushless)\b/giu, alreadyPresent: /\b(?:sin\s+escobillas|brushless)\b/iu },
  { name: "freno electromagnético", declaration: /\bfreno(?:\s+de\s+servicio)?\s+electromagn[eé]tico\b/giu, alreadyPresent: /\bfreno(?:\s+de\s+servicio)?\s+electromagn[eé]tico\b/iu },
  { name: "frenado regenerativo", declaration: /\bfrenad[oa]\s+regenerativ[oa]\b/giu, alreadyPresent: /\bfrenad[oa]\s+regenerativ[oa]\b/iu },
  { name: "dirección asistida", declaration: /\bdirecci[oó]n\s+asistida\b/giu, alreadyPresent: /\bdirecci[oó]n\s+asistida\b/iu },
  { name: "dirección eléctrica", declaration: /\bdirecci[oó]n\s+el[eé]ctrica\b/giu, alreadyPresent: /\bdirecci[oó]n\s+el[eé]ctrica\b/iu },
  { name: "control proporcional", declaration: /\bcontrol\s+proporcional\b/giu, alreadyPresent: /\bcontrol\s+proporcional\b/iu },
  { name: "sistema hidráulico", declaration: /\bsistema\s+hidr[aá]ulico\b/giu, alreadyPresent: /\bsistema\s+hidr[aá]ulico\b/iu },
  { name: "sistema de estabilidad", declaration: /\bsistema\s+de\s+estabilidad\b/giu, alreadyPresent: /\bsistema\s+de\s+estabilidad\b/iu },
  { name: "frenado antibloqueo ABS", declaration: /\bsistema\s+de\s+frenado\s+antibloqueo\s*\(ABS\)/giu, alreadyPresent: /\b(?:ABS|antibloqueo)\b/iu },
  { name: "válvula de alivio contra sobrecargas", declaration: /\bv[aá]lvula\s+de\s+alivio\s+contra\s+sobrecargas\b/giu, alreadyPresent: /\bv[aá]lvula\s+de\s+alivio\b/iu },
  { name: "interruptor de inversión de marcha", declaration: /\binterruptor\s+de\s+inversi[oó]n\s+de\s+marcha\b/giu, alreadyPresent: /\binversi[oó]n\s+de\s+marcha\b/iu },
  { name: "sistema de baja velocidad", declaration: /\bsistema\s+de\s+baja\s+velocidad\b/giu, alreadyPresent: /\bsistema\s+de\s+baja\s+velocidad\b/iu },
  { name: "freno automático", declaration: /\bfrenos?\s+autom[aá]ticos?\b/giu, alreadyPresent: /\b(?:frenos?|frenado)\s+autom[aá]ticos?\b/iu },
  { name: "alarma de inclinación", declaration: /\balarmas?\s+de\s+inclinaci[oó]n\b/giu, alreadyPresent: /\balarmas?\s+de\s+inclinaci[oó]n\b/iu },
  { name: "sistema de diagnóstico", declaration: /\bsistema\s+de\s+diagn[oó]stico\b/giu, alreadyPresent: /\bdiagn[oó]stico\b/iu },
  { name: "protección contra sobrecarga", declaration: /\bprotecci[oó]n\s+contra\s+sobrecargas?\b/giu, alreadyPresent: /\b(?:sobrecargas?|limitador\s+de\s+carga)\b/iu },
  { name: "frenos en baño de aceite", declaration: /\bfrenos?\s+en\s+baño\s+de\s+aceite\b/giu, alreadyPresent: /\b(?:baño\s+de\s+aceite|frenos?\s+h[uú]medos?)\b/iu, requiresVerifiedEnergy: true },
  { name: "motorización de corriente alterna", declaration: /\bmotor(?:es)?\s+(?:de\s+tracci[oó]n\s+)?(?:de\s+)?(?:corriente\s+alterna|CA|AC)\b/giu, alreadyPresent: /\b(?:corriente\s+alterna|motor(?:es)?\s+(?:de\s+tracci[oó]n\s+)?(?:de\s+)?(?:CA|AC)|sin\s+escobillas|brushless)\b/iu, requiresElectricEnergy: true },
  { name: "reducción de velocidad en curvas", declaration: /\bsistema\s+de\s+velocidad\s+reducida\s+en\s+las\s+curvas\b/giu, alreadyPresent: /\b(?:velocidad\s+reducida|reducci[oó]n\s+de\s+velocidad|reduce\s+la\s+velocidad)\b[^.!?;\n]{0,45}\bcurvas\b/iu },
  { name: "sistema de control de tracción", declaration: /\bsistema\s+de\s+control\s+de\s+tracci[oó]n\b/giu, alreadyPresent: /\bcontrol\s+de\s+(?:la\s+)?tracci[oó]n\b/iu },
  { name: "asiento regulable", declaration: /\basiento\s+(?:ajustable|regulable)\b/giu, alreadyPresent: /\basiento\b/iu, families: ["carretilla-elevadora", "carretilla-retractil"], requiresUnambiguousIdentity: true },
  { name: "cargador integrado", declaration: /\bcargador\s+(?:integrado|incorporado|a\s+bordo)\b/giu, alreadyPresent: /\bcargador\b/iu, families: ["carretilla-elevadora", "carretilla-retractil", "apilador", "transpaleta", "fregadora", "barredora"], requiresElectricEnergy: true }
];

const hasUnambiguousFeatureIdentity = (source: ProductRecord, original: string): boolean => {
  const brand = source.brand?.trim();
  const model = source.model?.trim();
  if (!brand || !model) return false;
  const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const models = new RegExp(`\\b${escapedBrand}\\s+([\\p{L}\\d./-]*\\d[\\p{L}\\d./-]*)`, "giu");
  return [...original.matchAll(models)].every((match) => Boolean(match[1]) && containsEditorialIdentity(model, match[1] ?? "")) &&
    [...original.matchAll(/\b(?:SWB|MWB|LWB)\b/giu)].every((match) => containsEditorialIdentity(model, match[0]));
};

export const resolveSourcedOperationalFeatures = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  const original = source.longDescription?.trim();
  const current = general?.trim();
  if (!authenticatedOrigin || !original || !current ||
    original.split(/\s+/u).length < 85 || original.split(/\s+/u).length > 700 ||
    current.split(/\s+/u).length < 55 || current.split(/\s+/u).length > 145 ||
    current.split(/\s+/u).length + 20 >= original.split(/\s+/u).length ||
    !verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared) ||
    !verifiedEditorialUnitPair(source, prepared) || !source.model ||
    !original.toLocaleLowerCase("es").includes(source.model.toLocaleLowerCase("es"))) return null;
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (!families || !families[0] || families[0] !== families[1]) return null;
  const sourceFamily = editorialFamilyOf(source.title ?? "");
  const preparedFamily = editorialFamilyOf(prepared.title ?? "");
  if (sourceFamily !== null && sourceFamily !== families[0] ||
    preparedFamily !== null && preparedFamily !== families[1]) return null;
  const documented = features.filter(({ declaration, alreadyPresent, requiresVerifiedEnergy, requiresElectricEnergy, requiresUnambiguousIdentity, families: allowedFamilies }) =>
    (!allowedFamilies || allowedFamilies.some((family) => family === families[0])) &&
    (!requiresUnambiguousIdentity || hasUnambiguousFeatureIdentity(source, original)) &&
    !alreadyPresent.test(current) && hasUnconditionalEditorialClaim(original, declaration) &&
    (!requiresVerifiedEnergy || Boolean(resolveEditorialFacts(source)?.energy) &&
      resolveEditorialFacts(source)?.energy === resolveEditorialFacts(prepared)?.energy) &&
    (!requiresElectricEnergy || resolveEditorialFacts(source)?.energy === "eléctrica" &&
      resolveEditorialFacts(prepared)?.energy === "eléctrica" && hasUnambiguousFeatureIdentity(source, original)));
  if (documented.length === 0 || documented.length === 1 &&
    ["sistema hidráulico", "sistema de estabilidad", "dirección eléctrica"].includes(documented[0]?.name ?? "")) return null;
  const named = documented.filter(({ name }) => name !== "motorización de corriente alterna" ||
    !documented.some((feature) => feature.name === "motor eléctrico sin escobillas")).slice(0, 3).map(({ name }) => name);
  const detail = named.length === 1 ? named[0] : named.length === 2 ? named.join(" y ") :
    `${named[0]}, ${named[1]} y ${named[2]}`;
  return `${current} En este modelo, conviene comprobar la disponibilidad y configuración de ${detail} en la unidad ofrecida.`;
};
