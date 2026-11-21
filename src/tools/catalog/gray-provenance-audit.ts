import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectTechnicalProvenanceCoverage } from "./technical-provenance-coverage.js";
import type { GrayProvenanceCase } from "./technical-provenance-coverage.js";
import type { GrayProvenanceBlocker } from "./gray-provenance-evaluation.js";

type GrayAuditGroup = {
  readonly providerId: GrayProvenanceCase["providerId"];
  readonly mechanism: string | null;
  readonly blocker: GrayProvenanceBlocker;
  readonly additions: number;
  readonly products: number;
  readonly documents: number;
};

type GrayAuditDocument = {
  readonly url: string;
  readonly additions: number;
  readonly products: number;
  readonly mechanisms: readonly string[];
};

export type GrayProvenanceAudit = {
  readonly version: 1;
  readonly mode: "historical-rehearsal";
  readonly classificationChanged: false;
  readonly totals: { readonly gray: number; readonly products: number;
    readonly identifiedReference: number; readonly noReference: number };
  readonly blockers: Readonly<Partial<Record<GrayProvenanceBlocker, number>>>;
  readonly groups: readonly GrayAuditGroup[];
  readonly documents: readonly GrayAuditDocument[];
  readonly cases: readonly GrayProvenanceCase[];
};

const uniqueIdentity = (item: GrayProvenanceCase): string =>
  JSON.stringify([item.providerId, item.reference, item.sourceUrl]);

const order = (first: { readonly additions: number }, second: { readonly additions: number }): number =>
  second.additions - first.additions;

export const summarizeGrayProvenance = (cases: readonly GrayProvenanceCase[]): GrayProvenanceAudit => {
  const groups = new Map<string, GrayProvenanceCase[]>();
  const documents = new Map<string, GrayProvenanceCase[]>();
  const blockers = new Map<GrayProvenanceBlocker, number>();
  const identities = new Set<string>();
  const keys = new Set<string>();
  for (const item of cases) {
    const identity = uniqueIdentity(item);
    const key = JSON.stringify([identity, item.field]);
    if (keys.has(key)) throw new Error(`Especificación gris duplicada: ${key}`);
    keys.add(key);
    identities.add(identity);
    blockers.set(item.blocker, (blockers.get(item.blocker) ?? 0) + 1);
    const group = JSON.stringify([item.providerId, item.mechanism, item.blocker]);
    groups.set(group, [...(groups.get(group) ?? []), item]);
    if (item.documentUrl) {
      documents.set(item.documentUrl, [...(documents.get(item.documentUrl) ?? []), item]);
    }
  }
  const grouped: GrayAuditGroup[] = [...groups.values()].map((entries) => {
    const head = entries[0];
    if (!head) throw new Error("Grupo de procedencia gris vacío");
    return { providerId: head.providerId, mechanism: head.mechanism, blocker: head.blocker,
      additions: entries.length, products: new Set(entries.map(uniqueIdentity)).size,
      documents: new Set(entries.map((entry) => entry.documentUrl).filter((url) => url !== null)).size };
  }).sort((first, second) => order(first, second) || first.providerId.localeCompare(second.providerId) ||
    (first.mechanism ?? "").localeCompare(second.mechanism ?? ""));
  const sourced: GrayAuditDocument[] = [...documents.entries()].map(([url, entries]) => ({
    url, additions: entries.length, products: new Set(entries.map(uniqueIdentity)).size,
    mechanisms: [...new Set(entries.map((entry) => entry.mechanism).filter((name) => name !== null))].sort()
  })).sort((first, second) => order(first, second) || first.url.localeCompare(second.url));
  return {
    version: 1, mode: "historical-rehearsal", classificationChanged: false,
    totals: { gray: cases.length, products: identities.size,
      identifiedReference: cases.filter((item) => item.documentUrl !== null).length,
      noReference: cases.filter((item) => item.documentUrl === null).length },
    blockers: Object.fromEntries([...blockers.entries()].sort(([a], [b]) => a.localeCompare(b))),
    groups: grouped, documents: sourced, cases
  };
};

const csvEscape = (value: string | number | null): string => {
  const string = value === null ? "" : String(value);
  return `"${string.replaceAll('"', '""')}"`;
};

export const grayProvenanceCsv = (cases: readonly GrayProvenanceCase[]): string => {
  const columns = ["providerId", "reference", "sourceUrl", "originalRecordSha256", "field", "value",
    "blocker", "scope", "mechanism", "documentUrl", "sourceField"] as const;
  const lines = [columns.join(",")];
  for (const item of cases) {
    lines.push(columns.map((column) => csvEscape(item[column])).join(","));
  }
  return `${lines.join("\n")}\n`;
};

export const runGrayProvenanceAudit = async (args: readonly string[]): Promise<void> => {
  if (args.length > 1 || args.length === 1 && args[0] !== "--json" && args[0] !== "--csv") {
    throw new Error("Uso: node dist/tools/catalog/gray-provenance-audit.js [--json|--csv]");
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const coverage = await inspectTechnicalProvenanceCoverage(root);
  const audit = summarizeGrayProvenance(coverage.grayCases);
  if (audit.totals.gray !== coverage.totals.classification.pending) {
    throw new Error("La auditoría no coincide con la clasificación histórica");
  }
  if (args[0] === "--json") {
    process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
    return;
  }
  if (args[0] === "--csv") {
    process.stdout.write(grayProvenanceCsv(audit.cases));
    return;
  }
  process.stdout.write(`GRISES | ${audit.totals.gray} incorporaciones en ${audit.totals.products} fichas | ${audit.totals.identifiedReference} referencias documentales | ${audit.totals.noReference} sin documento | 0 reclasificaciones sin prueba\n`);
  for (const [blocker, count] of Object.entries(audit.blockers)) {
    process.stdout.write(`  ${blocker} | ${count}\n`);
  }
  process.stdout.write(`Grupos de mecanismos: ${audit.groups.length} | Documentos: ${audit.documents.length} | CSV y JSON detallados disponibles. Referenciar un documento no equivale a acreditar su contenido, variante ni procedencia.\n`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runGrayProvenanceAudit(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`GRISES | ERROR | ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
