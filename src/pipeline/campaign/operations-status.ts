import { lstat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { inspectCampaignReference } from "../../infrastructure/filesystem/campaign-reference.js";
import type { CampaignReferenceInspection } from "../../infrastructure/filesystem/campaign-reference.js";
import { findDesktopDirectory } from "../../infrastructure/filesystem/desktop-directory.js";
import { discoverCampaign } from "./discovery.js";
import type { CampaignDiscovery } from "./discovery.js";
import { verifyDeliveredCampaign } from "./delivery-verification.js";
import { inspectActiveCampaignEditorial } from "./editorial.js";
import { finalizeActiveCampaign } from "./finalization.js";

export type CampaignOperationsStatus = {
  readonly campaign: CampaignDiscovery;
  readonly reference: CampaignReferenceInspection;
  readonly description: string;
  readonly next: readonly string[];
  readonly alerts: readonly string[];
};

const exists = async (path: string): Promise<boolean> => {
  try { await lstat(path); return true; }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
};

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export const inspectCampaignOperations = async (
  rootDirectory: string, desktopDirectory?: string
): Promise<CampaignOperationsStatus> => {
  const root = resolve(rootDirectory);
  const [campaign, reference] = await Promise.all([
    discoverCampaign(root), inspectCampaignReference(root)
  ]);
  const alerts: string[] = [];
  if (reference.status === "invalid") alerts.push(`Referencia inválida: ${reference.reason}. Consultar npm run referencia`);
  if (reference.status === "recoverable") alerts.push(`Referencia recuperable: ${reference.reason}. Consultar npm run referencia -- --recuperar`);
  const result = (description: string, next: readonly string[]): CampaignOperationsStatus =>
    ({ campaign, reference, description, next, alerts });

  if (!campaign.runId || !campaign.runFile) {
    if (campaign.issues.length) return result("No se puede identificar una campaña íntegra", ["Revisar los avisos del lote antes de extraer o modificar archivos"]);
    return result("Sin campaña activa (también es normal después de limpiar)", ["npm run extraer"]);
  }
  if (campaign.status !== "complete" || campaign.issues.length) {
    return result("Campaña incompleta o con incidencias de procedencia", [
      "Revisar los avisos del lote y sus proveedores; no finalizar ni limpiar",
      "Si se abandona deliberadamente el lote: npm run extraer -- --nueva"
    ]);
  }
  if (campaign.providers.some((provider) => provider.state === "failed" || provider.state === "invalid")) {
    return result("Hay proveedores no verificables; no se puede acreditar el lote", [
      "Revisar los errores de extracción o integridad antes de continuar"
    ]);
  }
  if (campaign.providers.some((provider) => provider.state !== "prepared")) {
    return result("Faltan preparaciones verificables de algún proveedor", ["npm run revisar"]);
  }

  try {
    const finalization = await finalizeActiveCampaign(root, true);
    if (finalization.status === "draft") {
      return result("Preparaciones disponibles; falta crear el borrador editorial", ["npm run acreditar"]);
    }
    if (finalization.status === "pending") {
      const editorial = await inspectActiveCampaignEditorial(root);
      if (editorial.inspection.issues.length) {
        return result(`Acreditación pendiente: ${editorial.inspection.completed}/${editorial.inspection.total} decisiones válidas`, [
          "npm run acreditar -- --listar", "npm run acreditar -- --validar"
        ]);
      }
      return result("Decisiones editoriales válidas, pendientes de aprobación humana", [
        "npm run acreditar -- --validar", "npm run acreditar -- --aprobar --motivo \"Motivo global documentado\""
      ]);
    }
    if (finalization.status !== "simulation") {
      return result("Estado editorial no verificable para consulta", ["npm run acreditar -- --validar"]);
    }

    const receipt = join(root, "storage", "campaigns", campaign.runId, "delivery.json");
    if (await exists(receipt)) {
      try {
        const verified = await verifyDeliveredCampaign(root, desktopDirectory ?? await findDesktopDirectory());
        if (verified.runId !== campaign.runId) throw new Error("La entrega corresponde a otro lote");
      } catch (error) {
        return result(`Entrega existente, pero no verificable: ${errorMessage(error)}`, [
          "Comprobar el justificante, el ZIP y la selección antes de actualizar referencia o limpiar"
        ]);
      }
      if (reference.status === "valid" && reference.reference.manifest.runId === campaign.runId) {
        return result("Entrega acreditada y referencia verificada para este mismo lote", [
          "npm run limpiar", "npm run limpiar -- --aplicar (solo tras revisar la simulación)"
        ]);
      }
      const next = ["npm run comparar"];
      if (reference.status === "absent" || reference.status === "valid") {
        next.push("npm run referencia -- --actualizar (opcional, antes de limpiar)");
      } else {
        next.push("Resolver el estado de referencia antes de intentar actualizarla");
      }
      next.push("npm run limpiar (simulación; no exige actualizar referencia)");
      return result("Entrega acreditada; referencia aún no actualizada para este lote", next);
    }
    const selectionDir = join(root, "storage", "campaigns", campaign.runId, "selection");
    if (await exists(selectionDir)) {
      const info = await lstat(selectionDir);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        return result("La ruta de selección no es un directorio regular", ["Revisar los artefactos antes de entregar"]);
      }
      return result("Acreditación aprobada y carpeta de selección existente; entrega aún sin acreditar", [
        "npm run entregar (verifica los JSON seleccionados antes del ZIP)"
      ]);
    }
    return result("Acreditación aprobada; falta generar la selección", ["npm run acreditar"]);
  } catch (error) {
    return result(`No es posible comprobar la etapa editorial: ${errorMessage(error)}`, [
      "Revisar la acreditación y las preparaciones vigentes; no entregar ni limpiar"
    ]);
  }
};
