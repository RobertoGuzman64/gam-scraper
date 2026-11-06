import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, lstat, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createZipArchive, readZipArchive } from "../../infrastructure/archive/zip.js";
import type { CommercialExportFile } from "../../commercial/export/commercial-export.js";
import { verifyCommercialExportArchive, verifyCommercialExportSources, verifyCommercialExportZip } from "../../commercial/export/commercial-export-verification.js";
import { assertCommercialPackageProviders, inspectCommercialPackage } from "../../commercial/export/commercial-package-snapshot.js";
import { renderCommercialIntegrationReport } from "./commercial-integration-report.js";

export type CommercialPackageDelivery = {
  readonly commercial: string;
  readonly report: string;
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

const verifyStored = async (path: string, expected: Buffer): Promise<void> => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Paquete comercial no regular: ${path}`);
  const actual = await readFile(path);
  if (sha256(actual) !== sha256(expected) || !actual.equals(expected)) {
    throw new Error(`Colisión: ZIP existente con contenido distinto: ${path}`);
  }
};

const saveExclusive = async (temporary: string, destination: string, expected: Buffer): Promise<boolean> => {
  try {
    await copyFile(temporary, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    await verifyStored(destination, expected);
    return false;
  }
  try { await verifyStored(destination, expected); }
  catch (error) {
    await rm(destination, { force: true });
    throw error;
  }
  return true;
};

export type PublishedCommercialPair = {
  readonly commercial: string;
  readonly report: string;
  readonly created: readonly string[];
};

export const publishCommercialArchivePair = async (
  desktop: string, commercialName: string, commercialArchive: Buffer, reportName: string, reportArchive: Buffer
): Promise<PublishedCommercialPair> => {
  if (commercialName === reportName ||
    [commercialName, reportName].some((name) => !name.endsWith(".zip") || basename(name) !== name ||
      name === "." || name === ".." || name.includes("\\"))) {
    throw new Error("Nombres de entrega comercial inválidos");
  }
  const commercial = join(desktop, commercialName);
  const report = join(desktop, reportName);
  const stage = await mkdtemp(join(desktop, `.equipzilla-commercial-${randomUUID()}-`));
  const created: string[] = [];
  try {
    const pendingCommercial = join(stage, commercialName);
    const pendingReport = join(stage, reportName);
    await writeFile(pendingCommercial, commercialArchive, { flag: "wx" });
    await writeFile(pendingReport, reportArchive, { flag: "wx" });
    await verifyStored(pendingCommercial, commercialArchive);
    await verifyStored(pendingReport, reportArchive);
    if (await saveExclusive(pendingCommercial, commercial, commercialArchive)) created.push(commercial);
    if (await saveExclusive(pendingReport, report, reportArchive)) created.push(report);
    return { commercial, report, created };
  } catch (error) {
    for (const path of created.reverse()) await rm(path, { force: true });
    throw error;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
};

export const deliverCommercialPackages = async (
  root: string, desktop: string, files: readonly CommercialExportFile[], now: Date = new Date()
): Promise<CommercialPackageDelivery> => {
  const snapshot = inspectCommercialPackage(files);
  assertCommercialPackageProviders(snapshot);
  const date = now.toISOString().slice(0, 10);
  const identifier = snapshot.manifestSha256.slice(0, 16);
  const suffix = `${date.replace(/-/gu, "")}-${identifier}.zip`;
  const directory = resolve(desktop);
  const [physicalDesktop, physicalRoot] = await Promise.all([realpath(directory), realpath(root)]);
  const inner = relative(physicalRoot, physicalDesktop);
  if (inner === "" || (inner !== ".." && !inner.startsWith(`..${sep}`) && !isAbsolute(inner))) {
    throw new Error("Los paquetes comerciales deben quedar fuera del repositorio");
  }
  if (!(await stat(physicalDesktop)).isDirectory()) throw new Error("El Escritorio no es un directorio");
  await verifyCommercialExportSources(root, files);
  const commercialArchive = createZipArchive(files.map((file) => ({ name: file.name, data: file.content })));
  const reportArchive = createZipArchive([{ name: "INFORME.md", data: renderCommercialIntegrationReport(snapshot, date) }]);
  verifyCommercialExportArchive(commercialArchive, files);
  verifyCommercialIntegrationArchive(reportArchive, files);
  const saved = await publishCommercialArchivePair(physicalDesktop,
    `equipzilla-comercial-${suffix}`, commercialArchive, `equipzilla-informe-comercial-${suffix}`, reportArchive);
  try {
    await verifyCommercialPackagePair(saved.commercial, saved.report, files);
    await verifyCommercialExportSources(root, files);
  } catch (error) {
    for (const path of [...saved.created].reverse()) await rm(path, { force: true });
    throw error;
  }
  return {
    commercial: saved.commercial, report: saved.report, providers: snapshot.providers.length,
    environment: snapshot.environment ?? "sin companyID",
    exported: snapshot.providers.reduce((sum, provider) => sum + provider.summary.exported, 0),
    attributes: snapshot.providers.reduce((sum, provider) => sum + provider.summary.attributes, 0)
  };
};
