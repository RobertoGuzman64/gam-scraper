import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { createCategorySlugResolver } from "./category-slug-resolver.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { isLeafCategoryForCondition } from "../mapping/category-mapping.js";
import { planProductImport, readReferenceInventory } from "../../legacy-export/export-plan.js";
import { validateImportCandidate } from "../../legacy-export/import-validation.js";
import { prepareProduct } from "../prepare.js";

const catalog = await loadImportCatalog();

const gam = (parent: string, title: string, specs: ProductRecord["specs"] = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "elevacion-nueva", categoryName: "Plataformas elevadoras nuevas",
  url: `https://online.gamrentals.com/es/${parent}/99999-maquina`, title,
  shortDescription: "Descripción corta de producto.", longDescription: "Información detallada del producto.",
  price: "21.000,00 €", reference: "99999", brand: "XCMG", model: "XG0607DC", year: null,
  location: null, country: null, horometer: null, serialNumber: null,
  condition: "Nuevo", image: "https://online.gamrentals.com/img/99999.jpg",
  images: ["https://online.gamrentals.com/img/99999.jpg"], specs
});

const categorySlug = createCategorySlugResolver(catalog);

test("maquinaria nueva: rutas de familia inequívoca enlazan con hojas del catálogo real", () => {
  const examples = [
    ["plataformas-de-tijera-electricas-xcmg", "Plataforma elevadora de tijera eléctrica XCMG", "plataforma-tijera-electrica"],
    ["plataforma-articulada-diesel-xcmg", "Plataforma elevadora articulada diésel XCMG", "plataforma-articulada-diesel"],
    ["plataforma-telescopica-electrica-xcmg", "Plataforma telescópica eléctrica XCMG", "plataforma-telescopica-electrica"],
    ["carretillas-elevadoras-diesel-hyster", "Carretilla elevadora diésel Hyster", "carretilla-elevadora-diesel"],
    ["carretillas-elevadoras-electricas-yale", "Carretilla elevadora eléctrica Yale", "carretilla-elevadora-electrica"],
    ["carretillas-retractiles-hyster", "Carretilla retráctil Hyster", "carretilla-retractil"],
    ["apiladores-hyster", "Apilador eléctrico Hyster", "apilador-electrico"],
    ["transpaletas-yale", "Transpaleta eléctrica Yale", "transpaleta-electrica"],
    ["grupos-electrogenos-nuevos", "Grupo electrógeno Pramac", "grupos-electrogenos"],
    ["manipuladores-de-contenedores-vacios-hyster", "Manipulador de contenedores Hyster", "manipulador-de-contenedores"],
    ["fregadoras-industriales-nuevas", "Fregadora industrial Tennant", "fregadora-industrial"],
    ["portaferetros-nuevos", "Portaféretros Draco 36", "portaferetro"],
    ["cte", "Plataforma sobre orugas diésel CTE TRACCESS 135", "plataforma-sobre-oruga"],
    ["cte", "Plataforma sobre camión articulada CTE ZED 20.4", "plataforma-sobre-camion"]
  ] as const;
  for (const [parent, title, expected] of examples) {
    const record = gam(parent, title);
    const prepared = prepareProduct(record, catalog);
    assert.equal(categorySlug(record), expected, parent);
    assert.equal(prepared.product.condition, "Nuevo", parent);
    assert.ok(!prepared.issues.includes("Tipo de máquina de origen sin confirmar"), parent);
    assert.ok(prepared.issues.every((issue) => !issue.includes("Maquinaria nueva excluida")), parent);
  }
});

test("las relaciones y atributos obligatorios se calculan según la hoja nueva, no la usada", () => {
  const record = gam("plataformas-de-tijera-electricas-xcmg", "Plataforma elevadora de tijera eléctrica XCMG", {
    "Altura de trabajo": "8 metros"
  });
  const prepared = prepareProduct(record, catalog);
  assert.equal(prepared.product.categorySellID, 100);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  const height = catalog.attributes.find((attribute) => attribute.name === "Altura de trabajo");
  assert.ok(height);
  assert.ok(prepared.product.attributes.some((attribute) => attribute.attributeID === height.id && attribute.value === 8));
  assert.deepEqual(validateImportCandidate(prepared.product, catalog), []);

  const missing = prepareProduct(gam("plataformas-de-tijera-electricas-xcmg", "Plataforma elevadora de tijera eléctrica XCMG", {
    "Altura de elevación (m)": "8 metros"
  }), catalog);
  assert.equal(missing.product.categorySellID, 100);
  assert.equal(missing.status, "ready");
  assert.ok(missing.importIssues?.createMany.includes("Atributo obligatorio ausente: Altura de trabajo"));
});

