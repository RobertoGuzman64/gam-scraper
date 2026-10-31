import { join } from "node:path";
import { readAccreditedPublication } from "../infrastructure/filesystem/catalog/accredited-publication.js";

export const accreditedBaselineSha = {
  gam: "eb132eba1db3dcf2d1b503ee04b6f1f2fc282b6c0451a0123481ec1193e97171",
  gomariz: "1e094214a4a5a6ea4bc8943c5028620bee9359d6c13aff27ec29a62bfbb4d59e",
  mercaeleva: "9a8db5bd6929fdc7fce8ceb7e63705b9b168a34161cc52d9536269cff26442e2"
} as const;

export type AccreditedBaselineProvider = keyof typeof accreditedBaselineSha;

export const accreditedBaselineFile = (root: string, providerId: AccreditedBaselineProvider): string =>
  join(root, "catalogs", "providers", providerId, "publications", accreditedBaselineSha[providerId], `${providerId}-publishable.json`);

export const readMercaelevaAccreditedBaseline = (root: string) =>
  readAccreditedPublication(accreditedBaselineFile(root, "mercaeleva"));
