import type { RetentionSimulation } from "../../infrastructure/filesystem/retention/simulation.js";

export const formatRetentionSimulation = (providerId: string, result: RetentionSimulation): readonly string[] => {
  const lines = [
    `RETENCIÓN (SIMULACIÓN) | preparaciones ${providerId.toUpperCase()}`,
    `Conservar: ${result.kept} conjuntos | Candidatos: ${result.candidates} | Protegidos: ${result.protected}`,
    `Archivos candidatos: ${result.candidateFiles} | Tamaño potencial: ${(result.candidateBytes / (1024 * 1024)).toFixed(2)} MB`,
    `Eliminaciones reales: ${result.actualDeletions}`
  ];
  const blocked = result.versions.filter((item) => item.action === "bloqueado");
  for (const item of blocked.slice(0, 3)) lines.push(`Bloqueado ${item.id}: ${item.reason.slice(0, 220)}`);
  if (blocked.length > 3) lines.push(`Otros conjuntos bloqueados: ${blocked.length - 3}`);
  return lines;
};
