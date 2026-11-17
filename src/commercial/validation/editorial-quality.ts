import type { ImportCandidate } from "../legacy-export/contracts.js";

export type CommercialEditorialSignal =
  "unidad-mm-sin-espacio" | "promocion-proveedor-en-resumen" |
  "descripcion-general-posiblemente-truncada" | "listado-origen-incompleto" |
  "unidad-potencia-no-estandar" | "marcadores-origen-residuales" | "descripcion-origen-en-mayusculas" |
  "descriptor-mastil-duplicado";

export type CommercialEditorialIssue = {
  readonly reason: CommercialEditorialSignal;
  readonly severity: "blocking" | "review";
};

type EditorialContent = Pick<ImportCandidate, "title" | "description" | "description_general">;

const withoutTrailingSentence = (value: string): boolean =>
  value.length >= 150 && /\p{L}$/u.test(value) && !/[.!?…]$/u.test(value);

const isSourceUppercase = (value: string): boolean => {
  if (!/^Ref\.\s+\S+\s+/u.test(value)) return false;
  const letters = [...value].filter((character) => /\p{L}/u.test(character));
  return letters.length >= 30 &&
    letters.filter((character) => character === character.toLocaleUpperCase("es")).length / letters.length >= 0.8;
};

const omitAttributedSourceMillimeters = (general: string): string =>
  general.replace(/«\d+(?:[.,]\d+)?mm»/giu, (citation, position: number) => {
    const preceding = general.slice(Math.max(0, position - 90), position);
    const following = general.slice(position + citation.length, position + citation.length + 35);
    return /\b(?:anuncio|origen|proveedor)\b/iu.test(preceding) ||
      /\b(?:anuncio|origen|proveedor)\b/iu.test(following) ? "" : citation;
  });

export const inspectCommercialEditorialQuality = (product: EditorialContent): readonly CommercialEditorialIssue[] => {
  const title = product.title ?? "";
  const summary = product.description ?? "";
  const general = product.description_general ?? "";
  const result: CommercialEditorialIssue[] = [];
  const add = (reason: CommercialEditorialSignal, severity: CommercialEditorialIssue["severity"]): void => {
    result.push({ reason, severity });
  };
  if ([title, summary, omitAttributedSourceMillimeters(general)].some((value) =>
    /(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?mm(?![\p{L}\p{N}])/iu.test(value))) {
    add("unidad-mm-sin-espacio", "blocking");
  }
  if (/\b(tríplex|dúplex)\s+\1\b/iu.test(summary)) add("descriptor-mastil-duplicado", "blocking");
  if (/\bGAM Online\b|\bSomos distribuidores oficiales de\b/iu.test(summary)) {
    add("promocion-proveedor-en-resumen", "blocking");
  }
  if (withoutTrailingSentence(general)) add("descripcion-general-posiblemente-truncada", "review");
  if (general.trimEnd().endsWith(":") && (general.match(/:/gu) ?? []).length >= 4) {
    add("listado-origen-incompleto", "review");
  }
  if (/\b\d+(?:[.,]\d+)?\s*kWA\b/iu.test(summary)) add("unidad-potencia-no-estandar", "review");
  if (/\?\s+Vehículo en|✔️/iu.test(general)) add("marcadores-origen-residuales", "review");
  if (isSourceUppercase(general)) add("descripcion-origen-en-mayusculas", "review");
  return result;
};
