import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadImportCatalogSnapshot } from "./import-catalog-loader.js";

const require = createRequire(import.meta.url);

export const workspaceDirectories = (root: string): readonly string[] => [
  join(resolve(root), "storage", "scraped"),
  join(resolve(root), "storage", "prepared"),
  join(resolve(root), "storage", "runs")
];

export const checkWorkspaceRequirements = async (): Promise<void> => {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major === undefined || minor === undefined || major < 18 || (major === 18 && minor < 18)) {
    throw new Error("Se necesita Node.js 18.18 o superior; actualiza Node.js y vuelve a ejecutar npm ci");
  }
  for (const dependency of ["cheerio", "p-limit", "typescript"]) {
    try {
      require.resolve(dependency);
    } catch {
      throw new Error(`Falta la dependencia ${dependency}; ejecuta npm ci desde la raíz del repositorio`);
    }
  }
  try {
    await loadImportCatalogSnapshot();
  } catch (error) {
    throw new Error(`No se pueden cargar categorías/atributos de data/: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const initializeWorkspace = async (root: string): Promise<void> => {
  await checkWorkspaceRequirements();
  for (const path of workspaceDirectories(root)) await mkdir(path, { recursive: true });
};
