import assert from "node:assert/strict";
import test from "node:test";
import { gamElevationConflictingIdentityReferences } from "../../technical/tests/support/gam-technical-cohorts.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { loadImportCatalog } from "../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../../../shared/classification/mapping/attribute-mapping.js";

const catalog = await loadImportCatalog();
const reference = (code: string) => accreditedSourceRecord("gam-historical", code);
const attribute = (name: string) => {
  const found = catalog.attributes.find((entry) => entry.name === name);
  assert.ok(found, name);
  return found;
};
const status = (code: string, name: string) => resolveAttribute(reference(code), attribute(name)).status;

test("GAM: identidad de elevación contradictoria bloquea también la cesta y pendiente del modelo", () => {
  const affected = gamElevationConflictingIdentityReferences;
  for (const code of affected) {
    for (const name of ["Altura de trabajo", "Altura de plataforma", "Alcance horizontal", "Altura de elevación"]) {
      assert.equal(status(code, name), "rejected", `${code}: ${name}`);
    }
  }
  assert.equal(status("6981", "Capacidad de la cesta"), "rejected");
  assert.equal(status("6308", "Capacidad de la cesta"), "rejected");
  for (const code of affected.filter((value) => value !== "6308")) {
    assert.equal(status(code, "Dimensiones de la cesta"), "rejected", code);
    assert.equal(status(code, "Pendiente superable"), "rejected", code);
  }
  assert.equal(status("6308", "Dimensiones de la cesta"), "not_observed");
  assert.equal(status("6308", "Pendiente superable"), "not_observed");
});

test("GAM: una ficha con modelo coherente conserva sus dimensiones y pendientes verificables", () => {
  const record = reference("4743");
  assert.equal(resolveAttribute(record, attribute("Dimensiones de la cesta")).status, "resolved");
  assert.equal(resolveAttribute(record, attribute("Pendiente superable")).status, "resolved");
  const conflict = { ...record, model: "XG1012AC-LI" };
  assert.equal(resolveAttribute(conflict, attribute("Dimensiones de la cesta")).status, "rejected");
  assert.equal(resolveAttribute(conflict, attribute("Pendiente superable")).status, "rejected");
  assert.notEqual(resolveAttribute({ ...record, providerId: "gomariz" }, attribute("Dimensiones de la cesta")).status, "rejected");
});
