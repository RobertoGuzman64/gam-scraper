import type { ProductRecord } from "../contracts/catalog.js";
import type { ImportCandidate } from "../commercial/legacy-export/contracts.js";
import type { OfflinePreparation } from "../preparation/offline-document.js";
import type { CampaignAccreditation } from "../catalog/editorial/campaign-accreditation.js";

export type FinishAbsentReference = {
  readonly reference: string;
  readonly classification: "ausente_origen" | "review" | "exclusion_acreditada" | "variante_posible" | "no_seleccionado" | "comparacion_imposible";
  readonly reason: string;
};

const key = (value: string | null | undefined): string | null =>
  value?.trim() ? value.trim().toLowerCase() : null;

export const classifyFinishAbsences = (
  previous: readonly ImportCandidate[], original: readonly ProductRecord[] | null,
  preparation: OfflinePreparation | null, selected: readonly ImportCandidate[] | null,
  accreditation: CampaignAccreditation | null
): readonly FinishAbsentReference[] => {
  const sourceByReference = new Map(original?.flatMap((product) => {
    const reference = key(product.reference);
    return reference ? [[reference, product] as const] : [];
  }) ?? []);
  const preparedByReference = new Map(preparation?.products.flatMap((entry) => {
    const reference = key(entry.product.reference);
    return reference ? [[reference, entry] as const] : [];
  }) ?? []);
  const selectedReferences = new Set(selected?.flatMap((product) => {
    const reference = key(product.reference);
    return reference ? [reference] : [];
  }) ?? []);
  const decisions = new Map(accreditation?.exclusions.map((item) => [key(item.reference), item] as const) ?? []);
  const found: FinishAbsentReference[] = [];
  for (const product of previous) {
    const reference = key(product.reference);
    if (!reference) {
      found.push({ reference: product.sourceUrl, classification: "comparacion_imposible",
        reason: "Publicación previa sin referencia; requiere cotejo de identidad" });
      continue;
    }
    if (selectedReferences.has(reference)) continue;
    const prepared = preparedByReference.get(reference);
    const source = sourceByReference.get(reference);
    if (selected && prepared) {
      const decision = decisions.get(reference);
      if (decision?.decision === "excluir" && decision.sourceUrl === prepared.product.sourceUrl) {
        found.push({ reference: product.reference ?? reference, classification: "exclusion_acreditada",
          reason: "Exclusión coincidente en la acreditación validada; comprobar motivo y evidencia" });
        continue;
      }
    }
    if (prepared?.status === "review") {
      found.push({ reference: product.reference ?? reference, classification: "review",
        reason: "Presente en la preparación, pero requiere revisión" });
      continue;
    }
    if (selected && prepared) {
      found.push({ reference: product.reference ?? reference, classification: "no_seleccionado",
        reason: "Presente en preparación pero ausente de la selección; investigar sin aceptar la baja" });
      continue;
    }
    if (prepared || source) {
      if (selected === null) continue;
      found.push({ reference: product.reference ?? reference, classification: "no_seleccionado",
        reason: "Presente en origen; discrepancia entre origen, preparación y selección" });
      continue;
    }
    if (!original) {
      found.push({ reference: product.reference ?? reference, classification: "comparacion_imposible",
        reason: "Original vigente no verificable" });
      continue;
    }
    const candidateByUrl = original.some((item) => item.url === product.sourceUrl) ||
      (preparation?.products.some((entry) => entry.product.sourceUrl === product.sourceUrl) ?? false);
    found.push({ reference: product.reference ?? reference,
      classification: candidateByUrl ? "variante_posible" : "ausente_origen",
      reason: candidateByUrl
        ? "URL conservada con referencia distinta; variante pendiente de identificación"
        : "La referencia no está en el original vigente; ausencia no equivale a baja acreditada" });
  }
  return found;
};
