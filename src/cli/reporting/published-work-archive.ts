import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, lstat, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256 } from "../../catalog/editorial/campaign-accreditation.js";
import { createZipArchive, readZipArchive } from "../../infrastructure/archive/zip.js";
import { collectPublishedWork } from "../../publication/individual-work-report.js";
import type { IndividualFinishResult } from "../../publication/individual-finish.js";
import type { PublishedWorkReport } from "../../catalog/diagnostics/published-work.js";
import { renderPublishedWorkMarkdown } from "./published-work.js";

export type PublishedWorkDelivery = {
  readonly report: PublishedWorkReport;
  readonly zipFile: string;
};

const verifyReport = async (path: string, expected: Buffer, markdown: string): Promise<void> => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Informe ZIP no es un archivo regular");
  const zip = await readFile(path);
  if (!zip.equals(expected)) throw new Error("Informe ZIP existente no coincide con las publicaciones acreditadas");
  const entries = readZipArchive(zip);
  if (entries.length !== 1 || entries[0]?.name !== "INFORME.md" ||
    entries[0].data.toString("utf8") !== markdown) {
    throw new Error("Informe ZIP no contiene el resumen esperado");
  }
};

export const deliverPublishedWorkReport = async (
  workspace: string, desktopDirectory: string, result: IndividualFinishResult
): Promise<PublishedWorkDelivery> => {
  const desktop = resolve(desktopDirectory);
  const info = await stat(desktop);
  if (!info.isDirectory()) throw new Error("Informe: el Escritorio no es un directorio");
  const report = await collectPublishedWork(workspace, result);
  const markdown = renderPublishedWorkMarkdown(report);
  const archive = createZipArchive([{ name: "INFORME.md", data: markdown }]);
  const identity = sha256(JSON.stringify(report.providers.map((provider) => [
    provider.providerId, provider.sourceSha256, provider.approvalSha256, provider.publicationSha256
  ]))).slice(0, 16);
  const zipFile = join(desktop, `equipzilla-informe-${identity}.zip`);
  const pending = join(desktop, `.equipzilla-informe-${randomUUID()}.tmp`);
  let created = false;
  try {
    await writeFile(pending, archive, { flag: "wx" });
    try {
      await copyFile(pending, zipFile, constants.COPYFILE_EXCL);
      created = true;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    }
    try {
      await verifyReport(zipFile, archive, markdown);
    } catch (error) {
      if (created) await rm(zipFile, { force: true });
      throw error;
    }
  } finally {
    await rm(pending, { force: true });
  }
  return { report, zipFile };
};
