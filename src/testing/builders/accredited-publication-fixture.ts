import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePublicationDirectory } from "../../infrastructure/filesystem/catalog/publication-identity.js";

export type AccreditedPublicationProvider = "gam" | "gomariz" | "mercaeleva";

export const accreditedPublicationSha = (root: string, providerId: AccreditedPublicationProvider): string => {
  const index: unknown = JSON.parse(readFileSync(join(root, "catalogs", "providers", providerId, "publications", "active.json"), "utf8"));
  if (typeof index !== "object" || index === null || !("providerId" in index) ||
    index.providerId !== providerId || !("version" in index) || index.version !== 1 ||
    !("approvalSha256" in index) || typeof index.approvalSha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(index.approvalSha256)) {
    throw new Error(`Índice de publicación activa inválido: ${providerId}`);
  }
  return index.approvalSha256;
};

export const accreditedPublicationDirectory = async (root: string, providerId: AccreditedPublicationProvider): Promise<string> => {
  const folder = join(root, "catalogs", "providers", providerId, "publications");
  const sha = accreditedPublicationSha(root, providerId);
  const directory = await resolvePublicationDirectory(folder, sha);
  if (!directory) throw new Error(`Publicación vigente no encontrada: ${providerId} (${sha})`);
  return directory;
};

export const accreditedPublicationFile = async (root: string, providerId: AccreditedPublicationProvider): Promise<string> =>
  join(await accreditedPublicationDirectory(root, providerId), `${providerId}-publishable.json`);
