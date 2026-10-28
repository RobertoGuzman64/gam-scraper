import type { ProductRecord, SpecValue } from "../../contracts/catalog.js";
import { buildProductIdentity } from "../identity.js";
import { issueCode } from "../preparation/offline-diagnostics.js";
import type { OfflinePreparation } from "../preparation/offline-document.js";

export type SourceSignal =
  | "especificacion_explicita"
  | "campo_origen_no_validado"
  | "mencion_textual"
  | "sin_evidencia_local"
  | "equivalencia_pendiente"
  | "contradiccion"
  | "identidad";

export type SourceTriageGroup = {
  readonly issueCode: string;
  readonly categoryKey: string;
  readonly categoryName: string;
  readonly signal: SourceSignal;
  readonly affected: number;
  readonly only: number;
  readonly examples: readonly string[];
};

const hasText = (value: string | null | undefined): boolean => Boolean(value?.trim());
const normalized = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("es")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const readable = (value: SpecValue): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return value.map((item) => String(item).trim()).filter(Boolean).join(" | ");
};

const containsLabel = (text: string | null | undefined, label: string): boolean =>
  hasText(text) && (` ${normalized(text ?? "")} `).includes(` ${normalized(label)} `);

export const sourceSignalForIssue = (issue: string, record: ProductRecord): SourceSignal => {
  if (issue.startsWith("Número de serie ") || issue.startsWith("Referencia duplicada ") ||
    issue === "Identidad GAM contradictoria entre título, resumen y ficha técnica") return "identidad";
  if (issue === "Descripción comercial contradictoria: altura de trabajo") return "contradiccion";
  if (issue.startsWith("Condición comercial contradictoria") || issue.startsWith("Atributo contradictorio: ")) return "contradiccion";
  if (issue.startsWith("Atributo rechazado por seguridad: ") || issue.startsWith("Atributo no normalizable: ")) return "campo_origen_no_validado";
  if (issue === "Tipo de máquina de origen sin confirmar") return "sin_evidencia_local";
  if (issue.startsWith("Categoría Equipzilla")) return "equivalencia_pendiente";
  if (issue.startsWith("Atributo obligatorio ausente: ")) {
    const label = issue.slice("Atributo obligatorio ausente: ".length);
    if (Object.entries(record.specs ?? {}).some(([key, value]) => normalized(key) === normalized(label) && readable(value).length > 0)) {
      return "especificacion_explicita";
    }
    if (label === "Marca" && hasText(record.brand)) return "campo_origen_no_validado";
    if (label === "Modelo" && hasText(record.model)) return "campo_origen_no_validado";
    if (containsLabel(record.shortDescription, label) || containsLabel(record.longDescription, label)) return "mencion_textual";
    return "sin_evidencia_local";
  }
  if (issue.startsWith("Precio ")) {
    return hasText(record.price) || hasText(record.priceText) ? "campo_origen_no_validado" : "sin_evidencia_local";
  }
  if (issue.startsWith("Descripción corta ausente")) {
    return hasText(record.shortDescription) || hasText(record.shortDescriptionHtml)
      ? "campo_origen_no_validado" : "sin_evidencia_local";
  }
  if (issue.startsWith("Descripción ausente")) {
    return hasText(record.shortDescription) || hasText(record.longDescription) ||
      hasText(record.shortDescriptionHtml) || hasText(record.longDescriptionHtml)
      ? "campo_origen_no_validado" : "sin_evidencia_local";
  }
  if (issue.startsWith("Imágenes ")) {
    return hasText(record.image) || (record.images ?? []).some(hasText)
      ? "campo_origen_no_validado" : "sin_evidencia_local";
  }
  if (issue === "Referencia ausente") return hasText(record.reference) ? "campo_origen_no_validado" : "sin_evidencia_local";
  if (issue === "Título ausente") return hasText(record.title) ? "campo_origen_no_validado" : "sin_evidencia_local";
  if (issue.startsWith("Condición comercial")) return record.condition ? "campo_origen_no_validado" : "sin_evidencia_local";
  return "sin_evidencia_local";
};

export const buildSourceTriage = (preparation: OfflinePreparation, sourceProducts: readonly ProductRecord[]): readonly SourceTriageGroup[] => {
  if (sourceProducts.length !== preparation.products.length) {
    throw new Error("Diagnóstico: catálogo y preparación con diferentes cantidades");
  }
  const sourceByIdentity = new Map<string, ProductRecord>();
  for (const record of sourceProducts) {
    const identity = buildProductIdentity(record).key;
    if (sourceByIdentity.has(identity)) throw new Error("Diagnóstico: identidad duplicada en el catálogo de origen");
    sourceByIdentity.set(identity, record);
  }
  if (preparation.identities.some((identity) => !sourceByIdentity.has(identity))) {
    throw new Error("Diagnóstico: identidad de preparación ausente del catálogo de origen");
  }
  const groups = new Map<string, { issueCode: string; categoryKey: string; categoryName: string; signal: SourceSignal; affected: number; only: number; examples: string[] }>();
  for (const [index, entry] of preparation.products.entries()) {
    if (entry.status === "ready") continue;
    const source = sourceByIdentity.get(preparation.identities[index] ?? "");
    if (!source) throw new Error("Diagnóstico: no se encuentra el origen de la referencia");
    const reasons = [...new Set(entry.issues)];
    const seen = new Set<string>();
    for (const reason of reasons) {
      const code = issueCode(reason);
      if (seen.has(code)) continue;
      seen.add(code);
      const signal = sourceSignalForIssue(reason, source);
      const key = JSON.stringify([code, source.categoryKey, signal]);
      const group = groups.get(key) ?? {
        issueCode: code, categoryKey: source.categoryKey, categoryName: source.categoryName,
        signal, affected: 0, only: 0, examples: []
      };
      group.affected += 1;
      if (reasons.length === 1) group.only += 1;
      if (group.examples.length < 3) group.examples.push(entry.product.reference ?? entry.product.sourceUrl);
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) => b.affected - a.affected ||
    a.issueCode.localeCompare(b.issueCode, "es") || a.categoryKey.localeCompare(b.categoryKey, "es") ||
    a.signal.localeCompare(b.signal, "es"));
};
