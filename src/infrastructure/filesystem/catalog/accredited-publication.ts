import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { isCandidate } from "../../../catalog/preparation/preparation-document.js";
import type { ImportCandidate } from "../../../catalog/legacy-export/contracts.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");

export const readAccreditedPublication = async (file: string): Promise<{ providerId: string;
  products: readonly ImportCandidate[]; sha256: string; runId: string }> => {
  const path = resolve(file);
  const directory = dirname(path);
  const [raw, rawManifest, rawAccreditation] = await Promise.all([
    readFile(path, "utf8"), readFile(join(directory, "manifest.json"), "utf8"),
    readFile(join(directory, "accreditation.json"), "utf8")
  ]);
  const manifest: unknown = JSON.parse(rawManifest);
  const accreditation: unknown = JSON.parse(rawAccreditation);
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(manifest) || manifest.version !== 1 || typeof manifest.providerId !== "string" ||
    !/^[a-z][a-z0-9_-]*$/.test(manifest.providerId) || typeof manifest.runId !== "string" ||
    !isRecord(manifest.files) || !isRecord(manifest.totals) ||
    !isRecord(accreditation) || accreditation.approved !== true || accreditation.runId !== manifest.runId ||
    !Array.isArray(parsed) || !Number.isSafeInteger(manifest.totals.publishable) ||
    parsed.length !== manifest.totals.publishable ||
    basename(path) !== `${manifest.providerId}-publishable.json` ||
    manifest.files[basename(path)] !== sha256(raw) ||
    manifest.files["accreditation.json"] !== sha256(rawAccreditation) ||
    manifest.approvalSha256 !== sha256(rawAccreditation) ||
    parsed.some((entry: unknown) => !isCandidate(entry) || entry.providerId !== manifest.providerId ||
      !isRecord(entry.spec) || Object.values(entry.spec).some((value) =>
        typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean" &&
        (!Array.isArray(value) || value.some((part: unknown) =>
          typeof part !== "string" && typeof part !== "number" && typeof part !== "boolean"))))) {
    throw new Error("La publicación no coincide con su manifest/acreditación o contiene fichas inválidas");
  }
  return { providerId: manifest.providerId, products: parsed.filter(isCandidate), sha256: sha256(raw), runId: manifest.runId };
};
