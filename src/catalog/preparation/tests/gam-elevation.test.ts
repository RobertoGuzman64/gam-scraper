import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { resolveAttributeValue } from "../mapping/attribute-mapping.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const attribute = (name: string) => {
  const found = catalog.attributes.find((item) => item.name === name);
  assert.ok(found, name);
  return found;
};
const valueOf = (record: ProductRecord, name: string): string | number | boolean | null =>
  resolveAttributeValue(record, attribute(name));

const machine = (overrides: Partial<ProductRecord> = {}): ProductRecord => ({
  providerId: "gam", categoryKey: "elevacion-nueva", categoryName: "Elevación nueva",
  url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/4730-xcmg-xg0608c",
  title: "Plataforma elevadora de tijera eléctrica orugas 6M XCMG XG0608C",
  shortDescription: "XCMG XG0608C Nueva. Capacidad de la cesta 200 kg",
  longDescription: "La XCMG XG0608C tiene una altura de trabajo de hasta 8 metros, con una altura de plataforma de 6 metros y capacidad de carga de 200 kg.",
  price: "12000", reference: "4730", condition: "Nuevo", brand: "XCMG", model: "XG0608C",
  year: null, location: null, country: null, horometer: null, serialNumber: null,
  image: "https://example.com/machine.jpg", specs: { "Capacidad de carga (kg)": "200 KG" }, ...overrides
});

test("GAM elevación: altura de trabajo declarada como máximo alcanzable, sin usar alturas genéricas", () => {
  const example = machine();
  assert.equal(valueOf(example, "Altura de trabajo"), 8);
  assert.equal(valueOf(machine({ longDescription: "Plataforma XCMG XG0608C de 8 metros de altura." }), "Altura de trabajo"), null);
  assert.equal(valueOf(machine({ longDescription: "La XCMG XG0608C alcanza una altura de elevación de 8 metros." }), "Altura de trabajo"), null);
  assert.equal(valueOf(machine({ longDescription: "La XCMG XG0608C tiene una altura de trabajo de hasta 8 metros y una altura máxima de 7,8 metros." }), "Altura de trabajo"), null);
  assert.equal(valueOf(machine({ longDescription: "La XCMG XG0608C tiene una altura de trabajo de hasta 8 metros y una altura máxima de 8 metros." }), "Altura de trabajo"), 8);
  assert.equal(valueOf(machine({ longDescription: "La XCMG XG0608C tiene una altura máxima de trabajo de 8,2 metros." }), "Altura de trabajo"), 8.2);
});

test("GAM elevación: altura de plataforma y alcance horizontal no se confunden con el alcance lateral", () => {
  const example = machine({ longDescription: "La XCMG XG0608C tiene una altura de plataforma de 6,2 metros y alcance horizontal de 4,5 m." });
  assert.equal(valueOf(example, "Altura de plataforma"), 6.2);
  assert.equal(valueOf(example, "Alcance horizontal"), 4.5);
  assert.equal(valueOf(machine({ longDescription: "La XCMG XG0608C tiene una altura de trabajo de hasta 8 metros y alcance lateral de hasta 3 metros." }), "Alcance horizontal"), null);
  assert.equal(valueOf(machine({ longDescription: "Altura de plataforma de 6 metros y altura de plataforma de 7 metros." }), "Altura de plataforma"), null);
  assert.equal(valueOf(machine({ longDescription: "Alcance horizontal de 4 metros y alcance horizontal de 5 metros." }), "Alcance horizontal"), null);
});

test("GAM elevación: recupera capacidad de cesta acreditada y respeta discrepancias con ficha técnica", () => {
  assert.equal(valueOf(machine(), "Capacidad de la cesta"), 200);
  assert.equal(valueOf(machine({ shortDescription: "XCMG XG0608C Nueva", longDescription: "La XCMG XG0608C tiene capacidad de carga de 200 kg." }), "Capacidad de la cesta"), null);
  assert.equal(valueOf(machine({
    shortDescription: "XCMG XG0608C Nueva. Capacidad de la cesta 230 kg",
    longDescription: "La XCMG XG0608C tiene capacidad de carga de 200 kg."
  }), "Capacidad de la cesta"), null);
  assert.equal(valueOf(machine({
    shortDescription: "XCMG XG0608C Nueva. Capacidad de la cesta 300 kg",
    longDescription: "La XCMG XG0608C tiene capacidad de carga de 300 kg sin restricción y 460 kg con restricción.",
    specs: { "Capacidad de carga (kg)": "460 KG" }
  }), "Capacidad de la cesta"), null);
  assert.equal(valueOf(machine({ specs: { "Capacidad de la cesta": "150 kg", "Capacidad de carga (kg)": "200 KG" } }), "Capacidad de la cesta"), 150);
});

