import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { isGamUnitUrl } from "../../../catalog/normalization/gam/unit-url.js";
import { fold } from "../../classification/category-utils.js";
import { resolveEditorialSource } from "../../editorial/core/editorial-source.js";
import { resolvedEditorialUnitFamilies } from "../../editorial/identity/editorial-unit-provenance.js";
import { containsEditorialBrandModel } from "../../editorial/identity/editorial-identity-match.js";
import { containsEditorialSourceSlugModel } from "../../editorial/source/editorial-source-url.js";
import { hasUnconditionalEditorialClaim } from "../../editorial/claims/editorial-claim-evidence.js";
import type { TechnicalRecoveryObservation } from "../../provenance/technical-recovery-observation.js";

const aboard = /\b(?:conductor|operari[oa]|operador|hombre) (?:sentado|a bordo)\b|\boperacion a bordo\b/u;
const walking = /\b(?:conductor|operari[oa]|operador) (?:acompanante|a pie)\b|\bhombre a pie\b|\bwalk.behind\b/u;

export const driver = (description: string): string | null => {
  const text = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b(?:robot|robotica|autonom[oa])\b/u.test(text) && /\b(?:fregadora|barredora|aspiradora)\b/u.test(text)) return null;
  const onBoard = aboard.test(text);
  const onFoot = walking.test(text);
  if (onBoard === onFoot) return null;
  return onBoard ? "Hombre a bordo" : "Hombre a pie";
};

const positionKey = /(?:conductor|conduccion|posicion.*(?:operario|operador)|(?:operario|operador).*posicion|plataforma.*(?:operario|operador)|puesto.*(?:operario|operador))/u;
const positionClaim = /\b(?:maquina(?: de limpieza(?: industrial)?)?|fregadora(?: industrial)?|barredora) (?:de )?(?:conductor|operari[oa]|operador) (?:sentado|acompanante|a pie|a bordo)\b|\b(?:operacion a bordo|diseno (?:compacto y |ergonomico )?de (?:conductor|operador) sentado)\b/gu;
const positionMention = /\b(?:conductor|operari[oa]|operador|hombre) (?:sentado|acompanante|a pie|a bordo)\b|\boperacion a bordo\b/gu;

export const recoverSourceCleaningConfiguration = (
  original: ProductRecord, recovered: ProductRecord, specs: SpecsMap, observe?: TechnicalRecoveryObservation
): SpecsMap => {
  const text = original.longDescription;
  if (!text || text !== recovered.longDescription || original.condition !== "Nuevo" ||
    original.serialNumber || original.horometer || original.year ||
    !(original.providerId === "mercaeleva" || original.providerId === "gam" && isGamUnitUrl(original))) return specs;
  const identity = resolveEditorialSource(original);
  const families = resolvedEditorialUnitFamilies(original, recovered);
  if (!identity || !families || families[0] !== families[1] ||
    (families[0] !== "fregadora" && families[0] !== "barredora") ||
    !containsEditorialSourceSlugModel(new URL(original.url).pathname.split("/").filter(Boolean).at(-1) ?? "", identity.model, original.specs?.Motor) ||
    !containsEditorialBrandModel(text.replace(/\ba bater[ií]a\b/giu, "batería"), identity.brand, identity.model) ||
    [...Object.keys(original.specs ?? {}), ...Object.keys(specs)].some((key) => positionKey.test(fold(key)))) return specs;
  const all = fold(`${original.title ?? ""}. ${original.shortDescription ?? ""}. ${text}`);
  const description = fold(text);
  const value = driver(description);
  if (!value || driver(all) !== value || !hasUnconditionalEditorialClaim(description, positionClaim) ||
    /\b(?:robot|robotica|autonom[oa]|sin conductor|sin operario|sin operador|conductor opcional|operador opcional|puesto opcional|(?:conductor|operario|operador) (?:sentado|a pie|a bordo|acompanante) (?:opcional|segun|como opcion)|(?:comparacion|comparado|comparada) con)\b/u.test(all) ||
    [...all.matchAll(positionMention)].some((match) => {
      const prefix = all.slice(Math.max(0, (match.index ?? 0) - 80), match.index).split(/[.!?;\n]/u).at(-1) ?? "";
      return /\b(?:no|sin|opcion|opcional|alternativ[oa]|segun)\b/u.test(prefix);
    })) return specs;
  const result = { ...specs, "Tipo de conductor": value };
  observe?.(specs, result, "src/preparation/technical/recovery/cleaning-family-specifications.ts", "longDescription");
  return result;
};
