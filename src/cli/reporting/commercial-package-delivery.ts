import { createHash } from "node:crypto";
import { lstat, readFile, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createZipArchive, readZipArchive } from "../../infrastructure/archive/zip.js";
import { publishVerifiedArchives, resolveExternalDeliveryDirectory } from "../../infrastructure/archive/verified-delivery.js";
import type { CommercialExportFile } from "../../commercial/export/commercial-export.js";
import { verifyCommercialExportArchive, verifyCommercialExportSources, verifyCommercialExportZip } from "../../commercial/export/commercial-export-verification.js";
import { assertCommercialPackageProviders, inspectCommercialPackage, validateStoredCommercialPackage } from "../../commercial/export/commercial-package-snapshot.js";
import { renderCommercialIntegrationReport } from "./commercial-integration-report.js";
import { retainRepositoryArtifact } from "../../infrastructure/filesystem/catalog/repository-artifact-snapshot.js";

export type CommercialPackageDelivery = {
  readonly commercial: string;
  readonly report: string | null;
  readonly providers: number;
  readonly exported: number;
  readonly attributes: number;
  readonly environment: string;
};

const sha256 = (buffer: Buffer): string => createHash("sha256").update(buffer).digest("hex");
const dayFromReport = (markdown: string): string => {
  const match = /^- Fecha del paquete \(UTC\): (\d{4}-\d{2}-\d{2})$/mu.exec(markdown);
  if (!match?.[1]) throw new Error("Informe comercial sin fecha de corte válida");
  return match[1];
};

export const verifyCommercialIntegrationArchive = (
  archive: Buffer, expected: readonly CommercialExportFile[]
): string => {
  const entries = readZipArchive(archive);
  if (entries.length !== 1 || entries[0]?.name !== "INFORME.md") {
    throw new Error("Informe comercial ZIP con entradas incorrectas");
  }
  const data = entries[0].data;
  const markdown = data.toString("utf8");
  if (!Buffer.from(markdown, "utf8").equals(data)) throw new Error("Informe comercial no es UTF-8 válido");
  return verifyCommercialIntegrationReport(markdown, expected);
};

export const verifyCommercialIntegrationReport = (markdown: string, expected: readonly CommercialExportFile[]): string => {
  const date = dayFromReport(markdown);
  if (markdown !== renderCommercialIntegrationReport(inspectCommercialPackage(expected), date)) {
    throw new Error("Informe comercial no corresponde con el corte acreditado");
  }
  return date;
};

export const verifyCommercialIntegrationZip = async (
  path: string, expected: readonly CommercialExportFile[]
): Promise<string> => {
  const location = resolve(path);
  const info = await lstat(location);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Informe comercial debe ser un ZIP regular");
  return verifyCommercialIntegrationArchive(await readFile(location), expected);
};

export const verifyCommercialPackagePair = async (
  commercial: string, report: string, expected: readonly CommercialExportFile[]
): Promise<void> => {
  if (resolve(commercial) === resolve(report)) throw new Error("Los ZIP comercial y de informe deben ser distintos");
  await verifyCommercialExportZip(commercial, expected);
  const date = await verifyCommercialIntegrationZip(report, expected);
  const fingerprint = inspectCommercialPackage(expected).manifestSha256.slice(0, 16);
  const compactDate = date.replace(/-/gu, "");
  const commercialName = basename(commercial);
  const reportName = basename(report);
  const standardCommercial = /^equipzilla-comercial-\d{8}-[a-f0-9]{16}\.zip$/u.test(commercialName);
  const standardReport = /^equipzilla-informe-comercial-\d{8}-[a-f0-9]{16}\.zip$/u.test(reportName);
  if ((standardCommercial && commercialName !== `equipzilla-comercial-${compactDate}-${fingerprint}.zip`) ||
    (standardReport && reportName !== `equipzilla-informe-comercial-${compactDate}-${fingerprint}.zip`)) {
    throw new Error("Los nombres de los paquetes no corresponden al mismo corte");
  }
};

export type PublishedCommercialPair = {
  readonly commercial: string;
  readonly report: string;
  readonly created: readonly string[];
};

export const publishCommercialArchivePair = async (
  desktop: string, commercialName: string, commercialArchive: Buffer, reportName: string, reportArchive: Buffer
): Promise<PublishedCommercialPair> => {
  const created = await publishVerifiedArchives(desktop, [
    { name: commercialName, archive: commercialArchive }, { name: reportName, archive: reportArchive }
  ]);
  return { commercial: join(desktop, commercialName), report: join(desktop, reportName), created };
};

export const deliverCommercialPackages = async (
  root: string, desktop: string, files: readonly CommercialExportFile[], now: Date = new Date()
): Promise<CommercialPackageDelivery> => {
  const snapshot = inspectCommercialPackage(files);
  assertCommercialPackageProviders(snapshot);
  const date = now.toISOString().slice(0, 10);
  const identifier = snapshot.manifestSha256.slice(0, 16);
  const suffix = `${date.replace(/-/gu, "")}-${identifier}.zip`;
  const physicalDesktop = await resolveExternalDeliveryDirectory(root, desktop);
  const commercialArchive = createZipArchive(files.map((file) => ({ name: file.name, data: file.content })));
  const reportMarkdown = renderCommercialIntegrationReport(snapshot, date);
  verifyCommercialExportArchive(commercialArchive, files);
  verifyCommercialIntegrationReport(reportMarkdown, files);
  const commercialName = `equipzilla-comercial-${suffix}`;
  const commercial = join(physicalDesktop, commercialName);
  const created = await publishVerifiedArchives(physicalDesktop, [{ name: commercialName, archive: commercialArchive }]);
  let report: string | null = null;
  try {
    await verifyCommercialExportZip(commercial, files);
    await verifyCommercialExportSources(root, files);
    if (snapshot.environment !== null) {
      await retainRepositoryArtifact(join(root, "catalogs", "commercial", snapshot.environment),
        "commercial-manifest.json", files, validateStoredCommercialPackage);
      const reportDirectory = join(root, "catalogs", "reports", "commercial", snapshot.environment);
      const fingerprint = await retainRepositoryArtifact(reportDirectory,
        "INFORME.txt", [{ name: "INFORME.txt", content: reportMarkdown }]);
      report = join(reportDirectory, "versions", fingerprint, "INFORME.txt");
      const stored = await readFile(report);
      if (!stored.equals(Buffer.from(reportMarkdown, "utf8")) || sha256(stored) !== fingerprint) {
        throw new Error("Informe comercial interno alterado");
      }
      verifyCommercialIntegrationReport(stored.toString("utf8"), files);
    }
  } catch (error) {
    for (const path of [...created].reverse()) await rm(path, { force: true });
    throw error;
  }
  return {
    commercial, report, providers: snapshot.providers.length,
    environment: snapshot.environment ?? "sin companyID",
    exported: snapshot.providers.reduce((sum, provider) => sum + provider.summary.exported, 0),
    attributes: snapshot.providers.reduce((sum, provider) => sum + provider.summary.attributes, 0)
  };
};
