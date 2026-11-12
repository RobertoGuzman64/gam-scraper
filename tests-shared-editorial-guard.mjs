import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, relative, sep } from "node:path";

const root = process.cwd();
const source = (name) => readFileSync(name, "utf8");
const central = [
  "src/preparation/shared/editorial/mapping/prepared-editorial.ts",
  "src/preparation/shared/editorial/mapping/prepared-editorial-source.ts",
  "src/preparation/shared/editorial/mapping/prepared-editorial-title.ts",
  "src/preparation/shared/editorial/mapping/source-editorial-evidence.ts",
  "src/preparation/shared/editorial/domain/editorial-composition.ts"
];
for (const file of central) {
  const content = source(file);
  assert.doesNotMatch(content, /from\s+["'][^"']*(?:gam|gomariz|mercaeleva)\/editorial\//u, file);
  assert.doesNotMatch(content, /\brecord\.reference\s*===?\s*["'][\w-]+["']/u, file);
}
const preparation = source("src/preparation/prepare-product.ts");
assert.match(preparation, /description:\s*descriptions\.short/u);
assert.match(preparation, /description_general:\s*descriptions\.general/u);
assert.doesNotMatch(preparation, /resolveGamPrepared|resolveGomarizPrepared|resolveMercaelevaPrepared/u);
assert.doesNotMatch(preparation, /reconcileGamModulaStorageSummary|preparedGamSourceCapacityShort|removeGamVehicleListingMarkers/u);

const imported = new Set();
const walk = (file) => {
  if (imported.has(file)) return;
  imported.add(file);
  const code = source(file);
  for (const match of code.matchAll(/\b(?:from\s*|import\s*)["']([^"']+)["']/gu)) {
    const path = match[1];
    if (!path?.startsWith(".")) continue;
    const candidate = resolve(dirname(file), path).replace(/\.js$/u, ".ts");
    if (existsSync(candidate)) walk(candidate);
  }
};
walk(resolve(root, "src/preparation/prepare-product.ts"));
const permitted = new Set([
  "src/preparation/gam/editorial/source/domain-source.ts",
  "src/preparation/gomariz/editorial/mapping/domain-source.ts",
  "src/preparation/mercaeleva/editorial/mapping/domain-source.ts"
]);
const obsolete = [...imported].map((file) => relative(root, file).split(sep).join("/"))
  .filter((file) => /src\/preparation\/(?:gam|gomariz|mercaeleva)\/editorial\//u.test(file) && !permitted.has(file));
assert.deepEqual(obsolete, [], `Módulos narradores de proveedor aún conectados: ${obsolete.join(", ")}`);
console.log(`PASS | MOTOR EDITORIAL COMPARTIDO | 0 narradores de proveedor conectados; ${imported.size} módulos productivos alcanzables`);
