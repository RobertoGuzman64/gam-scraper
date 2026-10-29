import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { mercaelevaShortDescription } from "../../preparation/mapping/providers/mercaeleva/descriptions.js";
import { prepareProduct } from "../prepare-product.js";

const catalog = await loadImportCatalog();

const record = (
  title: string, specs: ProductRecord["specs"],
  condition: ProductRecord["condition"] = "Nuevo"
): ProductRecord => ({
  providerId: "mercaeleva", categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: "https://sales.mercaeleva.com/es/for-sale/machine/MB-ESL122-M288-9739",
  title, shortDescription: null, longDescription: null, price: "4950", condition,
  reference: "M288-9739", brand: "MB", model: "ESL122", year: "2026", location: null,
  country: null, horometer: null, serialNumber: null,
  image: "https://example.com/photo.jpg", images: ["https://example.com/photo.jpg"], specs: specs ?? {}
});

const slug = (source: ProductRecord): string | null => {
  const prepared = prepareProduct(source, catalog);
  return catalog.categories.find((category) => category.id === prepared.product.categorySellID)?.slug ?? null;
};

test("Mercaeleva: nueva asigna cinco familias a hojas de maquinaria nueva existentes", () => {
  const cases: readonly [string, ProductRecord["specs"], string][] = [
    ["LGMG S1012E-2 NUEVA PLATAFORMA TIJERA ELECTRICA 12 MT", { Estado: "Nuevo", "Tipo de motor": "Eléctrico" }, "plataforma-tijera-electrica"],
    ["LGMG A14JE NUEVA PLATAFORMA ARTICULADA ELECTRICA 16 MT", { Estado: "Nuevo", "Tipo de motor": "Eléctrico" }, "plataforma-articulada-electrica"],
    ["MB ESL122 Apilador Eléctrico de 1.200kg con batería de Litio", { Estado: "Nuevo", "Tipo de Batería": "Li-ion" }, "apilador-electrico"],
    ["MB WSI161L Apilador de Elevación Inicial con mástil tríplex de 1.600kg", { Estado: "Nuevo", "Tipo de Batería": "Li-ion" }, "apilador-electrico"],
    ["MB EFL253 Carretilla eléctrica de 2.500kg con batería de Litio", { Estado: "Nuevo", "Tipo de Batería": "Li-ion" }, "carretilla-elevadora-electrica"],
    ["MB EPL185 Transpaleta Eléctrica con batería de Litio de 1.800kg", { Estado: "Nuevo", "Tipo de Batería": "Li-ion" }, "transpaleta-electrica"]
  ];
  for (const [title, specs, expected] of cases) {
    const source = record(title, specs);
    assert.equal(slug(source), expected, title);
    const prepared = prepareProduct(source, catalog);
    assert.equal(prepared.product.condition, "Nuevo", title);
    assert.ok(prepared.importIssues?.createMany.includes("Descripción ausente"), title);
    assert.ok(!prepared.issues.includes("Descripción ausente"), title);
  }
});

test("Mercaeleva: rechaza modelos de energía y familia contradictorias", () => {
  const original = record("LGMG S1012E-2 PLATAFORMA TIJERA ELECTRICA", { Estado: "Nuevo", "Tipo de motor": "Eléctrico" });
  assert.equal(slug({ ...original, title: "PLATAFORMA TIJERA DIESEL ELECTRICA" }), null);
  assert.equal(slug({ ...original, specs: { Estado: "Nuevo", "Tipo de motor": "Diésel" } }), null);
  assert.equal(slug({ ...original, title: "PLATAFORMA TIJERA ELECTRICA Y ARTICULADA ELECTRICA" }), null);
  assert.equal(slug({ ...original, specs: { Estado: "Nuevo", "Título adicional": "PLATAFORMA ARTICULADA ELECTRICA" } }), null);
  assert.equal(slug({ ...original, condition: "Segunda mano", specs: { Estado: "Usado" } }), "plataformas-tijera-electricas-segunda-mano");
  assert.equal(slug({ ...original, providerId: "gomariz" }), null);
  const unknown = prepareProduct({ ...original, condition: null, specs: {} }, catalog);
  assert.equal(unknown.product.condition, null);
  assert.equal(unknown.status, "ready");
});

