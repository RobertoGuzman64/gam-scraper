import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const projection = read("src/commercial/projection/presentation-projection.ts");
const preparation = read("src/preparation/prepare-product.ts");
const adapter = read("src/commercial/projection/editorial-inputs.ts");
const plan = read("src/commercial/projection/export-projection.ts");
const accreditation = read("src/commercial/diagnostics/commercial-accreditation.ts");
const audit = read("src/commercial/diagnostics/commercial-presentation.ts");
const editorial = read("src/preparation/shared/editorial/mapping/prepared-editorial-presentation.ts");
const genericCapacity = read("src/preparation/shared/editorial/domain/editorial-capacity-coherence.ts");

for (const contract of [
  /description:\s*published\.description\s*,/u,
  /description_general:\s*published\.description_general\s*,/u,
  /title\s*=\s*published\.title\s*\?/u,
  /spec:\s*projectPresentableSpecifications\(/u
]) assert.match(projection, contract);

for (const prohibited of [
  /normalizeCommercial(?:Title|Summary|General)/u,
  /normalizeCommercialYearDescription/u,
  /normalizeVerifiedCommercialCapacity/u,
  /presentCommercialMotorization/u,
  /assessCommercialHeight\(/u,
  /source\.reference\s*===\s*["']\d+/u
]) assert.doesNotMatch(projection, prohibited);

assert.doesNotMatch(plan, /normalizeCommercial(?:Title|Summary|General)|normalizeVerifiedCommercialCapacity/u);
assert.doesNotMatch(genericCapacity, /reference\s*===\s*["']|source\.providerId|\b(?:gam|gomariz|mercaeleva)\b/u);
assert.equal(existsSync("src/commercial/projection/capacity-presentation.ts"), false);
assert.match(preparation, /normalizePreparedEditorialPresentation\(sourceUnitRecord, product\)/u);
assert.match(editorial, /normalizeVerifiedEditorialCapacity\(/u);
assert.match(adapter, /normalizePreparedEditorialPresentation\(input\.source, input\.published\)/u);
assert.match(plan, /prepareCommercialEditorialInputs\(inputs\)/u);
assert.match(accreditation, /prepareCommercialEditorialInputs\(inputs\)/u);
assert.match(audit, /prepareCommercialEditorialInputs\(entries\)/u);

console.log("PASS | AUTORIDAD EDITORIAL | preparación y adaptación histórica usan el mismo motor; exportación sin reescritura de textos");
