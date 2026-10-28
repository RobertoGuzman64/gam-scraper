import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseOfflinePreparation } from "../../../catalog/preparation/offline-document.js";
import type { OfflinePreparation } from "../../../catalog/preparation/offline-document.js";

const sha256 = (raw: string): string => createHash("sha256").update(raw).digest("hex");

export const offlinePreparationManifestPath = (path: string): string => {
  if (!path.endsWith("-preparation.json")) throw new Error("La preparación debe terminar en -preparation.json");
  return `${path.slice(0, -"-preparation.json".length)}-preparation.manifest.json`;
};

export const offlinePreparationManifest = (raw: string, preparation: OfflinePreparation): string => JSON.stringify({
  version: 1,
  providerId: preparation.source.providerId,
  catalogSha256: preparation.source.catalogSha256,
  preparationSha256: sha256(raw)
}, null, 2);

export const readOfflinePreparation = async (path: string, providerId: string): Promise<OfflinePreparation> => {
  const [raw, manifestText] = await Promise.all([
    readFile(path, "utf8"), readFile(offlinePreparationManifestPath(path), "utf8")
  ]);
  const input: unknown = JSON.parse(raw);
  const manifest: unknown = JSON.parse(manifestText);
  const preparation = parseOfflinePreparation(input, providerId);
  if (!manifest || typeof manifest !== "object" ||
    !("version" in manifest) || manifest.version !== 1 ||
    !("providerId" in manifest) || manifest.providerId !== providerId ||
    !("catalogSha256" in manifest) || manifest.catalogSha256 !== preparation.source.catalogSha256 ||
    !("preparationSha256" in manifest) || manifest.preparationSha256 !== sha256(raw)) {
    throw new Error("Manifest de preparación ausente, alterado o incoherente");
  }
  return preparation;
};
