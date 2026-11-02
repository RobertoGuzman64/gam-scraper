export type RetentionVersion = {
  readonly id: string;
  readonly group: string | null;
  readonly timestamp: number | null;
  readonly members: readonly string[];
  readonly bytes: number;
  readonly memberSha256?: readonly string[];
  readonly blockers: readonly string[];
};

export type RetentionDecision = RetentionVersion & {
  readonly action: "conservar" | "candidato" | "bloqueado";
  readonly reason: string;
};

export type RetentionSimulation = {
  readonly versions: readonly RetentionDecision[];
  readonly kept: number;
  readonly candidates: number;
  readonly protected: number;
  readonly candidateFiles: number;
  readonly candidateBytes: number;
  readonly actualDeletions: 0;
};

export const planRetentionSimulation = (
  versions: readonly RetentionVersion[], keep = 2
): RetentionSimulation => {
  if (!Number.isSafeInteger(keep) || keep < 1) throw new Error("Cuota de retención inválida");
  const byGroup = new Map<string, (RetentionVersion & { readonly group: string; readonly timestamp: number })[]>();
  for (const version of versions) {
    if (!version.group || version.timestamp === null || !Number.isFinite(version.timestamp) || version.blockers.length) continue;
    const group = byGroup.get(version.group) ?? [];
    group.push({ ...version, group: version.group, timestamp: version.timestamp });
    byGroup.set(version.group, group);
  }
  const decisions = new Map<string, { action: RetentionDecision["action"]; reason: string }>();
  for (const [groupId, group] of byGroup) {
    group.sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id));
    if (new Set(group.map((item) => item.timestamp)).size !== group.length) {
      for (const item of group) decisions.set(item.id, { action: "bloqueado", reason: `Fechas de versión ambiguas en ${groupId}` });
      continue;
    }
    for (const [index, item] of group.entries()) decisions.set(item.id, index < keep
      ? { action: "conservar", reason: "Dentro de las dos versiones utilizables más recientes" }
      : { action: "candidato", reason: "Excedente hipotético; no autorizado para eliminación" });
  }
  const ordered = [...versions].sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(ordered.map((item) => item.id)).size !== ordered.length) throw new Error("Identidades de versión duplicadas");
  const result: RetentionDecision[] = ordered.map((item) => {
    const decision = decisions.get(item.id);
    return {
      ...item,
      action: decision?.action ?? "bloqueado",
      reason: decision?.reason ?? (item.blockers.join("; ") || "Versión o identidad de origen no verificable")
    };
  });
  const candidates = result.filter((item) => item.action === "candidato");
  return {
    versions: result,
    kept: result.filter((item) => item.action === "conservar").length,
    protected: result.filter((item) => item.action === "bloqueado").length,
    candidates: candidates.length,
    candidateFiles: candidates.reduce((sum, item) => sum + item.members.length, 0),
    candidateBytes: candidates.reduce((sum, item) => sum + item.bytes, 0),
    actualDeletions: 0
  };
};
