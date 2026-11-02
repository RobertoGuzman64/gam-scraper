import { createHash } from "node:crypto";
import { lstat, open, readFile, readdir, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { RetentionDecision, RetentionSimulation } from "../retention/simulation.js";
import { simulatePreparedRetention } from "./preparation-retention.js";

export type PreparedRetentionApproval = {
  readonly phase3Closed: boolean;
  readonly externalReferencesVerified: boolean;
  readonly writersCoordinated: boolean;
  readonly familyApproved: boolean;
};

export type PreparedRetentionExecution = {
  readonly status: "completada" | "sin_borrado_por_proteccion" | "incompleta";
  readonly deletedVersions: number;
  readonly deletedFiles: number;
  readonly deletedBytes: number;
  readonly protectedVersions: number;
  readonly failures: readonly string[];
};

const isMissing = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

const sameDecision = (left: RetentionDecision, right: RetentionDecision): boolean =>
  left.id === right.id && left.action === right.action && left.group === right.group &&
  left.timestamp === right.timestamp && left.bytes === right.bytes &&
  left.memberSha256?.length === right.memberSha256?.length &&
  left.memberSha256?.every((hash, index) => hash === right.memberSha256?.[index]) !== false &&
  left.members.length === right.members.length &&
  left.members.every((member, index) => member === right.members[index]) &&
  left.blockers.length === right.blockers.length &&
  left.blockers.every((blocker, index) => blocker === right.blockers[index]);

const samePlan = (expected: RetentionSimulation, current: RetentionSimulation): boolean =>
  expected.versions.length === current.versions.length &&
  expected.versions.every((item, index) => {
    const next = current.versions[index];
    return next !== undefined && sameDecision(item, next);
  });

const fingerprint = async (members: readonly string[]): Promise<Map<string, string>> => {
  const result = new Map<string, string>();
  for (const path of members) {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
      throw new Error(`Archivo de retención no exclusivo o no regular: ${path}`);
    }
    result.set(path, createHash("sha256").update(await readFile(path)).digest("hex"));
  }
  return result;
};

const assertFingerprint = async (expected: ReadonlyMap<string, string>): Promise<void> => {
  const current = await fingerprint([...expected.keys()]);
  for (const [path, hash] of expected) {
    if (hash !== current.get(path)) throw new Error(`Archivo modificado antes de eliminar: ${path}`);
  }
};

const ensureSameCandidates = (previous: RetentionSimulation, current: RetentionSimulation): boolean => {
  const remaining = previous.versions.filter((item) => item.action === "candidato");
  const next = current.versions.filter((item) => item.action === "candidato");
  return remaining.length === next.length && remaining.every((item, index) => {
    const other = next[index];
    return other !== undefined && sameDecision(item, other);
  });
};

const blocked = (simulation: RetentionSimulation, reason: string): PreparedRetentionExecution => ({
  status: "sin_borrado_por_proteccion",
  deletedVersions: 0,
  deletedFiles: 0,
  deletedBytes: 0,
  protectedVersions: simulation.protected,
  failures: [reason]
});

