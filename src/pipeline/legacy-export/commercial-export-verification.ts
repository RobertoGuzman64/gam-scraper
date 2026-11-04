import { lstat, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { CommercialExportFile } from "./commercial-export.js";

export type CommercialExportVerification = {
  readonly files: number;
  readonly bytes: number;
};

export const verifyCommercialExportDirectory = async (
  directory: string, expected: readonly CommercialExportFile[]
): Promise<CommercialExportVerification> => {
  const path = resolve(directory);
  const directoryInfo = await lstat(path);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
    throw new Error("La exportación comercial debe ser un directorio real");
  }
  const names = (await readdir(path)).sort();
  const expectedNames = expected.map((item) => item.name).sort();
  if (new Set(expectedNames).size !== expectedNames.length ||
    JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    throw new Error("La exportación comercial contiene archivos ausentes, extraños o duplicados");
  }
  let bytes = 0;
  for (const entry of expected) {
    const destination = join(path, entry.name);
    const info = await lstat(destination);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Archivo comercial no regular: ${entry.name}`);
    const actual = await readFile(destination);
    if (actual.length !== entry.bytes || actual.toString("utf8") !== entry.content) {
      throw new Error(`La exportación comercial no coincide con el corte acreditado: ${entry.name}`);
    }
    bytes += info.size;
  }
  return { files: expected.length, bytes };
};
