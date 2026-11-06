import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadPreparationInputs } from "../preparation-inputs.js";

const readSequentially = async (directory: string): Promise<readonly { name: string; content: string }[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: { name: string; content: string }[] = [];
  for (const entry of entries.filter((item) => item.isFile() && item.name.endsWith(".js") && !item.name.endsWith(".test.js"))) {
    files.push({ name: entry.name, content: await readFile(join(directory, entry.name), "utf8") });
  }
  for (const entry of entries.filter((item) => item.isDirectory() && item.name !== "tests")) {
    for (const child of await readSequentially(join(directory, entry.name))) {
      files.push({ name: `${entry.name}/${child.name}`, content: child.content });
    }
  }
  return files;
};

test("la lectura paralela conserva las mismas huellas que la lectura secuencial original", async () => {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const [preparation, legacy, normalization, identity, conflicts] = await Promise.all([
    readSequentially(join(root, "preparation")), readSequentially(join(root, "commercial", "legacy-export")),
    readSequentially(join(root, "catalog", "normalization")), readFile(join(root, "catalog", "identity.js"), "utf8"),
    readFile(join(root, "catalog", "identity-conflicts.js"), "utf8")
  ]);
  const files = [
    ...preparation.filter((file) => !file.name.startsWith("workflow/") &&
      !["product-attributes.js", "shared/classification/mapping/category-mapping.js"].includes(file.name))
      .map((file) => ({ name: `preparation/${file.name}`, content: file.content })),
    ...legacy.filter((file) => file.name === "contracts.js" || file.name === "prepare-product.js")
      .map((file) => ({ name: `preparation/legacy-export/${file.name}`, content: file.content })),
    ...normalization.map((file) => ({ name: `normalization/${file.name}`, content: file.content })),
    { name: "identity.js", content: identity }, { name: "identity-conflicts.js", content: conflicts }
  ].sort((left, right) => left.name.localeCompare(right.name));
  const expected = createHash("sha256").update(JSON.stringify(files)).digest("hex");
  const result = await loadPreparationInputs();
  assert.equal(result.fingerprints.rulesVersion, 2);
  assert.equal(result.fingerprints.rulesSha256, expected);
  assert.deepEqual((await loadPreparationInputs()).fingerprints, result.fingerprints);
});
