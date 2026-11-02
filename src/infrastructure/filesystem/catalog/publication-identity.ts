import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

const fullSha = /^[a-f0-9]{64}$/;
const directoryName = /^[a-f0-9]{12,64}$/;

export const isPublicationDirectoryName = (name: string): boolean => directoryName.test(name);

export const publicationApprovalSha = async (directory: string): Promise<string> => {
  const name = basename(directory);
  if (!isPublicationDirectoryName(name)) throw new Error(`Identificador de publicación inválido: ${name}`);
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Directorio de publicación no regular: ${directory}`);
  const accreditation = join(directory, "accreditation.json");
  const metadata = await lstat(accreditation);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Acreditación no regular: ${accreditation}`);
  const sha = createHash("sha256").update(await readFile(accreditation)).digest("hex");
  if (!sha.startsWith(name)) throw new Error(`La huella de la aprobación no coincide con el alias o SHA-256 completo: ${directory}`);
  return sha;
};

export const resolvePublicationDirectory = async (folder: string, approvalSha256: string): Promise<string | null> => {
  if (!fullSha.test(approvalSha256)) throw new Error("SHA-256 de aprobación inválido");
  const entries = await readdir(folder, { withFileTypes: true });
  const matching = entries.filter((entry) => isPublicationDirectoryName(entry.name) &&
    approvalSha256.startsWith(entry.name));
  if (matching.length > 1) throw new Error(`Alias de publicación ambiguo para ${approvalSha256}`);
  const entry = matching[0];
  if (!entry) return null;
  if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`Directorio de publicación no regular: ${entry.name}`);
  const directory = join(folder, entry.name);
  if (await publicationApprovalSha(directory) !== approvalSha256) {
    throw new Error(`Publicación con acreditación distinta de ${approvalSha256}`);
  }
  return directory;
};

export const publicationDirectoryForApproval = async (folder: string, approvalSha256: string): Promise<string> => {
  if (!fullSha.test(approvalSha256)) throw new Error("SHA-256 de aprobación inválido");
  try {
    const existing = await resolvePublicationDirectory(folder, approvalSha256);
    if (existing) return existing;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  return join(folder, approvalSha256.slice(0, 12));
};
