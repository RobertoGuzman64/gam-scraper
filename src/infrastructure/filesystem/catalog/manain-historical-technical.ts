import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseManainHistoricalTechnicalEvidence, type ManainHistoricalTechnicalEvidence } from "../../../preparation/manain/technical/evidence/historical.js";

const evidenceFile = "manain-historical-technical.json";
const manifestFile = "manain-historical-technical.manifest.json";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const sha256 = (raw: string): string => createHash("sha256").update(raw).digest("hex");

const readOptional = async (file: string): Promise<string | null> => {
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Manain: evidencia no regular: ${file}`);
    return await readFile(file, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
};

export const readManainHistoricalTechnicalEvidence = async (directory: string): Promise<{
  readonly evidence: ManainHistoricalTechnicalEvidence;
  readonly evidenceSha256: string;
} | null> => {
  const base = resolve(directory);
  try {
    const folder = await lstat(base);
    if (!folder.isDirectory() || folder.isSymbolicLink()) throw new Error("Manain: directorio de evidencia no regular");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
  const [raw, manifestRaw] = await Promise.all([
    readOptional(join(base, evidenceFile)), readOptional(join(base, manifestFile))
  ]);
  if (raw === null && manifestRaw === null) return null;
  if (raw === null || manifestRaw === null) throw new Error("Manain: evidencia histórica incompleta");
  const evidence: ManainHistoricalTechnicalEvidence = parseManainHistoricalTechnicalEvidence(JSON.parse(raw));
  const manifest: unknown = JSON.parse(manifestRaw);
  const digest = sha256(raw);
  if (!isRecord(manifest) || Object.keys(manifest).length !== 4 || manifest.version !== 1 ||
    manifest.providerId !== "manain" || manifest.entryCount !== evidence.entries.length ||
    manifest.evidenceSha256 !== digest) throw new Error("Manain: huella de evidencia histórica discordante");
  return { evidence, evidenceSha256: digest };
};
