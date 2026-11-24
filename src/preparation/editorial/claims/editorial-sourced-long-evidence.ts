import type { ProductRecord } from "../../../contracts/catalog.js";
import type { EditorialFamily } from "../core/editorial-families.js";
import { hasUnconditionalEditorialClaim } from "./editorial-claim-evidence.js";
import { verifiedEditorialIdentity } from "../core/editorial-source-contract.js";
import { verifiedEditorialUnitPair, resolvedEditorialUnitFamilies } from "../identity/editorial-unit-provenance.js";

type DocumentedFeature = Readonly<{
  families: readonly EditorialFamily[];
  declaration: RegExp;
  additional: readonly RegExp[];
  mention: RegExp;
  text: string;
}>;

const features: readonly DocumentedFeature[] = [
  {
    families: ["barredora"],
    declaration: /\b(?:7[., ]?440\s*m[²2]\s*(?:por\s*hora|\/h)|7[., ]?440\s*m[²2]\s*\/\s*h)\b/giu,
    additional: [/\bcepillo\s+principal\s+de\s+680\s*mm\b/giu, /\bcepillo\s+lateral\s+de\s+520\s*mm\b/giu],
    mention: /\b7[., ]?440\b/iu,
    text: "La descripción del fabricante indica una cobertura de hasta 7.440 m² por hora y especifica cepillos principal de 680 mm y lateral de 520 mm. Estas cifras son prestaciones de catálogo, sujetas a la configuración y las condiciones de uso."
  },
  {
    families: ["grupo-electrogeno"],
    declaration: /\bcarrocer[ií]a\s+(?:es\s+)?insonora\b/giu,
    additional: [/\bsoportes?\s+antivibraci[oó]n\b/giu, /\bpaneles?\s+modulares?\b/giu],
    mention: /\b(?:insonora|antivibraci[oó]n)\b/iu,
    text: "El proveedor describe una carrocería insonora formada por paneles modulares y una bancada con soportes antivibración. La composición de la carrocería corresponde a la descripción del producto y debe contrastarse al comprobar la unidad suministrada."
  },
  {
    families: ["carretilla-retractil"],
    declaration: /\bmodo\s+de\s+rendimiento\s+ECO-eLo\b/giu,
    additional: [],
    mention: /\bECO-eLo\b/iu,
    text: "El fabricante menciona el modo de rendimiento ECO-eLo para gestionar el consumo energético en operaciones prolongadas. Su disponibilidad, configuración y efecto sobre el consumo han de comprobarse para la máquina ofertada."
  },
  {
    families: ["apilador"],
    declaration: /\bacero\s+resistente\s+al\s+[aá]cido\s+AISI\s*316L\b/giu,
    additional: [/\bchasis\s+de\s+las\s+horquillas\b/giu],
    mention: /\bAISI\s*316L\b/iu,
    text: "La fuente documenta acero AISI 316L para el chasis de las horquillas, dentro de una propuesta orientada a actividades que exigen higiene. El material y la configuración deben confirmarse en la unidad anunciada."
  }
];

export const resolveSourcedLongEvidence = (
  source: ProductRecord, prepared: ProductRecord, general: string | null
): string | null => {
  const description = source.longDescription?.trim();
  if (!description || !general?.trim() || description.split(/\s+/u).length < 60 ||
    general.trim().split(/\s+/u).length >= 60 ||
    !verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared) ||
    !verifiedEditorialUnitPair(source, prepared)) return null;
  const family = resolvedEditorialUnitFamilies(source, prepared);
  const currentFamily = family?.[0];
  if (!currentFamily || currentFamily !== family?.[1]) return null;
  const additions = features.filter((feature) =>
    feature.families.includes(currentFamily) && !feature.mention.test(general) &&
    hasUnconditionalEditorialClaim(description, feature.declaration) &&
    feature.additional.every((pattern) => hasUnconditionalEditorialClaim(description, pattern))
  ).map((feature) => feature.text);
  return additions.length ? `${general.trim()} ${additions.join(" ")}` : null;
};
