import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

export type HistoricalReferenceMismatch = {
  readonly path: string;
  readonly expectedSha256: string;
  readonly actualSha256: string | null;
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const missing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

export const checkHistoricalReferenceIntegrity = async (
  workspace: string
): Promise<readonly HistoricalReferenceMismatch[] | null> => {
  const root = resolve(workspace);
  let source: string;
  try {
    source = await readFile(join(root, "data", "commercial-reference", "source-manifest.json"), "utf8");
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
  const manifest: unknown = JSON.parse(source);
  if (!record(manifest) || !record(manifest.fileSha256)) {
    throw new Error("Manifiesto de referencia comercial inválido");
  }
  const mismatches: HistoricalReferenceMismatch[] = [];
  for (const [path, expectedSha256] of Object.entries(manifest.fileSha256)) {
    const absolute = resolve(root, path);
    const within = relative(join(root, "data"), absolute);
    if (!within || within.startsWith(`..${sep}`) || within === ".." || within.startsWith(sep) ||
      typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
      throw new Error("Archivo o huella inválidos en el manifiesto de referencia comercial");
    }
    try {
      const real = await realpath(absolute);
      const inside = relative(join(root, "data"), real);
      if (!inside || inside === ".." || inside.startsWith(`..${sep}`) || inside.startsWith(sep)) {
        throw new Error("Ruta de referencia comercial fuera de data");
      }
      const stat = await lstat(absolute);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        mismatches.push({ path, expectedSha256, actualSha256: null });
        continue;
      }
      const actualSha256 = createHash("sha256").update(await readFile(absolute)).digest("hex");
      if (actualSha256 !== expectedSha256) mismatches.push({ path, expectedSha256, actualSha256 });
    } catch (error) {
      if (!missing(error)) throw error;
      mismatches.push({ path, expectedSha256, actualSha256: null });
    }
  }
  return mismatches;
};
