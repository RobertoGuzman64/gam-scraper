import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialQuantity } from "../../measurements/editorial-measurements.js";
import { sameEditorialUnit, verifiedEditorialIdentity } from "../../core/editorial-source-contract.js";
import { editorialFamilyFromSourceGeneral, editorialFamilyOf } from "../../core/editorial-families.js";
import { hasUnconditionalEditorialClaim } from "../../claims/editorial-claim-evidence.js";

const sourceFamilyApplication = (source: ProductRecord, general: string, description: string): string | null => {
  const family = editorialFamilyFromSourceGeneral(description);
  const explicit = editorialFamilyOf(source.title ?? "");
  if (explicit && explicit !== family) return null;
  if (family === "plataforma-tijera" &&
    /\bplataforma\s+de\s+tijera\s+el[eé]ctrica\b/iu.test(general) &&
    !/\bno\s+(?:est[aá]n\s+)?dise[nñ]adas\s+para\s+trabajar\s+en\s+interior\b/iu.test(description) &&
    !/\b(?:interiores|antihuellas)\b/iu.test(general) &&
    hasUnconditionalEditorialClaim(description, /\b(?:trabajar|trabajos?)\s+en\s+interior\b/giu) &&
    hasUnconditionalEditorialClaim(description, /\bru[eé]das?\s+anti[- ]?huellas?\b/giu) &&
    hasUnconditionalEditorialClaim(description, /\bplataforma\s+extensible\b/giu)) {
    return "El proveedor sitúa esta familia en trabajos de interior y menciona ruedas antihuellas y plataforma extensible. Su presencia en el equipo anunciado debe comprobarse por unidad.";
  }
  if (family === "plataforma-tijera" &&
    /\bplataforma\s+de\s+tijera\s+di[eé]sel\b/iu.test(general) &&
    !/\b(?:estabilizadores|pendiente)\b/iu.test(general) &&
    hasUnconditionalEditorialClaim(description, /\bplataforma\s+(?:es\s+)?extensible\b/giu) &&
    hasUnconditionalEditorialClaim(description, /\bestabilizadores\b/giu)) {
    return "El texto de familia menciona una plataforma extensible y estabilizadores para el trabajo en altura, también sobre superficies con pendiente. Son características generales que deben contrastarse con el equipamiento concreto de la unidad.";
  }
  if (family === "plataforma-articulada" &&
    /\bplataforma\s+articulada\s+di[eé]sel\b/iu.test(general) &&
    !/\b(?:trabajos?\s+(?:en\s+)?exterior|terrenos?)\b/iu.test(general) &&
    hasUnconditionalEditorialClaim(description, /\btrabajos?\s+en\s+exterior\b/giu) &&
    hasUnconditionalEditorialClaim(description, /\b(?:terrenos?|pendientes?)\b/giu)) {
    return "El proveedor describe esta familia para trabajos exteriores y desplazamientos sobre terrenos de distinta regularidad. La pendiente admisible y la aptitud de desplazamiento requieren comprobar las especificaciones de esta unidad.";
  }
  if (family === "manipulador-telescopico" &&
    /\bmanipulador\s+telesc[oó]pico\b/iu.test(general) &&
    !/\bbrazo\s+telesc[oó]pico\b/iu.test(general) &&
    hasUnconditionalEditorialClaim(description, /\bcarretilla\s+elevadora\b/giu) &&
    hasUnconditionalEditorialClaim(description, /\bbrazo\s+telesc[oó]pico\b/giu)) {
    return "La fuente presenta estos manipuladores como máquinas que combinan desplazamiento y elevación de materiales mediante brazo telescópico. Las capacidades e implementos específicos deben comprobarse en la unidad ofertada.";
  }
  if (family === "plataforma-mastil" &&
    /\bm[aá]stil\s+vertical\b/iu.test(general) &&
    !/\b(?:espacios\s+reducidos|interiores)\b/iu.test(general) &&
    hasUnconditionalEditorialClaim(description, /\bespacios\s+reducidos\b/giu) &&
    hasUnconditionalEditorialClaim(description, /\btrabajos?\s+de\s+interior\b/giu)) {
    return "La descripción de familia identifica el acceso en interiores y espacios reducidos como aplicación. La anchura de paso, el alcance y la capacidad deben contrastarse con la ficha de esta unidad.";
  }
  return null;
};

export const resolveSourcedFamilyContext = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  if (!authenticatedOrigin || !general?.trim() || !source.longDescription?.trim() ||
    source.shortDescription?.trim() || !verifiedEditorialIdentity(source) ||
    !verifiedEditorialIdentity(prepared) ||
    !sameEditorialUnit(source, prepared)) return null;
  const description = source.longDescription;
  if (/\b(?:almacenaje|trabajo\s+en\s+interiores?|trabajos\s+de\s+interior)\b/iu.test(general) === false &&
    /\b(?:almacenaje|almacenamiento)\b/iu.test(description) &&
    /\b(?:interior\s+de\s+los\s+edificios|trabajos\s+(?:realizados\s+)?en\s+el\s+interior)\b/iu.test(description) &&
    /\bpropulsi[oó]n\s+el[eé]ctrica\b/iu.test(description) &&
    /^el[eé]ctric[oa]$/iu.test(String(source.specs?.Motor ?? "")) &&
    source.specs?.Motor === prepared.specs?.Motor &&
    /\bcarretilla\s+elevadora\s+el[eé]ctrica\b/iu.test(general)) {
    return `${general.trim()} El proveedor describe el almacenamiento y el trabajo en el interior de edificios como ámbitos de uso de esta clase de carretillas eléctricas. La adecuación depende de las dimensiones y condiciones de cada unidad.`;
  }
  const originalPower = source.specs?.Potencia;
  if (/\b(?:grupo\s+electr[oó]geno|generador)\b/iu.test(general) &&
    !/\b(?:sin\s+suministro|red\s+el[eé]ctrica)\b/iu.test(general) &&
    /\bgrupos?\s+electr[oó]genos?\b/iu.test(description) &&
    /\b(?:donde\s+no\s+hay\s+suministro\s+regular|sin\s+suministro\s+regular)\b/iu.test(description) &&
    originalPower !== undefined && originalPower === prepared.specs?.Potencia &&
    editorialQuantity(originalPower, "kVA") !== null) {
    return `${general.trim()} El proveedor presenta los grupos electrógenos como una alternativa de suministro eléctrico para lugares sin abastecimiento regular de la red. La configuración concreta de fases e insonorización debe verificarse en cada equipo.`;
  }
  const familyContext = sourceFamilyApplication(source, general, description);
  return familyContext === null ? null : `${general.trim()} ${familyContext}`;
};
