import { join } from "node:path";
import { editorialSourceDigest } from "../../infrastructure/filesystem/editorial/knowledge.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { EditorialUnitKnowledge } from "../../preparation/shared/editorial/domain/editorial-knowledge.js";
import { artifact, digest, isMissing, isRecord, isSha, recordFrom, regularText } from "./evidence-files.js";
import type { PanelArtifact } from "./types.js";

export type PanelUnitKnowledgeEvidence = {
  readonly artifact: PanelArtifact;
  readonly entries: ReadonlyMap<string, readonly EditorialUnitKnowledge[]>;
};

const isUnit = (value: unknown): value is EditorialUnitKnowledge =>
  isRecord(value) && typeof value.key === "string" && typeof value.sourceUrl === "string" &&
  typeof value.brand === "string" && typeof value.model === "string" && isSha(value.sourceDigest) &&
  (value.short === null || typeof value.short === "string") &&
  (value.general === null || typeof value.general === "string") &&
  (value.title === null || typeof value.title === "string") &&
  typeof value.priority === "number" && Number.isFinite(value.priority) &&
  (value.usage === undefined || value.usage === "fallback") &&
  (value.identityOverride === undefined || typeof value.identityOverride === "boolean");

export const readPanelUnitKnowledge = async (root: string): Promise<PanelUnitKnowledgeEvidence | null> => {
  const path = join(root, "data", "editorial", "knowledge", "verified-units.json");
  let raw: string;
  try { raw = await regularText(path); }
  catch (error) { if (isMissing(error)) return null; throw error; }
  const decoded = recordFrom(raw, path);
  if (decoded.version !== 1 || !Array.isArray(decoded.entries) || !decoded.entries.every(isUnit)) {
    throw new Error("Índice de conocimiento editorial incompatible con el panel");
  }
  const entries = new Map<string, EditorialUnitKnowledge[]>();
  for (const entry of decoded.entries) {
    const group = entries.get(entry.key) ?? [];
    group.push(entry);
    entries.set(entry.key, group);
  }
  return { artifact: artifact(root, path, digest(raw)), entries };
};

const fold = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").trim().toLocaleLowerCase("es");

export const matchingPanelUnitKnowledge = (
  record: ProductRecord, knowledge: PanelUnitKnowledgeEvidence | null,
  field: "title" | "short" | "general", value: string
): readonly EditorialUnitKnowledge[] => {
  if (!knowledge || !record.reference?.trim()) return [];
  const key = `${record.providerId}:${record.reference}`;
  const sourceDigest = editorialSourceDigest(record);
  return (knowledge.entries.get(key) ?? []).filter((entry) =>
    entry.sourceUrl === record.url && entry.sourceDigest === sourceDigest &&
    fold(entry.brand) === fold(record.brand ?? "") && fold(entry.model) === fold(record.model ?? "") &&
    entry[field] === value);
};