test("ambigüedad de familia y motorización impide equivalencias aproximadas", () => {
  const cases = [
    gam("plataformas-de-tijera-electricas-xcmg", "Plataforma articulada eléctrica XCMG"),
    gam("plataformas-de-tijera-electricas-xcmg", "Plataforma de tijera diésel XCMG"),
    gam("carretillas-elevadoras-diesel-hyster", "Carretilla elevadora eléctrica Hyster"),
    gam("apiladores-logitrans", "Apilador semi eléctrico Logitrans"),
    gam("fregadoras-industriales-nuevas", "Barredora fregadora Tennant"),
    gam("plataformas-elevadoras-bravi", "Plataforma elevadora Bravi"),
    gam("modula", "Almacén automático vertical Modula"),
    gam("cte", "Plataforma sobre furgón CTE VJ15")
  ];
  for (const source of cases) {
    const prepared = prepareProduct(source, catalog);
    assert.equal(prepared.product.categorySellID, null, source.title ?? "");
    if (["Apilador semi eléctrico Logitrans", "Plataforma elevadora Bravi"].includes(source.title ?? "")) {
      assert.equal(prepared.status, "ready", source.title ?? "");
      assert.ok(prepared.importIssues?.createMany.some((issue) => issue.startsWith("Categoría no ")));
    } else {
      assert.equal(prepared.status, "review", source.title ?? "");
      assert.ok(prepared.issues.includes("Tipo de máquina de origen sin confirmar"), source.title ?? "");
    }
  }
});

test("no mezcla ramas usadas y nuevas ni valida categorías padre", () => {
  assert.equal(isLeafCategoryForCondition(100, catalog.categories, "Nuevo"), true);
  assert.equal(isLeafCategoryForCondition(100, catalog.categories, "Segunda_Mano"), false);
  assert.equal(isLeafCategoryForCondition(27, catalog.categories, "Nuevo"), false);
  assert.equal(isLeafCategoryForCondition(27, catalog.categories, "Segunda_Mano"), true);
  assert.equal(isLeafCategoryForCondition(24, catalog.categories, "Nuevo"), false);
  const newRecord = prepareProduct(gam("plataformas-de-tijera-electricas-xcmg", "Plataforma de tijera eléctrica XCMG", {
    "Altura de trabajo": "8 metros"
  }), catalog);
  assert.equal(newRecord.status, "ready");
  assert.ok(validateImportCandidate({ ...newRecord.product, categorySellID: 27,
    category: catalog.categories.find((category) => category.id === 27)?.name ?? null }, catalog)
    .includes("Categoría no coincide de forma única con el backend"));
  assert.ok(validateImportCandidate({ ...newRecord.product, categorySellID: 4,
    category: catalog.categories.find((category) => category.id === 4)?.name ?? null }, catalog)
    .includes("Categoría no coincide de forma única con el backend"));
  assert.ok(validateImportCandidate({ ...newRecord.product, condition: null }, catalog)
    .includes("Condición incompatible o no confirmada para importación"));
  assert.ok(validateImportCandidate({ ...newRecord.product, condition: "Segunda_Mano" }, catalog)
    .includes("Categoría no coincide de forma única con el backend"));
});

test("productos nuevos válidos pueden planificarse para Excel sin omitir sus atributos", () => {
  const prepared = prepareProduct(gam("plataformas-de-tijera-electricas-xcmg", "Plataforma de tijera eléctrica XCMG", {
    "Altura de trabajo": "8 metros"
  }), catalog);
  assert.equal(prepared.status, "ready");
  const plan = planProductImport({ quality: "complete", published: true, products: [prepared] }, "gam",
    readReferenceInventory("companyID,reference\n45,EXISTENTE\n", 45), catalog);
  assert.equal(plan.report.newProducts, 1);
  assert.equal(plan.report.reviewProducts, 0);
  assert.equal(plan.rows[0]?.[3], "Nuevo");
  assert.equal(plan.rows[0]?.[1], "Plataformas de Tijera Eléctricas");
  assert.equal(plan.rows[0]?.[plan.headers.indexOf("Altura de trabajo (m)")], 8);
});

test("mapeo usado anterior conserva categoría y condición, sin mezclarlas", () => {
  const used = prepareProduct({
    ...gam("plataformas-elevadoras-tijera-electricas-segunda-mano", "Plataforma de tijera eléctrica usada", {
      "Altura de trabajo": "8 metros"
    }),
    condition: "Segunda mano", categoryKey: "elevacion",
  }, catalog);
  assert.equal(used.product.categorySellID, 27);
  assert.equal(used.product.condition, "Segunda_Mano");
  assert.ok(!used.issues.includes("Tipo de máquina de origen sin confirmar"));
});
