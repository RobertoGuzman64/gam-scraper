import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { createCategorySlugResolver } from "./category-slug-resolver.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { newCategorySlug } from "../mapping/providers/gam/categories.js";
import { prepareProduct } from "../prepare.js";

const catalog = await loadImportCatalog();

const machine = (parent: string, title: string, shortDescription: string, specs: ProductRecord["specs"] = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "marcas-nuevas", categoryName: "Maquinaria nueva",
  url: `https://online.gamrentals.com/es/${parent}/99999-maquina`, title,
  shortDescription, longDescription: "", price: null, reference: "99999", brand: null, model: null,
  year: null, location: null, country: null, horometer: null, serialNumber: null, condition: "Nuevo",
  image: null, images: [], specs
});

const slug = createCategorySlugResolver(catalog);

test("apiladores: respeta la modalidad explícita del título, la descripción y las especificaciones", () => {
  assert.equal(slug(machine("apiladores-hyster", "Carretilla elevadora apiladora HYSTER S1.0E",
    "Venta de apilador eléctrico nuevo")), "apilador-electrico");
  assert.equal(slug(machine("apiladores-yale", "Apilador eléctrico 1000Kg Yale MS10E", "")), "apilador-electrico");
  assert.equal(slug(machine("apiladores-logitrans", "Apilador manual Logitrans Logiflex M", "")), "apilador-manual");
  assert.equal(slug(machine("apiladores-yale", "Apilador de almacén Yale", "", { Motorización: "Eléctrico" })),
    "apilador-electrico");
});

test("transpaletas: distingue tijera, manual y eléctrica sin asumir alimentación", () => {
  assert.equal(slug(machine("transpaletas-logitrans", "Transpaleta de tijera manual 1500 kg Logitrans HL", "")),
    "transpaleta-tijera");
  assert.equal(slug(machine("transpaletas-logitrans", "Transpaleta de tijera eléctrica 1500 kg Logitrans EHL", "")),
    "transpaleta-tijera");
  assert.equal(slug(machine("transpaletas-logitrans", "Transpaleta manual Logitrans Panther", "")),
    "transpaleta-manual");
  assert.equal(slug(machine("transpaletas-yale", "Transpaleta manual YALE PLHP25 2500 Kg", "")),
    "transpaleta-manual");
  assert.equal(slug(machine("transpaletas-yale", "Portador de paletas Yale MPC15",
    "Transpaleta propulsada con ion de litio")), "transpaleta-electrica");
  assert.equal(slug(machine("hyster", "Transpaleta manual Hyster 2500kg PLPM2.5", "")),
    "transpaleta-manual");
  assert.equal(slug(machine("transpaletas-logitrans", "Transpaleta de cuartos de palé Logitrans LogiQ 200/300", "")), null);
});

test("preparadores de pedidos: identifica las denominaciones del catálogo sin confundir plataformas", () => {
  assert.equal(slug(machine("recogepedidos-hyster", "Recogepedidos 1000Kg Hyster LO1.0F", "")), "preparapedido");
  assert.equal(slug(machine("recogepedidos-yale", "Preparapedidos Yale MO10", "")), "preparapedido");
  assert.equal(slug(machine("yale", "Preparapedidos 2000kg Yale MO20X", "")), "preparapedido");
  assert.equal(slug(machine("recogepedidos-bravi", "Plataforma recogepedidos 4,1M BRAVI Spin-GO", "")), null);
  assert.equal(slug(machine("recogepedidos-hyster", "Plataforma recogepedidos Hyster", "")), null);
});

test("no crea correspondencias con información ambigua, contradictoria o de otra familia", () => {
  const cases = [
    machine("apiladores-logitrans", "Apilador semi eléctrico Logitrans Logiflex SE", ""),
    machine("apiladores-hyster", "Carretilla elevadora apiladora eléctrica HYSTER S1.0E", "Venta de apilador manual"),
    machine("apiladores-hyster", "Apilador manual Hyster", "Venta de apilador eléctrico"),
    machine("transpaletas-yale", "Transpaleta manual Yale", "Venta de transpaleta eléctrica"),
    machine("transpaletas-yale", "Transpaleta eléctrica Yale", "", { Motorización: "Diésel" }),
    machine("apiladores-yale", "Apilador eléctrico Yale", "", { "Tipo motor": "GLP" }),
    machine("transpaletas-hyster", "Transpaleta Hyster", ""),
    machine("transpaletas-yale", "Carretilla elevadora Yale", "Transpaleta eléctrica"),
    machine("yale", "Carretilla elevadora Yale", "Preparapedidos eléctrico"),
    machine("recogepedidos-yale", "Recogepedidos y transpaleta Yale", "")
  ];
  for (const record of cases) {
    assert.equal(newCategorySlug(record), null, record.title ?? "");
  }
});

test("retráctiles y trilaterales conservan sus correspondencias y las condiciones nuevas", () => {
  const cases = [
    machine("carretillas-retractiles-hyster", "Carretilla elevadora retráctil 1400Kg Hyster R1.4E", ""),
    machine("carretillas-trilaterales-hyster", "Carretilla para pasillos estrechos Hyster C1.0", "")
  ];
  for (const [index, record] of cases.entries()) {
    const prepared = prepareProduct(record, catalog);
    assert.equal(slug(record), index === 0 ? "carretilla-retractil" : "carretilla-elevadora-trilateral");
    assert.equal(prepared.product.condition, "Nuevo");
  }
});
