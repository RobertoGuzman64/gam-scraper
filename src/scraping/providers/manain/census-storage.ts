import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { reuseManainCompleteCensus } from "./census.js";
import type { ManainListingResult } from "./listing.js";

export const findReusableManainCensus = async (
  visible: ManainListingResult,
  directory = join("storage", "diagnostics", "manain"),
  now = Date.now()
): Promise<ManainListingResult | null> => {
  if (visible.complete || visible.endReason !== "unverified-single-page") return null;
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return null;
  }
  for (const name of names.filter((value) => /^censo-\d{4}-\d{2}-\d{2}T[\d-]+Z-[\da-f]{8}\.json$/.test(value)).sort().reverse()) {
    try {
      const saved: unknown = JSON.parse(await readFile(join(directory, name), "utf8"));
      const reusable = reuseManainCompleteCensus(visible, saved, now);
      if (reusable) return reusable;
    } catch {
      continue;
    }
  }
  return null;
};
