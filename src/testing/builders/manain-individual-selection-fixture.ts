import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareVerifiedManainRecord } from "../../preparation/workflow/prepare.js";

const fixture = join(process.cwd(), "catalogs", "providers", "manain");

export const createManainSelectionWorkspace = async (): Promise<{ root: string; source: string; preparation: string }> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-manain-selection-"));
  try {
    const active: unknown = JSON.parse(await readFile(join(fixture, "technical", "active.json"), "utf8"));
    if (active === null || typeof active !== "object" || Array.isArray(active) ||
      !("sha256" in active) || typeof active.sha256 !== "string") {
      throw new Error("Selector técnico Manain inválido");
    }
    const directory = join(root, "catalogs", "providers", "manain");
    const version = join("technical", "versions", active.sha256);
    await mkdir(join(directory, "records"), { recursive: true });
    await mkdir(join(directory, version), { recursive: true });
    const source = join(directory, "records", "manain-record.json");
    await copyFile(join(fixture, "records", "manain-record.json"), source);
    await copyFile(join(fixture, "technical", "active.json"), join(directory, "technical", "active.json"));
    for (const name of ["snapshot.json", "manifest.json"]) {
      await copyFile(join(fixture, version, name), join(directory, version, name));
    }
    const preparation = join(root, "storage", "prepared", "manain", "manain-record-selection-preparation.json");
    await prepareVerifiedManainRecord(root, { out: preparation, compare: null, dryRun: false });
    return { root, source, preparation };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
};