test("GAM elevación: tracción por orugas y montaje sobre camión requieren evidencia de la configuración", () => {
  assert.equal(valueOf(machine(), "Tipo de tracción"), "Orugas");
  const truck = machine({
    title: "Plataforma elevadora sobre camión CTE ZED 21.3",
    url: "https://online.gamrentals.com/es/cte/6191-cte-zed-213",
    shortDescription: "Plataforma elevadora sobre camión CTE ZED 21.3",
    longDescription: "La plataforma sobre camión CTE ZED 21.3 permite trabajar en altura.",
    brand: null, model: null
  });
  assert.equal(valueOf(truck, "Tipo de tracción"), "Sobre camión");
  assert.equal(valueOf(machine({ title: "Plataforma tijera eléctrica XCMG XG0608C", shortDescription: "XCMG XG0608C para uso interior." }), "Tipo de tracción"), null);
  assert.equal(valueOf(machine({ title: "Plataforma sobre camión y orugas XCMG XG0608C" }), "Tipo de tracción"), null);
});

test("GAM elevación: hojas del árbol nuevo sin forzar híbridos, sobre furgón o plataforma genérica", () => {
  const lithium = machine({
    title: "Plataforma elevadora de tijera 8M XCMG XG0807AC con batería de litio",
    url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/4734-xcmg",
    shortDescription: "XCMG XG0807AC Nueva. Venta de plataforma de tijera eléctrica de 8 metros.",
    brand: "XCMG", model: "XG0807AC"
  });
  assert.equal(prepareProduct(lithium, catalog).product.categorySellID, 100);
  const truck = machine({
    title: "CTE | Plataformas elevadoras sobre camión ZED 21.3 JHV FIB",
    url: "https://online.gamrentals.com/es/cte/6191-cte-zed-213",
    shortDescription: "Plataforma elevadora sobre camión de 21 metros.",
    brand: null, model: null
  });
  assert.equal(prepareProduct(truck, catalog).product.categorySellID, 114);
  const hybrid = machine({
    title: "Plataforma articulada híbrida 18M XCMG XGA18H",
    url: "https://online.gamrentals.com/es/plataforma-articulada-hibrida-xcmg/4779-xcmg",
    brand: "XCMG", model: "XGA18H"
  });
  assert.equal(prepareProduct(hybrid, catalog).product.categorySellID, null);
  const van = machine({
    title: "Plataforma sobre furgón CTE VJ15 FIB",
    url: "https://online.gamrentals.com/es/cte/6874-cte",
    brand: "CTE", model: "VJ15 FIB"
  });
  assert.equal(prepareProduct(van, catalog).product.categorySellID, null);
});

test("GAM elevación: no extrae de otra máquina, de otros proveedores ni de orígenes falsos", () => {
  const incompatible = machine({ title: "Plataforma tijera XCMG XG0810C", shortDescription: "XCMG XG0810C de ocasión" });
  assert.equal(valueOf(incompatible, "Altura de trabajo"), null);
  assert.equal(valueOf(incompatible, "Capacidad de la cesta"), null);
  for (const example of [
    machine({ providerId: "gomariz" }),
    machine({ categoryKey: "manutencion" }),
    machine({ url: "https://example.com/es/plataformas-de-tijera-electricas-xcmg/4730-xcmg" })
  ]) {
    assert.equal(valueOf(example, "Capacidad de la cesta"), null);
    assert.equal(valueOf(example, "Altura de plataforma"), null);
    assert.equal(valueOf(example, "Tipo de tracción"), null);
  }
});

test("GAM elevación: tracción 4x4 con ruedas publicadas, sin inferir rodadura de una ausencia", () => {
  const wheeled = machine({
    title: "Plataforma elevadora tijera eléctrica 4x4 XCMG XG1523ERT",
    url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas-xcmg/4802-plataforma-de-tijera-electrica-4x4-xcmg-xg1523ert",
    reference: "4802", model: "XG1523ERT",
    shortDescription: "Plataforma de tijera eléctrica 4x4 XCMG XG1523ERT",
    longDescription: "La XCMG XG1523ERT dispone de tracción en las cuatro ruedas.",
    specs: { "Tracción 4x4": "Sí" }
  });
  assert.equal(valueOf(wheeled, "Tipo de tracción"), "Ruedas");
  for (const invalid of [
    { ...wheeled, specs: { "Tracción 4x4": "No" } },
    { ...wheeled, specs: { "Tracción 4x4": "Sí/No" } },
    { ...wheeled, specs: {} },
    { ...wheeled, title: "Plataforma elevadora tijera XCMG XG1523ERT" },
    { ...wheeled, longDescription: "Sin datos de rodadura." },
    { ...wheeled, longDescription: "Sistema de ruedas y orugas opcionales." },
    { ...wheeled, providerId: "mercaeleva" },
    { ...wheeled, url: "https://example.com/es/plataformas-tijera/4802" }
  ]) {
    assert.equal(valueOf(invalid, "Tipo de tracción"), null);
  }
  assert.equal(valueOf({ ...wheeled, specs: { "Tracción 4x4": "Sí", "Tipo de tracción": "Orugas" } },
    "Tipo de tracción"), "Orugas");
});
