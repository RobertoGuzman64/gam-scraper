import { constants } from "node:fs";
import { copyFile, mkdir, readFile, realpath, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

const save = async (input) => {
  const root = resolve(".");
  const origin = await realpath(resolve(root, input));
  const interventions = await realpath(join(root, "storage", "interventions"));
  const parts = relative(interventions, origin).split(sep);
  if (parts.length !== 3 || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(parts[0] ?? "") ||
    parts[1] !== "scripts" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.ts$/.test(parts[2] ?? "") ||
    parts[2]?.endsWith(".d.ts") || !(await stat(origin)).isFile()) {
    throw new Error("Elige un script .ts registrado en storage/interventions/<lote>/scripts/");
  }
  const destination = join(root, "interventions", "permanentes", parts[0], basename(origin));
  await mkdir(dirname(destination), { recursive: true });
  try {
    await copyFile(origin, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST" ||
      !(await readFile(origin)).equals(await readFile(destination))) throw error;
  }
  if (!(await readFile(origin)).equals(await readFile(destination))) {
    throw new Error("El script conservado no coincide con el original");
  }
  console.log(`INTERVENCIÓN CONSERVADA | ${destination}`);
  console.log("Revisa el script y añádelo expresamente a Git si deseas mantenerlo entre clones.");
};

if (process.argv.length !== 3) {
  console.error("Uso: npm run intervencion:conservar -- storage/interventions/<lote>/scripts/<archivo.ts>");
  process.exitCode = 1;
} else {
  save(process.argv[2]).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