test("Mercaeleva: extrae solo texto publicado y conserva íntegra la descripción general", () => {
  const general = "Ref. 1887 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 22 MT HOLLAND LIFT HL-220 E12 HORAS 859 AÑO DE FABRICACION 2017";
  const source = {
    ...record("Hollandlift HL-220 E12 PLATAFORMA TIJERA ELECTRICA 22 MT", { Estado: "Usado" }, "Segunda mano"),
    brand: "Hollandlift", model: "HL-220 E12", longDescription: general
  };
  assert.equal(mercaelevaShortDescription(source), "PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 22 MT HOLLAND LIFT HL-220 E12");
  const prepared = prepareProduct(source, catalog);
  assert.equal(prepared.product.description_general, general);
  assert.equal(prepared.product.description, mercaelevaShortDescription(source));
  assert.ok(general.includes(prepared.product.description ?? ""));
  assert.notEqual(prepared.product.description, prepared.product.description_general);
  assert.equal(prepared.product.condition, "Segunda_Mano");
  assert.equal(prepared.product.price, 4950);
});

test("Mercaeleva: no confunde otras máquinas, variantes o medidas de trabajo contradictorias", () => {
  const original = {
    ...record("LGMG AS1413 PLATAFORMA TIJERA ELECTRICA 14 MT", { Estado: "Usado" }, "Segunda mano"),
    brand: "LGMG", model: "AS1413",
    longDescription: "Ref. 1236 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 16 MT LGMG AS1413 HORAS 181 AÑO DE FABRICACION 2022"
  };
  assert.equal(mercaelevaShortDescription(original), null);
  assert.equal(mercaelevaShortDescription({ ...original, longDescription: original.longDescription?.replace("TIJERA", "ARTICULADA") ?? null }), null);
  assert.equal(mercaelevaShortDescription({ ...original, model: "AS1412" }), null);
  assert.equal(mercaelevaShortDescription({ ...original, longDescription: "Ref. 1236 PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 14 MT LGMG AS1413 MASTIL DUPLEX TRIPLEX HORAS 181 AÑO DE FABRICACION 2022" }), null);
  const fork = {
    ...original, title: "Toyota 6FBRE14 CARRETILLA ELEVADORA RETRACTIL 1350 KG", brand: "Toyota", model: "6FBRE14",
    longDescription: "Ref. MER1123 TRANSPALET ELECTRICO 1350 KG ALTURA DE TRABAJO 6.500 mm TOYOTA 6FBRE14 HORAS 14696 AÑO DE FABRICACION 2000"
  };
  assert.equal(mercaelevaShortDescription(fork), null);
  assert.equal(mercaelevaShortDescription({ ...original, longDescription: "PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 14 MT" }), null);
  assert.equal(mercaelevaShortDescription({ ...original, longDescription: null }), null);
  assert.equal(mercaelevaShortDescription({ ...original, shortDescription: "Publicación oficial" }), null);
  assert.equal(mercaelevaShortDescription({ ...original, providerId: "gam" }), null);
});

test("Mercaeleva: no inventa precios, condiciones ni textos para fichas sin origen suficiente", () => {
  const source = {
    ...record("BT SWE 160 APILADOR ELECTRICO 1600 KG", { "Título adicional": "APILADOR ELECTRICO 1600 KG" }, null),
    price: null, longDescription: null
  };
  const prepared = prepareProduct(source, catalog);
  assert.equal(prepared.product.price, null);
  assert.equal(prepared.product.condition, null);
  assert.equal(prepared.product.description, null);
  assert.ok(!prepared.issues.some((issue) => issue.startsWith("Precio ")));
  assert.ok(!prepared.issues.some((issue) => issue.includes("Condición comercial")));
  assert.ok(prepared.importIssues?.createMany.includes("Descripción ausente"));
});
