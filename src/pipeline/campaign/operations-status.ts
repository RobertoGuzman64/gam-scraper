import { lstat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { inspectCampaignReference } from "../../infrastructure/filesystem/reference/store.js";
import type { CampaignReferenceInspection } from "../../infrastructure/filesystem/reference/store.js";
import { discoverCampaign, listCampaignRuns } from "./discovery/search.js";
import type { CampaignDiscovery } from "./discovery/search.js";
import { verifyDeliveredCampaign } from "./delivery/verification.js";
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
    return result("Sin campaña activa", ["npm run extraer"]);
  }
  if (campaign.status !== "complete" || campaign.issues.length) {
    return result("Campaña incompleta o con incidencias de procedencia", [
      "Revisar los avisos del lote y sus proveedores; no finalizar ni limpiar",
      `Si decides abandonar este intento: npm run recuperar -- ${campaign.runId}`
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
        const verified = await verifyDeliveredCampaign(root, desktopDirectory, campaign.runId);
        if (verified.runId !== campaign.runId) throw new Error("La entrega corresponde a otro lote");
      } catch (error) {
        return result(`Entrega existente, pero no verificable: ${errorMessage(error)}`, [
          "Comprobar el recibo local, la selección y acreditación; el ZIP puede estar ausente"
        ]);
      }
      const runs = await listCampaignRuns(root);
      if (runs.length === 2) return result("Entrega acreditada; dos campañas conservadas, la anterior se rotará antes de la siguiente extracción", [
        "npm run comparar", "npm run extraer (rotación automática cuando ambas entregas sean acreditables)"
      ]);
      return result("Entrega histórica acreditada localmente; no requiere actualizar copias de referencia ni limpieza manual", [
        "npm run comparar", "npm run extraer"
      ]);
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
