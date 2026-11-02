import type { PreparedRetentionExecution } from "../../infrastructure/filesystem/preparation/prepared-retention-execution.js";

export const formatRetentionExecution = (
  providerId: string, result: PreparedRetentionExecution
): readonly string[] => {
  if (result.deletedFiles === 0 && result.failures.length === 0) return [];
  const lines = [
    `RETENCIÓN AUTOMÁTICA | preparaciones ${providerId.toUpperCase()}`,
    `Versiones eliminadas: ${result.deletedVersions} | Archivos eliminados: ${result.deletedFiles}`,
    `Tamaño lógico retirado: ${(result.deletedBytes / (1024 * 1024)).toFixed(2)} MB`,
    `Estado: ${result.status === "sin_borrado_por_proteccion" ? "sin borrado por protección" : result.status}`
  ];
  for (const reason of result.failures.slice(0, 3)) lines.push(`Bloqueo: ${reason}`);
  if (result.failures.length > 3) lines.push(`Otros bloqueos: ${result.failures.length - 3}`);
  return lines;
};
