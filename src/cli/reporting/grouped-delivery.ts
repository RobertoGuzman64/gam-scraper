import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { CAMPAIGN_PROVIDERS } from "../../contracts/campaign-providers.js";
import { readActiveCatalogIndex } from "../../infrastructure/filesystem/catalog/active-selection.js";
import { readAccreditedPublication, resolveAccreditedPublication } from "../../infrastructure/filesystem/catalog/accredited-publication.js";
import { inspectRepositoryArtifact } from "../../infrastructure/filesystem/catalog/repository-artifact-snapshot.js";
import { createZipArchive, readZipArchive } from "../../infrastructure/archive/zip.js";
import { publishVerifiedArchives, resolveExternalDeliveryDirectory } from "../../infrastructure/archive/verified-delivery.js";
import type { CommercialEnvironment } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { inspectCommercialPackage, validateStoredCommercialPackage } from "../../commercial/export/commercial-package-snapshot.js";
import { verifyCommercialIntegrationReport } from "./commercial-package-delivery.js";

export type GroupedDeliveryRequest = { readonly kind: "publicos" } |
  { readonly kind: "informes"; readonly environment: CommercialEnvironment };

type SelectedFile = { readonly name: string; readonly path: string; readonly content: string; readonly sha256: string };
const digest = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");

const readSelectedFile = async (path: string, name: string, expected?: string): Promise<SelectedFile> => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || await realpath(path) !== path) {
    throw new Error(`Fuente de entrega no regular: ${path}`);
  }
  const raw = await readFile(path);
  const content = raw.toString("utf8");
  const sha256 = digest(raw);
  if (!Buffer.from(content, "utf8").equals(raw) || (expected !== undefined && sha256 !== expected)) {
    throw new Error(`Huella o codificación de entrega inválida: ${path}`);
  }
  return { name, path, content, sha256 };
};

const readPublications = async (root: string): Promise<readonly SelectedFile[]> => {
  const global = await readActiveCatalogIndex(root);
  const files: SelectedFile[] = [];
  for (const providerId of CAMPAIGN_PROVIDERS) {
    if (!global?.providers[providerId]) {
      const index = join(root, "catalogs", "providers", providerId, "publications", "active.json");
      await readSelectedFile(index, "active.json").catch((error: unknown) => {
        throw new Error(`Selección vigente de ${providerId} ausente o no verificable`, { cause: error });
      });
    }
    const path = await resolveAccreditedPublication(root, providerId);
    if (!path) throw new Error(`Publicación vigente ausente: ${providerId}`);
    const publication = await readAccreditedPublication(path);
    if (publication.providerId !== providerId) throw new Error(`Publicación vigente de otro proveedor: ${providerId}`);
    const name = `${providerId}-publishable.json`;
    files.push(await readSelectedFile(path, name, publication.sha256));
  }
  return files;
};

const readReport = async (directory: string, name: string): Promise<SelectedFile> => {
  const selection = await inspectRepositoryArtifact(directory, "INFORME.txt", ["INFORME.txt"]);
  if (!selection) throw new Error(`Informe vigente ausente: ${directory}`);
  return readSelectedFile(join(directory, "versions", selection.sha256, "INFORME.txt"), name, selection.sha256);
};

const readReports = async (root: string, environment: CommercialEnvironment): Promise<readonly SelectedFile[]> => {
  const reports = join(root, "catalogs", "reports");
  const technical = await readReport(join(reports, "individual-finish"), "tecnico/INFORME.txt");
  if (!technical.content.startsWith("# EQUIPZILLA — Trabajo acumulado publicado\n")) {
    throw new Error("Informe técnico vigente no corresponde a FINISH");
  }
  const commercial = await readReport(join(reports, "commercial", environment), `comercial/${environment}/INFORME.txt`);
  const directory = join(root, "catalogs", "commercial", environment);
  const selected = await inspectRepositoryArtifact(directory, "commercial-manifest.json", validateStoredCommercialPackage);
  if (!selected) throw new Error(`Paquete comercial vigente ausente: ${environment}`);
  const version = join(directory, "versions", selected.sha256);
  const files = await Promise.all((await readdir(version)).map(async (name) => {
    const file = await readSelectedFile(join(version, name), name);
    return { name: basename(file.path), content: file.content, sha256: file.sha256, bytes: Buffer.byteLength(file.content) };
  }));
  const snapshot = inspectCommercialPackage(files);
  if (snapshot.environment !== environment || snapshot.manifestSha256 !== selected.sha256) {
    throw new Error(`Selección comercial incompatible: ${environment}`);
  }
  verifyCommercialIntegrationReport(commercial.content, files);
  return [technical, commercial];
};

const verifyArchive = (archive: Buffer, files: readonly SelectedFile[]): void => {
  const entries = readZipArchive(archive);
  if (entries.length !== files.length || entries.some((entry, index) =>
    entry.name !== files[index]?.name || digest(entry.data) !== files[index]?.sha256)) {
    throw new Error("ZIP agrupado no contiene exactamente las fuentes verificadas");
  }
};

export const deliverGrouped = async (
  workspace: string, destination: string, request: GroupedDeliveryRequest
): Promise<string> => {
  const root = await realpath(resolve(workspace));
  const desktop = await resolveExternalDeliveryDirectory(root, destination);
  const collect = (): Promise<readonly SelectedFile[]> => request.kind === "publicos"
    ? readPublications(root) : readReports(root, request.environment);
  const files = await collect();
  const revalidate = async (): Promise<void> => {
    const current = await collect();
    if (JSON.stringify(current.map(({ name, path, sha256 }) => [name, path, sha256])) !==
      JSON.stringify(files.map(({ name, path, sha256 }) => [name, path, sha256]))) {
      throw new Error("Las fuentes vigentes cambiaron durante la entrega agrupada");
    }
  };
  const identity = digest(JSON.stringify(files.map(({ name, sha256 }) => [name, sha256]))).slice(0, 16);
  const name = `equipzilla-${request.kind}-${request.kind === "informes" ? `${request.environment}-` : ""}${identity}.zip`;
  const path = join(desktop, name);
  const archive = createZipArchive(files.map(({ name, content }) => ({ name, data: content })));
  verifyArchive(archive, files);
  await revalidate();
  const created = await publishVerifiedArchives(desktop, [{ name, archive }]);
  try {
    verifyArchive(await readFile(path), files);
    await revalidate();
  } catch (error) {
    for (const file of created) await rm(file, { force: true });
    throw error;
  }
  return path;
};
