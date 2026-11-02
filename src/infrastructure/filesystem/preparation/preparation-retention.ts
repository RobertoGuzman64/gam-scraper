import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readOfflinePreparation } from "./offline-preparation.js";
import { planRetentionSimulation, type RetentionSimulation, type RetentionVersion } from "../retention/simulation.js";

const suffixes = ["-preparation.manifest.json", "-preparation.json", "-diagnostics.json", "-comparison.json"] as const;
const validPrefix = /^[a-zA-Z0-9_-]+$/;
const referenceRoots = [
  "storage/runs", "storage/campaigns", "storage/interventions", "storage/providers",
  "catalogs/campaigns", "catalogs/providers"
] as const;
const textFile = /\.(json|jsonl|log|txt|csv)$/i;

type PreparedSet = {
  readonly id: string;
  readonly files: readonly string[];
  readonly path: string;
  readonly sourceHash: string | null;
  readonly version: RetentionVersion;
};

const absent = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const scanReferences = async (workspace: string, sets: readonly PreparedSet[]): Promise<{
  readonly referenced: ReadonlySet<string>;
  readonly issues: readonly string[];
}> => {
  const referenced = new Set<string>();
  const issues: string[] = [];
  const tokens = sets.flatMap((item) => [item.path, item.sourceHash, basename(item.path)]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => ({ id: item.id, value })));
  const visit = async (path: string): Promise<void> => {
    let entries;
    try { entries = await readdir(path, { withFileTypes: true }); }
    catch (error) {
      if (absent(error)) return;
      issues.push(`No se pudo inspeccionar ${path}`);
      return;
    }
    for (const entry of entries) {
      const item = join(path, entry.name);
      if (entry.isSymbolicLink()) {
        issues.push(`Referencia enlazada no inspeccionable: ${item}`);
        continue;
      }
      if (entry.isDirectory()) { await visit(item); continue; }
      if (!entry.isFile()) {
        issues.push(`Entrada no regular: ${item}`);
        continue;
      }
      if (!textFile.test(entry.name)) {
        issues.push(`Referencia de formato no analizado: ${item}`);
        continue;
      }
      try {
        const raw = await readFile(item, "utf8");
        for (const token of tokens) if (raw.includes(token.value)) referenced.add(token.id);
      } catch { issues.push(`Referencia ilegible: ${item}`); }
    }
  };
  for (const relative of referenceRoots) {
    const root = join(workspace, relative);
    try {
      const info = await lstat(root);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        issues.push(`Raíz de referencias enlazada o no regular: ${root}`);
        continue;
      }
    } catch (error) {
      if (absent(error)) continue;
      issues.push(`Raíz de referencias inaccesible: ${root}`);
      continue;
    }
    await visit(root);
  }
  return { referenced, issues };
};

const readPreparedSet = async (
  directory: string, providerId: string, id: string, files: readonly string[]
): Promise<PreparedSet> => {
  const blockers: string[] = [];
  const expected = [`${id}-preparation.json`, `${id}-preparation.manifest.json`, `${id}-diagnostics.json`];
  const members = files.map((file) => join(directory, file));
  for (const name of expected) if (!files.includes(name)) blockers.push(`Falta ${name}`);
  if (files.some((name) => !suffixes.some((suffix) => name === `${id}${suffix}`))) {
    blockers.push("Miembros desconocidos del conjunto");
  }
  let bytes = 0;
  const memberSha256: string[] = [];
  for (const path of members) {
    try {
      const stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink()) blockers.push(`Miembro no regular: ${basename(path)}`);
      else {
        bytes += stat.size;
        memberSha256.push(createHash("sha256").update(await readFile(path)).digest("hex"));
      }
    } catch { blockers.push(`Miembro no accesible: ${basename(path)}`); }
  }
  let group: string | null = null;
  let timestamp: number | null = null;
  let sourceHash: string | null = null;
  const path = join(directory, `${id}-preparation.json`);
  if (!blockers.length) {
    try {
      const preparation = await readOfflinePreparation(path, providerId);
      const data: unknown = JSON.parse(await readFile(join(directory, `${id}-diagnostics.json`), "utf8"));
      if (!record(data) || data.version !== 1 || data.providerId !== providerId ||
        !isDeepStrictEqual(data.source, preparation.source) || !isDeepStrictEqual(data.fingerprints, preparation.fingerprints) ||
        !record(data.totals) || data.totals.ready !== preparation.totals.ready ||
        data.totals.review !== preparation.totals.review || data.totals.products !== preparation.products.length) {
        throw new Error("Diagnósticos incompatibles con la preparación");
      }
      const comparisonFile = `${id}-comparison.json`;
      if (files.includes(comparisonFile)) {
        const comparison: unknown = JSON.parse(await readFile(join(directory, comparisonFile), "utf8"));
        if (!record(comparison) || typeof comparison.comparable !== "boolean" ||
          !Array.isArray(comparison.reviewToReady) || !Array.isArray(comparison.readyToReview)) {
          throw new Error("Comparación incompleta");
        }
      }
      timestamp = Date.parse(preparation.preparedAt);
      if (!Number.isFinite(timestamp)) throw new Error("Fecha inválida");
      group = `${preparation.source.providerId}:${preparation.source.scope}:${preparation.source.prefix}:${preparation.source.catalogSha256}`;
      sourceHash = createHash("sha256").update(await readFile(path)).digest("hex");
    } catch (error) {
      blockers.push(`Integridad no acreditada: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { id, files, path, sourceHash, version: { id, group, timestamp, members, bytes, memberSha256, blockers } };
};

export const simulatePreparedRetention = async (
  workspace: string, providerId: string, directory = join(workspace, "storage", "prepared", providerId),
  referencedPaths: readonly string[] = []
): Promise<RetentionSimulation> => {
  const root = resolve(workspace);
  const allowed = join(root, "storage", "prepared", providerId);
  if (!validPrefix.test(providerId) || resolve(directory) !== allowed) {
    throw new Error("Solo se simula la retención en el almacén preparado predeterminado");
  }
  for (const path of [root, join(root, "storage"), join(root, "storage", "prepared"), allowed]) {
    try {
      const info = await lstat(path);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error(`Raíz de retención enlazada o no regular: ${path}`);
      }
    } catch (error) {
      if (absent(error)) return planRetentionSimulation([]);
      throw error;
    }
  }
  const entries = await readdir(allowed, { withFileTypes: true });
  const groups = new Map<string, string[]>();
  const unknown: string[] = [];
  for (const entry of entries) {
    const suffix = suffixes.find((value) => entry.name.endsWith(value));
    const id = suffix ? entry.name.slice(0, -suffix.length) : "";
    if (!suffix || !validPrefix.test(id)) { unknown.push(entry.name); continue; }
    const members = groups.get(id) ?? [];
    members.push(entry.name);
    groups.set(id, members);
  }
  const sets = await Promise.all([...groups].map(([id, files]) => readPreparedSet(allowed, providerId, id, [...files].sort())));
  const referenced = await scanReferences(root, sets);
  const explicit = new Set(referencedPaths.map((value) => resolve(value)));
  const commonBlockers = [
    ...(unknown.length ? [`Entradas no clasificadas en ${allowed}: ${unknown.sort().join(", ")}`] : []),
    ...referenced.issues
  ];
  const versions = sets.map((item) => ({ ...item.version, blockers: [
    ...item.version.blockers,
    ...commonBlockers,
    ...(referenced.referenced.has(item.id) || explicit.has(item.path) ? ["Referenciada por operación, campaña o acreditación"] : [])
  ] }));
  return planRetentionSimulation(versions);
};
