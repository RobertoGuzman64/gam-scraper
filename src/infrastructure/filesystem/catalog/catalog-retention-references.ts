import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { archiveRoot, isRecord, readJson } from "./catalog-retention-metadata.js";

const referenceRoots = [
  "storage/runs", "storage/campaigns", "storage/interventions", "storage/providers",
  "storage/prepared", "storage/scraped/campaigns",
  "catalogs/campaigns", "catalogs/providers"
] as const;
const referenceText = /\.(json|jsonl|log|txt|csv|ts|md)$/i;

export const protectedArchives = async (dir: string, archives: readonly string[], prefix: string): Promise<ReadonlySet<string>> => {
  if (archives.length === 0) return new Set();
  const workspace = dirname(dirname(dirname(resolve(dir))));
  if (join(workspace, "storage", "scraped", basename(resolve(dir))) !== resolve(dir)) {
    return new Set(archives);
  }
  const identifiers = new Map<string, string[]>();
  for (const name of archives) {
    const archive = join(archiveRoot(dir, prefix), name);
    const manifest: unknown = await readJson(join(archive, "manifest.json"));
    if (!isRecord(manifest) || !Array.isArray(manifest.files)) return new Set(archives);
    const values = [name, archive];
    for (const member of manifest.files) {
      if (typeof member !== "string") return new Set(archives);
      values.push(createHash("sha256").update(await readFile(join(archive, member))).digest("hex"));
    }
    identifiers.set(name, values);
  }
  const protectedNames = new Set<string>();
  let uncertain = false;
  const inspect = async (path: string): Promise<void> => {
    let entries;
    try { entries = await readdir(path, { withFileTypes: true }); }
    catch (error) {
      if (isRecord(error) && error.code === "ENOENT") return;
      uncertain = true;
      return;
    }
    for (const entry of entries) {
      const item = join(path, entry.name);
      if (entry.isSymbolicLink()) { uncertain = true; continue; }
      if (entry.isDirectory()) { await inspect(item); continue; }
      if (!entry.isFile() || !referenceText.test(entry.name)) { uncertain = true; continue; }
      try {
        const contents = (await readFile(item, "utf8")).toLowerCase();
        for (const [name, tokens] of identifiers) {
          if (tokens.some((token) => contents.includes(token.toLowerCase()))) protectedNames.add(name);
        }
      } catch { uncertain = true; }
    }
  };
  for (const root of referenceRoots) {
    const directory = join(workspace, root);
    try {
      const info = await lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink()) { uncertain = true; continue; }
    } catch (error) {
      if (isRecord(error) && error.code === "ENOENT") continue;
      uncertain = true;
      continue;
    }
    await inspect(directory);
  }
  return uncertain ? new Set(archives) : protectedNames;
};

