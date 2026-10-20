import assert from "node:assert/strict";
import test from "node:test";
import { describeSerialNumberCollision, findIdentityConflicts, findSerialNumberCollisions } from "../quality.js";
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
    { ...first, reference: "TE1002", url: "https://example.com/machine/d", serialNumber: "X" }]).length, 0);
});

test("un serial reutilizado se registra sin confundir referencias comerciales diferentes", () => {
  const a = { ...first, providerId: "gam", serialNumber: "ABC-123" };
  const b = { ...second, providerId: "gam", reference: "TE2000", serialNumber: " abc-123 " };
  const repeated = { ...a, categoryKey: "otra" };
  assert.deepEqual(findIdentityConflicts([a, b, repeated]), []);
  const collisions = findSerialNumberCollisions([a, b, repeated]);
  assert.equal(collisions.length, 1);
  assert.deepEqual(collisions[0]?.products.map((product) => product.reference), ["TE1000", "TE2000"]);
  assert.match(describeSerialNumberCollision(collisions[0]!), /TE1000.*machine\/a.*TE2000.*machine\/b/);
  assert.deepEqual(findSerialNumberCollisions([a, { ...b, providerId: "gomariz" }]), []);
});

test("identidades contradictorias sí bloquean aunque las series sean iguales", () => {
  const a = { ...first, providerId: "gam", serialNumber: "ABC-123" };
  assert.equal(findIdentityConflicts([a, { ...a, url: second.url }]).length, 1);
  assert.equal(findIdentityConflicts([a, { ...a, serialNumber: "OTRA" }]).length, 1);
  assert.equal(findIdentityConflicts([a, { ...a, reference: "TE2000" }]).length, 1);
  const withoutReference = { ...a, reference: null };
  assert.equal(findIdentityConflicts([withoutReference, { ...withoutReference, url: second.url }]).length, 1);
});



test("GAM: conserva las seis referencias del incidente y señala tres series reutilizadas", () => {
  const cases: readonly (readonly [string, string, string])[] = [
    ["6682", "P177B10585U", "carretillas-elevadoras-glp-segunda-mano/6682-2020-hyster-h35ft"],
    ["6703", "P177B10585U", "carretillas-elevadoras-glp-segunda-mano/6703-2020-hyster-h35ft"],
    ["6835", "A976B08243T", "carretillas-elevadoras-electricas-segunda-mano/6835-2019-yale-erp35vl"],
    ["6858", "A976B08243T", "carretillas-elevadoras-electricas-segunda-mano/6858-2019-yale-erp35vl"],
    ["6807", "NRXL3AALS10000101", "motocicletas-electricas-segunda-mano/6807-zero-motorcycles-ds-144"],
    ["6806", "NRXL3AALS10000101", "furgonetas-electricas-de-ocasion/6806-musoshi-pop-up-mini"]
  ];
  const records: ProductRecord[] = cases.map(([reference, serialNumber, path]) => ({
    ...first,
    providerId: "gam",
    reference,
    serialNumber,
    url: `https://online.gamrentals.com/es/${path}`
  }));
  assert.equal(new Set(records.map((record) => record.reference)).size, 6);
  assert.deepEqual(findIdentityConflicts(records), []);
  const collisions = findSerialNumberCollisions(records);
  assert.equal(collisions.length, 3);
  assert.deepEqual(collisions.map((collision) => collision.products.map((record) => record.reference)), [
    ["6682", "6703"], ["6835", "6858"], ["6807", "6806"]
  ]);
});
