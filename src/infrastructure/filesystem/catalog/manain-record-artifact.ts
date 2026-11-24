import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ManainRecord } from "../../../preparation/workflow/manain-record.js";

const jsonFile = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));

export const readManainRecordEvidence = async (
  source: string, summary: string, errors: string, census: string
): Promise<readonly [string, unknown, unknown, unknown]> => Promise.all([
  readFile(source, "utf8"), jsonFile(summary), jsonFile(errors), jsonFile(census)
]);

export const writeManainRecordArtifact = async (out: string, result: ManainRecord): Promise<void> => {
  await mkdir(dirname(out), { recursive: true });
  const content = JSON.stringify(result, null, 2) + "\n";
  try {
    await writeFile(out, content, { flag: "wx" });
  } catch (error) {
    if (error === null || typeof error !== "object" || !("code" in error) || error.code !== "EEXIST" ||
      await readFile(out, "utf8") !== content) throw error;
  }
};
