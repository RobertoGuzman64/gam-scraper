import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import {
  reconcileGomarizVerifiedTowerModel, reconcileGomarizVerifiedCompositeBrand
} from "../../reconciliation/gomariz.js";

const tower: ProductRecord = {
  providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria de ocasión",
  url: "https://www.gomarizrent.com/energia-electrica-e-iluminacion/torre-de-luz/generac-vt-hybrid-2/",
  title: "GENERAC VT-HYBRID", brand: "Generac", model: null,
  reference: "TO-TEST", condition: "Segunda mano", price: null,
  shortDescription: null, longDescription: null, year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null, specs: { Motor: "Diésel" }
};

const composite: ProductRecord = {
  ...tower,
  reference: "CC-TEST", brand: "Iveco Socage", model: "S35S14 FORSTE 24D SPEED ULTRA",
  title: "SOCAGE IVECO S35S14 FORSTE 24D SPEED ULTRA",
  url: "https://www.gomarizrent.com/producto/socage-iveco-s35s14-forste-24d-speed-ultra/"
};

test("Gomariz: modelo recuperable solo cuando marca y modelo constan en título y slug de torre", () => {
  for (const url of [tower.url, tower.url.replace("/energia-electrica-e-iluminacion/", "/venta/energia-electrica-e-iluminacion/")]) {
    assert.equal(reconcileGomarizVerifiedTowerModel({ ...tower, url }).model, "VT-HYBRID");
  }
  for (const incompatible of [
    { ...tower, title: "GENERAC VT-MODIFICADO" },
    { ...tower, title: "OTRA VT-HYBRID" },
    { ...tower, url: tower.url.replace("generac-vt-hybrid-2", "otra-vt-hybrid-2") },
    { ...tower, model: "VT-DIFERENTE" },
    { ...tower, specs: { Modelo: "VT-DIFERENTE" } },
    { ...tower, providerId: "gam" },
    { ...tower, url: `${tower.url}?ref=otra` },
    { ...tower, url: tower.url.replace("https:", "http:") },
    { ...tower, title: "GENERAC VT-HYBRID EXTRAS" }
  ]) assert.equal(reconcileGomarizVerifiedTowerModel(incompatible), incompatible);
});

test("Gomariz: marca compuesta se reordena solo con identidad coincidente en título y slug", () => {
  assert.equal(reconcileGomarizVerifiedCompositeBrand(composite).brand, "Socage Iveco");
  for (const incompatible of [
    { ...composite, title: "IVECO SOCAGE S35S14 FORSTE 24D SPEED ULTRA" },
    { ...composite, model: "S35S14 MODELO DIFERENTE" },
    { ...composite, url: composite.url.replace("socage-iveco", "iveco-socage") },
    { ...composite, url: `${composite.url}?origin=otra` },
    { ...composite, specs: { Marca: "Iveco" } },
    { ...composite, providerId: "mercaeleva" },
    { ...composite, condition: "Nuevo" as const }
  ]) assert.equal(reconcileGomarizVerifiedCompositeBrand(incompatible), incompatible);
});
