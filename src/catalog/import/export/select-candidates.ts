import type { ImportCandidate, ImportCatalog } from "../preparation/contracts.js";
import type { PreparationDocument } from "../preparation/preparation-document.js";
import { validateCreateManyCandidate, validateImportCandidate } from "../preparation/import-validation.js";
import { validText, referenceKey } from "./reference-inventory.js";
import type { ReferenceInventory } from "./reference-inventory.js";

export type ImportIssue = { readonly reference: string | null; readonly sourceUrl: string; readonly reason: string };

export type CandidateSelection = {
  readonly selected: readonly ImportCandidate[];
  readonly existing: readonly ImportIssue[];
  readonly review: readonly ImportIssue[];
  readonly duplicates: readonly ImportIssue[];
};

const sourceUrlKey = (value: string): string | null => {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
};

export const selectImportCandidates = (
  document: PreparationDocument, providerId: string, inventory: ReferenceInventory,
  catalog: ImportCatalog, receiver: "excel" | "createMany"
): CandidateSelection => {
  const counts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  for (const entry of document.products) {
    const source = sourceUrlKey(entry.product.sourceUrl);
    if (source) sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    const reference = entry.product.reference;
    if (validText(reference)) {
      const key = referenceKey(reference);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const existing: ImportIssue[] = [];
  const review: ImportIssue[] = [];
  const duplicates: ImportIssue[] = [];
  const selected: ImportCandidate[] = [];
  for (const entry of document.products) {
    const product = entry.product;
    if (product.providerId !== providerId) throw new Error("El lote mezcla proveedores");
    const reference = product.reference;
    const issue = { reference, sourceUrl: product.sourceUrl };
    const repeatedReference = validText(reference) && (counts.get(referenceKey(reference)) ?? 0) > 1;
    const source = sourceUrlKey(product.sourceUrl);
    const repeatedSource = source !== null && (sourceCounts.get(source) ?? 0) > 1;
    if (repeatedReference) {
      duplicates.push({ ...issue, reason: [
        "Referencia duplicada en la extracción",
        ...(repeatedSource ? ["URL de origen duplicada en la extracción"] : [])
      ].join("; ") });
      continue;
    }
    const previousIssues = receiver === "createMany"
      ? entry.issues.filter((reason) => reason !== "Precio no disponible o inválido")
      : entry.issues;
    const receiverIssues = receiver === "createMany"
      ? validateCreateManyCandidate(product, catalog)
      : validateImportCandidate(product, catalog);
    const reasons = [...new Set([
      ...previousIssues, ...receiverIssues,
      ...(repeatedSource ? ["URL de origen duplicada en la extracción"] : []),
      ...(source === null ? ["URL de origen inválida"] : [])
    ])];
    if (reasons.length > 0 || (entry.status === "review" && entry.issues.length === 0)) {
      review.push({ ...issue, reason: reasons.join("; ") || "Requiere revisión" });
      continue;
    }
    if (reference && inventory.references.has(referenceKey(reference))) {
      existing.push({ ...issue, reason: "La referencia ya está en el inventario de la empresa; no se actualiza" });
      continue;
    }
    selected.push(product);
  }
  return { selected, existing, review, duplicates };
};
