import assert from "node:assert/strict";
import test from "node:test";
import { resolveGamConverterOptions } from "../convert-csv.js";

test("se mantienen los valores históricos del conversor GAM y admiten configuración", () => {
  const legacy = resolveGamConverterOptions(["input.csv", "out.ts", "categories.json"]);
  assert.equal(legacy.companyID, 208);
  assert.equal(legacy.idStart, 681);
  assert.equal(legacy.referencePrefix, "GAM-");

  const custom = resolveGamConverterOptions([
    "input.csv", "out.ts", "categories.json", "--companyID", "301", "--idStart", "10", "--referencePrefix", "PROV-"
  ]);
  assert.equal(custom.companyID, 301);
  assert.equal(custom.idStart, 10);
  assert.equal(custom.referencePrefix, "PROV-");
  assert.throws(() => resolveGamConverterOptions(["a", "b", "c", "--companyID", "0"]), /entero positivo/);
});

