import { issueCode } from "../../catalog/import/preparation/offline-diagnostics.js";
import type { PreparedProduct } from "../../catalog/import/preparation/contracts.js";

const issueSignature = (issues: readonly string[]): string =>
  [...new Set(issues.map(issueCode))].sort((a, b) => a.localeCompare(b, "es")).join(" + ");

export function* formatDetailedValidation(products: readonly PreparedProduct[]): Generator<string> {
  const reviewed = products.filter((entry) => entry.status === "review");
  const signatures = new Map<string, { total: number; references: string[] }>();
  for (const entry of reviewed) {
    const signature = issueSignature(entry.issues) || "sin motivos registrados";
    const group = signatures.get(signature) ?? { total: 0, references: [] };
    group.total += 1;
    if (group.references.length < 3) group.references.push(entry.product.reference?.trim() || entry.product.sourceUrl);
    signatures.set(signature, group);
  }

  yield `  AUDIT DE REVIEW | ${reviewed.length}/${products.length} fichas en revisión | ${signatures.size} combinaciones de motivos | solo lectura`;
  if (reviewed.length === 0) {
    yield "  No hay fichas en review.";
    return;
  }
  yield "  Patrones de bloqueos simultáneos (códigos diagnósticos; no indican causa demostrada):";
  for (const [signature, group] of [...signatures].sort(([a, x], [b, y]) => y.total - x.total || a.localeCompare(b, "es"))) {
    yield `    ${group.total} fichas | ${signature} | refs: ${group.references.join(", ")}`;
  }

  yield "  Máquinas en review (referencia y motivos exactos):";
  for (const entry of reviewed) {
    const product = entry.product;
    const reference = product.reference?.trim() || product.sourceUrl;
    yield `    ${product.providerId.toUpperCase()} | ${reference} | ${entry.issues.length} ${entry.issues.length === 1 ? "motivo" : "motivos"}`;
    if (entry.issues.length === 0) {
      yield "      - Sin motivos registrados: revisar la coherencia del diagnóstico";
    }
    for (const issue of entry.issues) {
      yield `      - [${issueCode(issue)}] ${issue}`;
    }
  }
}
