import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PreparationFingerprints } from "../../../preparation/offline-document.js";

const sha = (value: string): string => createHash("sha256").update(value).digest("hex");

const readRuleFiles = async (directory: string): Promise<readonly { name: string; content: string }[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".js") && !entry.name.endsWith(".test.js"));
  const files = await Promise.all(paths.map(async (entry) => ({
    name: entry.name, content: await readFile(join(directory, entry.name), "utf8")
  })));
  const nested = await Promise.all(entries.filter((entry) => entry.isDirectory() && entry.name !== "tests")
    .map(async (subdirectory) => (await readRuleFiles(join(directory, subdirectory.name)))
      .map((child) => ({ name: `${subdirectory.name}/${child.name}`, content: child.content }))));
  return [...files, ...nested.flat()];
};

export const loadPreparationInputs = async (): Promise<{ fingerprints: PreparationFingerprints }> => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const [preparation, legacy, normalization, identity, conflicts] = await Promise.all([
    readRuleFiles(join(root, "preparation")),
    readRuleFiles(join(root, "commercial", "legacy-export")),
    readRuleFiles(join(root, "catalog", "normalization")),
    readFile(join(root, "catalog", "identity.js"), "utf8"),
    readFile(join(root, "catalog", "identity-conflicts.js"), "utf8")
  ]);
  const files = [
    ...preparation.filter((file) => !file.name.startsWith("workflow/") &&
      !["product-attributes.js", "shared/classification/mapping/category-mapping.js"].includes(file.name))
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
