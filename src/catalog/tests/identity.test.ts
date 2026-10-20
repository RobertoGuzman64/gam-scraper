import assert from "node:assert/strict";
import test from "node:test";
import { findIdentityConflicts } from "../quality.js";
import type { ProductRecord } from "../../contracts/catalog.js";


const product = (reference: string, url: string): ProductRecord => ({
  providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria en venta", url,
  title: "LGMG", shortDescription: null, longDescription: null, price: null,
  reference, brand: "LGMG", model: "S0812", year: null, location: null,
  country: null, horometer: null, serialNumber: null, image: null, specs: {}
});

const first = product("TE1000", "https://example.com/machine/a");
const second = product("TE1000", "https://example.com/machine/b");

test("no confunde duplicados de categoría con dos fichas de la misma referencia", () => {
  assert.deepEqual(findIdentityConflicts([first, { ...first, categoryKey: "otra" }]), []);
  assert.equal(findIdentityConflicts([first, second]).length, 1);
  assert.equal(findIdentityConflicts([first, { ...first, serialNumber: "A" }, { ...first, serialNumber: "B" }]).length, 1);
  assert.equal(findIdentityConflicts([first, { ...first, reference: "TE1001" }]).length, 1);
  assert.equal(findIdentityConflicts([first, { ...first, providerId: "gam" }]).length, 0);
  assert.equal(findIdentityConflicts([first, { ...first, reference: "TE1001", url: "https://example.com/machine/c", serialNumber: "X" },
    { ...first, reference: "TE1002", url: "https://example.com/machine/d", serialNumber: "X" }]).length, 1);
});

test("los conflictos de serie indican las referencias y las dos fichas para revisión", () => {
  const a = { ...first, serialNumber: "ABC-123" };
  const b = { ...second, reference: "TE2000", serialNumber: "ABC-123" };
  const problems = findIdentityConflicts([a, b]);
  assert.equal(problems.length, 1);
  assert.match(problems[0] ?? "", /TE1000.*machine\/a.*TE2000.*machine\/b/);
});

