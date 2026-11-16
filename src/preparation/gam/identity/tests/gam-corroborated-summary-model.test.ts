import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { reconcileGamCorroboratedSummaryModel } from "../reconciliation/gam-corroborated-summary-model.js";

const source: ProductRecord = {
  providerId: "gam", categoryKey: "elevacion-nueva", categoryName: "Plataformas elevadoras nuevas",
  url: "https://online.gamrentals.com/es/cte/6308-plataforma-sobre-camion-articulada-cte-az16-pickup",
  reference: "6308", brand: "CTE", model: "AZ16 PICKUP", condition: "Nuevo",
  title: "Plataforma sobre camión articulada CTE AZ16 PICKUP",
  shortDescription: "➨ CTE AZ14 PICKUP Nueva ➨ Venta de plataforma elevadora sobre camión de 16 metros de altura",
  longDescription: "La plataforma sobre camión CTE AZ16 PICK-UP alcanza una altura máxima de trabajo de 15,50 m.",
  price: null, year: null, location: null, country: null,
  horometer: null, serialNumber: null, image: null,
  specs: { Marca: "CTE", Modelo: "AZ16 PICKUP", "Altura de trabajo": "15,50 m" }
};

test("GAM: reconcilia el modelo obsoleto del resumen cuando la ficha y el slug acreditan el actual", () => {
  const original = JSON.stringify(source);
  const corrected = reconcileGamCorroboratedSummaryModel(source);
  assert.notEqual(corrected, source);
  assert.match(corrected.shortDescription ?? "", /CTE AZ16 PICKUP Nueva/u);
  assert.doesNotMatch(corrected.shortDescription ?? "", /AZ14/u);
  assert.equal(corrected.title, source.title);
  assert.equal(corrected.longDescription, source.longDescription);
  assert.equal(JSON.stringify(source), original);
  const prepared = prepareSourceProduct(source);
  assert.doesNotMatch(prepared.product.description ?? "", /AZ14/u);
  assert.match(prepared.product.description ?? "", /AZ16/u);
});

test("GAM: no reconcilia identidades sin corroboración íntegra o discrepancias de más de un carácter", () => {
  for (const incompatible of [
    { ...source, providerId: "gomariz" },
    { ...source, url: "https://otro.example/es/cte/6308-plataforma-cte-az16-pickup" },
    { ...source, url: `${source.url}?variante=otro` },
    { ...source, reference: "6309" },
    { ...source, title: "Plataforma sobre camión articulada CTE AZ14 PICKUP" },
    { ...source, model: "AZ14 PICKUP" },
    { ...source, specs: { ...source.specs, Modelo: "AZ14 PICKUP" } },
    { ...source, specs: { ...source.specs, Marca: "OTRA" } },
    { ...source, longDescription: "La plataforma CTE AZ14 PICKUP alcanza 15,50 m." },
    { ...source, longDescription: "La plataforma AZ16 PICKUP alcanza 15,50 m." },
    { ...source, shortDescription: "➨ CTE AZ01 PICKUP Nueva ➨ Venta de plataforma" },
    { ...source, shortDescription: "➨ CTE AZ164 PICKUP Nueva ➨ Venta de plataforma" },
    { ...source, shortDescription: "➨ OTRA AZ14 PICKUP Nueva ➨ Venta de plataforma" }
  ]) assert.equal(reconcileGamCorroboratedSummaryModel(incompatible), incompatible);
});
