import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "./canonical-catalog.js";
import { buildProductIdentity } from "../../../catalog/identity.js";

export const originalSources = async (root: string, providerId: string): Promise<Map<string, ProductRecord> | null> => {
  const directory = join(root, "catalogs", "providers", providerId, "original");
  let filenames: string[];
  try {
    filenames = (await readdir(directory)).filter((name) => name.endsWith("-catalog.json"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
  if (filenames.length === 0) return null;
  if (filenames.length !== 1) throw new Error(`Original canónico ambiguo para ${providerId}`);
  const original = await readCanonicalCatalog(join(directory, filenames[0]!));
  if (original.providerId !== providerId) throw new Error(`Proveedor incorrecto en original ${providerId}`);
  const sources = new Map<string, ProductRecord>();
  for (const source of original.products) {
    const key = buildProductIdentity(source).key;
    if (sources.has(key)) throw new Error(`Identidad duplicada en original ${key}`);
    sources.set(key, source);
  }
  return sources;
};

