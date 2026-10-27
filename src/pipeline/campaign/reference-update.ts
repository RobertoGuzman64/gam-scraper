import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compareCampaignReferences } from "../../catalog/reference/compare.js";
import { readCampaignReference, writeCampaignReference } from "../../infrastructure/filesystem/campaign-reference.js";
import { verifyDeliveredCampaign } from "./delivery-verification.js";
import { readActiveCampaignReferenceInput } from "./reference-comparison.js";
import type { ReferenceComparison } from "../../catalog/reference/compare.js";
import type { ReferenceManifest } from "../../catalog/reference/manifest.js";

export type CampaignReferenceUpdateResult = {
  readonly manifest: ReferenceManifest;
  readonly comparison: ReferenceComparison;
};

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

export const updateActiveCampaignReference = async (
  rootDirectory: string, desktopDirectory: string, updatedAt: Date = new Date()
): Promise<CampaignReferenceUpdateResult> => {
  const root = resolve(rootDirectory);
  const delivery = await verifyDeliveredCampaign(root, desktopDirectory);
  const current = await readActiveCampaignReferenceInput(root);
  if (delivery.runId !== current.runId) throw new Error("La entrega y los catálogos corresponden a lotes diferentes");
  const previous = await readCampaignReference(root);
  if (previous?.manifest.runId === current.runId) throw new Error("Este lote ya está guardado como referencia");
  const comparison = compareCampaignReferences(
    previous?.manifest.runId ?? null, previous?.catalogs ?? null, current.runId,
    current.catalogs.map((entry) => entry.catalog)
  );
  const manifest = await writeCampaignReference(root, current.runId, current.catalogs, comparison, async () => {
    const deliveryAgain = await verifyDeliveredCampaign(root, desktopDirectory);
    if (deliveryAgain.runId !== current.runId) throw new Error("La entrega cambió durante la actualización");
    for (const entry of current.catalogs) {
      if (digest(await readFile(entry.path, "utf8")) !== entry.sha256) {
        throw new Error(`El catálogo original de ${entry.providerId} cambió durante la actualización`);
      }
    }
  }, updatedAt);
  return { manifest, comparison };
};
