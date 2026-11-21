import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { digest, isRecord, isSha } from "./evidence-files.js";
import { isPublicationTechnicalProvenance } from "../../contracts/technical-provenance.js";
import type { PublicationTechnicalProvenance } from "../../contracts/technical-provenance.js";

export const readPublicationTechnicalProvenance = async (
  root: string, publicationPath: string, providerId: string, publicationSha256: string
): Promise<PublicationTechnicalProvenance | null> => {
  const directory = dirname(join(root, publicationPath));
  const manifest: unknown = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  if (!isRecord(manifest) || manifest.providerId !== providerId || !isRecord(manifest.files)) {
    throw new Error("Manifest de procedencia técnica inválido");
  }
  const expected = manifest.files["technical-provenance.json"];
  if (expected === undefined) return null;
  if (!isSha(expected) || !isSha(publicationSha256) || !isSha(manifest.preparationSha256)) {
    throw new Error("Manifest sin firma de procedencia técnica");
  }
  const raw = await readFile(join(directory, "technical-provenance.json"), "utf8");
  if (digest(raw) !== expected) throw new Error("Evidencia técnica publicada modificada");
  const decoded: unknown = JSON.parse(raw);
  if (!isPublicationTechnicalProvenance(decoded) || decoded.providerId !== providerId ||
    decoded.preparationSha256 !== manifest.preparationSha256) {
    throw new Error("Evidencia técnica no corresponde a la preparación publicada");
  }
  return decoded;
};
