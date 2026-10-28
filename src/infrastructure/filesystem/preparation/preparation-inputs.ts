import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PreparationFingerprints } from "../../../catalog/preparation/offline-document.js";

const sha = (value: string): string => createHash("sha256").update(value).digest("hex");

const readRuleFiles = async (directory: string): Promise<readonly { name: string; content: string }[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".js") && !entry.name.endsWith(".test.js"));
  const files = await Promise.all(paths.map(async (entry) => ({
    name: entry.name, content: await readFile(join(directory, entry.name), "utf8")
  })));
  for (const subdirectory of entries.filter((entry) => entry.isDirectory() && entry.name !== "tests")) {
    for (const child of await readRuleFiles(join(directory, subdirectory.name))) {
      files.push({ name: `${subdirectory.name}/${child.name}`, content: child.content });
    }
  }
  return files;
};

export const loadPreparationInputs = async (): Promise<{ fingerprints: PreparationFingerprints }> => {
  const rulesRoot = fileURLToPath(new URL("../../../catalog/", import.meta.url));
  const [preparation, legacy, normalization, identity, conflicts] = await Promise.all([
    readRuleFiles(join(rulesRoot, "preparation")),
    readRuleFiles(join(rulesRoot, "legacy-export")),
    readRuleFiles(join(rulesRoot, "normalization")),
    readFile(join(rulesRoot, "identity.js"), "utf8"),
    readFile(join(rulesRoot, "identity-conflicts.js"), "utf8")
  ]);
  const movedMapping = (name: string): boolean =>
    name.startsWith("mapping/") || name.startsWith("evidence/") || name.startsWith("source/");
  const files = [
    ...preparation.filter((file) => movedMapping(file.name) && file.name !== "mapping/category-mapping.js")
      .map((file) => ({ name: `mapping/${file.name}`, content: file.content })),
    ...preparation.filter((file) => !movedMapping(file.name) &&
      !["product-attributes.js", "import-validation.js", "import-diagnostics.js"].includes(file.name))
      .map((file) => ({ name: `preparation/${file.name}`, content: file.content })),
    ...legacy.filter((file) => file.name === "contracts.js" || file.name === "prepare-product.js")
      .map((file) => ({ name: `preparation/legacy-export/${file.name}`, content: file.content })),
    ...normalization.map((file) => ({ name: `normalization/${file.name}`, content: file.content })),
    { name: "identity.js", content: identity },
    { name: "identity-conflicts.js", content: conflicts }
  ].sort((left, right) => left.name.localeCompare(right.name));
  return { fingerprints: {
    rulesVersion: 2,
    rulesSha256: sha(JSON.stringify(files))
  } };
};
