import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { readCanonicalCatalog } from "../infrastructure/filesystem/catalog/canonical-catalog.js";

export const readMercaelevaSource = async () => {
  const folder = join("catalogs", "providers", "mercaeleva", "original");
  const entries = (await readdir(folder)).filter((name) => name.endsWith("-catalog.json"));
  if (entries.length !== 1) throw new Error("Original canónico de Mercaeleva no unívoco");
  const name = entries[0];
  if (!name) throw new Error("Original canónico de Mercaeleva ausente");
  return (await readCanonicalCatalog(join(folder, name))).products;
};
