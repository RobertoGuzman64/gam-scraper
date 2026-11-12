import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaPlatform } from "./editorial-contract-records.js";

test("las reglas de familia usan hechos comprobados con independencia del proveedor", () => {
  for (const source of [controlledGomarizPlatform(), controlledMercaelevaPlatform(), controlledGamForklift()]) {
    const facts = resolveEditorialFacts(source);
    assert.ok(facts, source.providerId);
    const result = resolveReusableEditorial(source);
    assert.ok(result.short?.includes(`${source.brand} ${source.model}`));
    assert.ok(result.general?.includes(`${source.brand} ${source.model}`));
  }
});

test("el dominio no introduce narradores específicos de proveedor", async () => {
  const directory = "src/preparation/shared/editorial/domain";
  const list = async (path: string): Promise<readonly string[]> => {
    const entries = await readdir(path, { withFileTypes: true });
    const files = await Promise.all(entries.map((item) => item.isDirectory() ? list(`${path}/${item.name}`) :
      Promise.resolve(item.isFile() && item.name.endsWith(".ts") ? [`${path}/${item.name}`] : [])));
    return files.flat();
  };
  const modules = (await list(directory)).filter((path) => path !== `${directory}/editorial-source.ts`);
  assert.ok(modules.length >= 5);
  for (const path of modules) {
    const content = await readFile(path, "utf8");
    assert.doesNotMatch(content, /\bproviderId\b|\b(?:gam|gomariz|mercaeleva)\b|\.\.\/\.\.\/(?:gam|gomariz|mercaeleva)\//u, path);
  }
});