export const executePreparedRetention = async (
  workspace: string,
  providerId: string,
  planned: RetentionSimulation,
  approval: PreparedRetentionApproval
): Promise<PreparedRetentionExecution> => {
  if (!approval.phase3Closed || !approval.externalReferencesVerified ||
    !approval.writersCoordinated || !approval.familyApproved) {
    return blocked(planned, "Fase 4 bloqueada: faltan aprobaciones de integridad, referencias externas o concurrencia");
  }
  if (planned.candidates === 0) {
    return { status: planned.protected > 0 ? "sin_borrado_por_proteccion" : "completada",
      deletedVersions: 0, deletedFiles: 0, deletedBytes: 0,
      protectedVersions: planned.protected, failures: [] };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(providerId)) {
    return blocked(planned, "Identidad de proveedor no admitida");
  }
  const root = resolve(workspace);
  const directory = join(root, "storage", "prepared", providerId);
  const lockPath = join(dirname(directory), `.retention-${providerId}.lock`);
  try {
    for (const path of [root, join(root, "storage"), dirname(directory), directory]) {
      const info = await lstat(path);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        return blocked(planned, `Raíz enlazada o no regular: ${path}`);
      }
    }
  } catch (error) {
    return blocked(planned, `Raíz inaccesible: ${error instanceof Error ? error.message : String(error)}`);
  }
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    return blocked(planned, `Retención bloqueada por otra ejecución: ${error instanceof Error ? error.message : String(error)}`);
  }
  let deletedVersions = 0;
  let deletedFiles = 0;
  let deletedBytes = 0;
  const failures: string[] = [];
  try {
    const current = await simulatePreparedRetention(root, providerId);
    if (!samePlan(planned, current)) return blocked(current, "La planificación cambió antes de ejecutar la retención");
    const candidates = current.versions.filter((item) => item.action === "candidato");
    const snapshots = new Map<string, ReadonlyMap<string, string>>();
    for (const candidate of candidates) {
      const expected = candidate.members.map((name) => join(directory, basename(name)));
      if (expected.some((path, index) => path !== candidate.members[index]) ||
        new Set(candidate.members).size !== candidate.members.length || candidate.members.length < 3) {
        return blocked(current, `Conjunto no autorizado: ${candidate.id}`);
      }
      if (!candidate.memberSha256 || candidate.memberSha256.length !== candidate.members.length) {
        return blocked(current, `Faltan huellas completas para ${candidate.id}`);
      }
      const recorded = await fingerprint(candidate.members);
      if (candidate.members.some((path, index) => recorded.get(path) !== candidate.memberSha256?.[index])) {
        return blocked(current, `Las huellas de ${candidate.id} no coinciden con la planificación`);
      }
      snapshots.set(candidate.id, recorded);
    }
    for (const candidate of candidates) {
      const state = await simulatePreparedRetention(root, providerId);
      const remaining = candidates.filter((item) => item.id >= candidate.id);
      const plannedRemaining: RetentionSimulation = { ...current, versions: remaining, candidates: remaining.length };
      if (!ensureSameCandidates(plannedRemaining, state)) {
        failures.push(`Protecciones o generaciones cambiadas antes de eliminar ${candidate.id}`);
        break;
      }
      const snapshot = snapshots.get(candidate.id);
      if (!snapshot) {
        failures.push(`Falta huella para ${candidate.id}`);
        break;
      }
      try {
        await assertFingerprint(snapshot);
        const listed = await readdir(directory);
        if (candidate.members.some((member) => !listed.includes(basename(member)))) {
          throw new Error("Conjunto incompleto antes de eliminar");
        }
        for (const path of candidate.members) {
          const stat = await lstat(path);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
            throw new Error(`Miembro no regular: ${path}`);
          }
          if (snapshot.get(path) !== createHash("sha256").update(await readFile(path)).digest("hex")) {
            throw new Error(`Miembro cambiado: ${path}`);
          }
          await unlink(path);
          try {
            await lstat(path);
            throw new Error(`El archivo reapareció después del borrado: ${path}`);
          } catch (error) {
            if (!isMissing(error)) throw error;
          }
          deletedFiles += 1;
          deletedBytes += stat.size;
        }
        deletedVersions += 1;
      } catch (error) {
        failures.push(`Fallo en ${candidate.id}: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
    }
  } catch (error) {
    failures.push(`Retención interrumpida: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await lock.close();
    try { await unlink(lockPath); }
    catch (error) { failures.push(`No se pudo liberar el bloqueo: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return {
    status: failures.length ? "incompleta" : "completada",
    deletedVersions, deletedFiles, deletedBytes,
    protectedVersions: planned.protected,
    failures
  };
};
