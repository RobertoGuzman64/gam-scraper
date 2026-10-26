import { constants } from "node:fs";
import { copyFile, mkdir, readFile, realpath, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

export const registerInterventionScripts = async (
  rootDirectory: string, runId: string, inputFiles: readonly string[]
): Promise<readonly string[]> => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(runId)) throw new Error("Identificador de lote inválido");
  if (inputFiles.length === 0) throw new Error("No se han indicado scripts para registrar");
  const root = resolve(rootDirectory);
  const destination = join(root, "storage", "interventions", runId, "scripts");
  const candidates = inputFiles.map((file) => resolve(root, file));
  const names = candidates.map((file) => basename(file));
  if (new Set(names).size !== names.length ||
    names.some((name) => !name.endsWith(".ts") || name.endsWith(".d.ts"))) {
    throw new Error("Los scripts deben tener nombres .ts únicos y no pueden ser declaraciones");
  }
  await mkdir(destination, { recursive: true });
  if (await realpath(destination) !== destination) throw new Error("La carpeta de scripts no es segura");
  const registered: string[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const name = names[index];
    if (!name || !(await stat(candidate)).isFile()) throw new Error("El script elegido no es un archivo regular");
    const target = join(destination, name);
    if (await realpath(candidate) === target) {
      registered.push(target);
      continue;
    }
    try {
      await copyFile(candidate, target, constants.COPYFILE_EXCL);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST" ||
        !(await readFile(candidate)).equals(await readFile(target))) {
        throw error;
      }
    }
    registered.push(target);
  }
  return registered;
};
