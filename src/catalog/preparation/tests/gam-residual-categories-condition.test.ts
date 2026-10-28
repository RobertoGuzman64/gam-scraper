import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { catalog, categorySlug, reference, unconfirmedConditionCodes } from "./gam-historical-category-fixture.js";
import { prepareCached } from "./prepare-cached.js";

test("GAM: los cuatriciclos no pasan a furgonetas aunque solo consten en la descripción larga", () => {
  for (const code of ["5918", "6806"]) {
    const record = reference(code);
    assert.equal(categorySlug(record), null, code);
    assert.equal(categorySlug({ ...record, shortDescription: "Vehículo eléctrico de ocasión" }), null, code);
    assert.equal(categorySlug({ ...record, shortDescription: null }), null, code);
    const prepared = prepareCached(record, catalog);
    const classified = ["220", "221", "227", "6653", "6623", "6217", "4019", "4020", "4021", "5254", "5918", "6806"].includes(code);
    assert.equal(prepared.status, classified ? "ready" : "review", code);
    if (classified) {
      assert.ok(prepared.importIssues?.createMany.some((issue) => issue.startsWith("Categoría no ")), code);
      assert.deepEqual(prepared.issues, [], code);
    } else {
      assert.ok(prepared.issues.includes("Tipo de máquina de origen sin confirmar") ||
        prepared.issues.some((issue) => issue.startsWith("Condición comercial")), code);
    }
  }
});

test("GAM: los encabezados editoriales ajenos no fuerzan segunda mano cuando existe corroboración", () => {
  for (const code of ["8", "171"]) {
    const record = reference(code);
    assert.equal(record.condition, "Nuevo", code);
    const prepared = prepareCached(record, catalog);
    assert.equal(prepared.product.condition, "Nuevo", code);
    assert.equal(prepared.status, "ready", code);
    assert.notEqual(prepared.product.title, record.title, code);
    assert.equal(prepareCached({ ...record, title: "Equipo de segunda mano" }, catalog).status, "review", code);
    assert.equal(prepareCached({ ...record, title: "Equipo nuevo" }, catalog).product.condition, "Nuevo", code);
  }
});

test("GAM: categorías residuales solo bloquean cuando falta evidencia de origen", () => {
  for (const code of [
    "5918", "6806", "6969", "6970", "6971", "6987", "6988", "6989", "6358", "6367", "6814", "6815",
    "6623", "5254", "6217", "6688", "6689", "6690", "4019", "4020", "4021", "4022",
    "220", "221", "227", "6653"
  ]) {
    const prepared = prepareCached(reference(code), catalog);
    assert.equal(categorySlug(reference(code)), null, code);
    const classified = ["220", "221", "227", "6653", "6623", "6217", "4019", "4020", "4021", "5254", "5918", "6806", "6688", "6689", "6690", "4022", "6358", "6367", "6814", "6815", "6969", "6970", "6971", "6987", "6988", "6989"].includes(code);
    assert.equal(prepared.status, classified ? "ready" : "review", code);
    if (classified) {
      assert.ok(prepared.importIssues?.createMany.some((issue) => issue.startsWith("Categoría no ")), code);
      assert.deepEqual(prepared.issues, [], code);
    } else {
      assert.ok(prepared.issues.includes("Tipo de máquina de origen sin confirmar") ||
        prepared.issues.some((issue) => issue.startsWith("Condición comercial")), code);
    }
  }
});

test("GAM: las diez condiciones sin confirmación continúan sin asignarse", () => {
  for (const code of unconfirmedConditionCodes) {
    const prepared = prepareCached(reference(code), catalog);
    assert.equal(prepared.product.condition, null, code);
    assert.equal(prepared.status, "ready", code);
    assert.ok(!prepared.issues.some((issue) => issue.includes("Condición comercial")), code);
  }
});

