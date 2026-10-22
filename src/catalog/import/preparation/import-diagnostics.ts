import type { PreparedProduct } from "./contracts.js";

export type ImportReceiver = "excel" | "createMany";
export type ImportBlockClassification = "sin_valor_confirmado" | "asociado_calidad" | "contrato_destino";

export type ImportIssueDetail = {
  readonly code: string;
  readonly message: string;
  readonly classification: ImportBlockClassification;
  readonly affected: number;
  readonly only: number;
  readonly examples: readonly string[];
};

export type ReceiverDiagnostics = {
  readonly eligible: number;
  readonly blocked: number;
  readonly blockedByQuality: number;
  readonly blockedByContractOnly: number;
  readonly issues: readonly ImportIssueDetail[];
};

export type ImportDiagnostics = Readonly<Record<ImportReceiver, ReceiverDiagnostics>>;

export const importIssueCode = (issue: string): string => {
  if (issue.startsWith("Atributo obligatorio ausente: ")) return `required_attribute:${issue.slice("Atributo obligatorio ausente: ".length)}`;
  if (issue.startsWith("Atributo no asociado o duplicado: ")) return `attribute.unassociated:${issue.slice("Atributo no asociado o duplicado: ".length)}`;
  if (issue.startsWith("Atributo vacío: ")) return `attribute.empty:${issue.slice("Atributo vacío: ".length)}`;
  if (issue.startsWith("Atributo numérico inválido: ")) return `attribute.invalid_number:${issue.slice("Atributo numérico inválido: ".length)}`;
  if (issue.startsWith("Atributo booleano inválido: ")) return `attribute.invalid_boolean:${issue.slice("Atributo booleano inválido: ".length)}`;
  if (issue.startsWith("Atributo de texto inválido: ")) return `attribute.invalid_text:${issue.slice("Atributo de texto inválido: ".length)}`;
  if (issue.startsWith("Atributo sin equivalencia de normalización confirmada: ")) return `attribute.unsupported:${issue.slice("Atributo sin equivalencia de normalización confirmada: ".length)}`;
  if (issue === "Referencia ausente") return "reference.required";
  if (issue === "Título ausente") return "title.required";
  if (issue === "Condición incompatible o no confirmada para importación") return "condition.required";
  if (issue === "Categoría no coincide de forma única con el backend") return "category.excel";
  if (issue === "Categoría no válida para create/many") return "category.create_many";
  if (issue === "Precio ausente o inválido") return "price.required_or_invalid";
  if (issue === "Descripción ausente") return "description.required";
  if (issue.startsWith("Descripción corta ausente: ")) return "description.short_required";
  if (issue === "URL de imagen ausente o inválida") return "image.required_or_invalid";
  return `unclassified:${issue}`;
};

export const classifyImportIssue = (issue: string, qualityIssues: readonly string[]): ImportBlockClassification => {
  if (issue.startsWith("Atributo obligatorio ausente: ")) {
    const attribute = issue.slice("Atributo obligatorio ausente: ".length);
    return qualityIssues.some((quality) => [
      `Atributo contradictorio: ${attribute}`,
      `Atributo rechazado por seguridad: ${attribute}`,
      `Atributo no normalizable: ${attribute}`
    ].includes(quality)) ? "asociado_calidad" : "sin_valor_confirmado";
  }
  if (issue === "Referencia ausente" && qualityIssues.includes(issue)) return "asociado_calidad";
  if (issue.startsWith("Condición incompatible") && qualityIssues.some((quality) => quality.startsWith("Condición comercial"))) return "asociado_calidad";
  if (issue.startsWith("Categoría no ") && qualityIssues.some((quality) => quality.startsWith("Categoría Equipzilla"))) return "asociado_calidad";
  if (issue === "Precio ausente o inválido") {
    return qualityIssues.includes("Precio publicado inválido") ? "asociado_calidad" : "sin_valor_confirmado";
  }
  if (["Título ausente", "Descripción ausente", "URL de imagen ausente o inválida"].includes(issue) ||
    issue.startsWith("Descripción corta ausente: ")) return "sin_valor_confirmado";
  return "contrato_destino";
};

export const buildImportDiagnostics = (products: readonly PreparedProduct[]): ImportDiagnostics => {
  const buildReceiver = (receiver: ImportReceiver): ReceiverDiagnostics => {
    const groups = new Map<string, { code: string; message: string; classification: ImportBlockClassification; affected: number; only: number; examples: string[] }>();
    let eligible = 0;
    let blocked = 0;
    let blockedByQuality = 0;
    let blockedByContractOnly = 0;
    for (const entry of products) {
      const reasons = entry.importIssues?.[receiver];
      if (!reasons) throw new Error("La clasificación de importación requiere preparación actual con importIssues por receptor");
      if (entry.status === "ready" && reasons.length === 0) eligible += 1;
      else {
        blocked += 1;
        if (entry.status === "review") blockedByQuality += 1;
        else blockedByContractOnly += 1;
      }
      const distinct = [...new Set(reasons.map((reason) => importIssueCode(reason)))];
      for (const code of distinct) {
        const reason = reasons.find((item) => importIssueCode(item) === code)!;
        const classification = classifyImportIssue(reason, entry.issues);
        const key = JSON.stringify([code, classification]);
        const current = groups.get(key) ?? { code, message: reason, classification, affected: 0, only: 0, examples: [] };
        current.affected += 1;
        if (distinct.length === 1) current.only += 1;
        if (current.examples.length < 3) current.examples.push(entry.product.reference?.trim() || entry.product.sourceUrl);
        groups.set(key, current);
      }
    }
    const issues = [...groups.values()].sort((a, b) => b.affected - a.affected || a.code.localeCompare(b.code, "es") || a.classification.localeCompare(b.classification, "es"));
    return { eligible, blocked, blockedByQuality, blockedByContractOnly, issues };
  };
  return { excel: buildReceiver("excel"), createMany: buildReceiver("createMany") };
};
