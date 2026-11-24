import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, lstat, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

const verifyStored = async (path: string, expected: Buffer): Promise<void> => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Paquete ZIP no regular: ${path}`);
  const actual = await readFile(path);
  if (!actual.equals(expected)) {
    throw new Error(`Colisión: ZIP existente con contenido distinto: ${path}`);
  }
};

const saveExclusive = async (temporary: string, destination: string, expected: Buffer): Promise<boolean> => {
  try {
    await copyFile(temporary, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    await verifyStored(destination, expected);
    return false;
  }
  try { await verifyStored(destination, expected); }
  catch (error) {
    await rm(destination, { force: true });
    throw error;
  }
  return true;
};

export const publishVerifiedArchives = async (
  desktop: string, archives: readonly { readonly name: string; readonly archive: Buffer }[]
): Promise<readonly string[]> => {
  if (archives.length === 0 || new Set(archives.map(({ name }) => name)).size !== archives.length ||
    archives.some(({ name }) => !name.endsWith(".zip") || basename(name) !== name ||
      name === "." || name === ".." || name.includes("\\"))) {
    throw new Error("Nombres de entrega ZIP inválidos");
  }
  const stage = await mkdtemp(join(desktop, `.equipzilla-delivery-${randomUUID()}-`));
  const created: string[] = [];
  try {
    for (const { name, archive } of archives) {
      const pending = join(stage, name);
      await writeFile(pending, archive, { flag: "wx" });
      await verifyStored(pending, archive);
    }
    for (const { name, archive } of archives) {
      const destination = join(desktop, name);
      if (await saveExclusive(join(stage, name), destination, archive)) created.push(destination);
    }
    return created;
  } catch (error) {
    for (const path of created.reverse()) await rm(path, { force: true });
    throw error;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
};

export const resolveExternalDeliveryDirectory = async (root: string, destination: string): Promise<string> => {
  const [physicalDesktop, physicalRoot] = await Promise.all([realpath(resolve(destination)), realpath(resolve(root))]);
  const inner = relative(physicalRoot, physicalDesktop);
  if (inner === "" || (inner !== ".." && !inner.startsWith(`..${sep}`) && !isAbsolute(inner))) {
    throw new Error("Los paquetes deben quedar fuera del repositorio");
  }
  if (!(await stat(physicalDesktop)).isDirectory()) throw new Error("El Escritorio no es un directorio");
  return physicalDesktop;
};
