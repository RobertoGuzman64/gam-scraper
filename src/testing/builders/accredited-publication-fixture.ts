import { readFileSync } from "node:fs";
import { join } from "node:path";

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

export const accreditedPublicationFile = (root: string, providerId: AccreditedPublicationProvider): string =>
  join(root, "catalogs", "providers", providerId, "publications", accreditedPublicationSha(root, providerId), `${providerId}-publishable.json`);
