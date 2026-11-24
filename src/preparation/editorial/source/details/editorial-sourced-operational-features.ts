import type { ProductRecord } from "../../../../contracts/catalog.js";
import { hasUnconditionalEditorialClaim } from "../../claims/editorial-claim-evidence.js";
import { editorialFamilyOf } from "../../core/editorial-families.js";
import { verifiedEditorialIdentity } from "../../core/editorial-source-contract.js";
import { resolvedEditorialUnitFamilies, verifiedEditorialUnitPair } from "../../identity/editorial-unit-provenance.js";

type DocumentedFeature = Readonly<{
  name: string;
  declaration: RegExp;
  alreadyPresent: RegExp;
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
  { name: "sistema de baja velocidad", declaration: /\bsistema\s+de\s+baja\s+velocidad\b/giu, alreadyPresent: /\bsistema\s+de\s+baja\s+velocidad\b/iu }
];

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
  const documented = features.filter(({ declaration, alreadyPresent }) =>
    !alreadyPresent.test(current) && hasUnconditionalEditorialClaim(original, declaration));
  if (documented.length === 0 || documented.length === 1 &&
    ["sistema hidráulico", "sistema de estabilidad", "dirección eléctrica"].includes(documented[0]?.name ?? "")) return null;
  const named = documented.slice(0, 3).map(({ name }) => name);
  const detail = named.length === 1 ? named[0] : named.length === 2 ? named.join(" y ") :
    `${named[0]}, ${named[1]} y ${named[2]}`;
  return `${current} La descripción del proveedor menciona ${detail} para este modelo. Son características documentadas en el anuncio, cuya disponibilidad y configuración deben comprobarse en la unidad ofrecida.`;
};
