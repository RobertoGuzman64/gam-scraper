import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readCanonicalCatalog } from "./canonical-catalog.js";

export const readInterventionSource = async (source: string) => {
  const path = resolve(source);
  const before = await readFile(path);
  const catalog = await readCanonicalCatalog(path);
  const after = await readFile(path);
  if (!before.equals(after)) throw new Error("El catálogo cambió durante la lectura de la simulación");
  const catalogSha256 = createHash("sha256").update(before).digest("hex");
  return { catalog, catalogSha256 };
};
