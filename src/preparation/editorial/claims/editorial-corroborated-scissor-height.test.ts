import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { hasEditorialAdditionalHeightConflict, hasEditorialSourceWorkHeightConflict } from "../measurements/coherence/editorial-height-consistency.js";
import { hasCorroboratedEditorialDistinctWorkHeights } from "../core/editorial-source.js";

const scissor: ProductRecord = {
  providerId: "mercaeleva", categoryKey: "venta", categoryName: "Maquinaria en venta",
  reference: "M486-0114", brand: "LGMG", model: "AS1413", condition: "Segunda mano",
  url: "https://sales.mercaeleva.com/es/for-sale/machine/LGMG-AS1413-M486-0114",
  title: "LGMG AS1413 PLATAFORMA TIJERA ELECTRICA 14 MT",
  shortDescription: null,
  longDescription: "Ref. 1236 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 16 MT LGMG AS1413 HORAS 181 AÑO DE FABRICACION 2022",
  price: "14500", year: "2022", location: null, country: null,
  horometer: "181", serialNumber: null, image: null,
  specs: {
    Marca: "LGMG", Modelo: "AS1413", "Título adicional": "PLATAFORMA TIJERA ELECTRICA 14 MT",
    "Altura de trabajo": "16 m", "Tipo de motor": "Eléctrico"
  }
};

test("Mercaeleva: distingue la altura nominal de tijera de los 16 m de trabajo contrastados", () => {
  const original = JSON.stringify(scissor);
  assert.equal(hasEditorialAdditionalHeightConflict(scissor), true);
  assert.equal(hasCorroboratedEditorialDistinctWorkHeights(scissor), true);
  assert.equal(hasEditorialAdditionalHeightConflict(scissor, hasCorroboratedEditorialDistinctWorkHeights(scissor)), false);
  assert.equal(hasEditorialSourceWorkHeightConflict(scissor, hasCorroboratedEditorialDistinctWorkHeights(scissor)), false);
  const prepared = prepareSourceProduct(scissor);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description_general ?? "", /16 m/u);
  assert.equal(JSON.stringify(scissor), original);
});

test("Mercaeleva: las discrepancias de altura no verificadas siguen exigiendo revisión", () => {
  for (const incompatible of [
    { ...scissor, providerId: "gam" },
    { ...scissor, categoryKey: "alquiler" },
    { ...scissor, condition: "Nuevo" as const },
    { ...scissor, brand: "OTRA" },
    { ...scissor, model: "AS1412" },
    { ...scissor, title: "OTRA AS1413 PLATAFORMA TIJERA ELECTRICA 14 MT" },
    { ...scissor, title: "LGMG AS1413 PLATAFORMA ARTICULADA ELECTRICA 14 MT" },
    { ...scissor, url: "https://otro.example/es/for-sale/machine/LGMG-AS1413-M486-0114" },
    { ...scissor, url: `${scissor.url}?unidad=otra` },
    { ...scissor, reference: "M486-OTRA" },
    { ...scissor, longDescription: "PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 14 MT" },
    { ...scissor, longDescription: "PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 17 MT" },
    { ...scissor, specs: { ...scissor.specs, "Altura de trabajo": "15 m" } },
    { ...scissor, specs: { ...scissor.specs, Marca: "OTRA" } },
    { ...scissor, specs: { ...scissor.specs, Modelo: "AS1412" } },
    { ...scissor, specs: { ...scissor.specs, "Título adicional": "BRAZO ARTICULADA ELECTRICA 14 MT" } },
    { ...scissor, specs: { ...scissor.specs, "Título adicional": "PLATAFORMA TIJERA ELECTRICA 13 MT" } }
  ]) {
    assert.equal(hasCorroboratedEditorialDistinctWorkHeights(incompatible), false, incompatible.url);
    assert.equal(hasEditorialAdditionalHeightConflict(incompatible, hasCorroboratedEditorialDistinctWorkHeights(incompatible)), true, incompatible.url);
  }
});
