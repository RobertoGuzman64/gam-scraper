import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { PreparedProduct } from "../../../preparation/contracts.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";
import type { DescriptionCoverageInput } from "../description-coverage.js";
import { analyzeTitleQuality } from "../title-quality.js";

const record = (reference: string, originalTitle: string | null, publishedTitle: string | null,
  preparedTitle: string | null, options: { readonly brand?: string | null; readonly model?: string | null;
    readonly short?: string | null; readonly long?: string | null;
    readonly specs?: ProductRecord["specs"]; readonly origin?: DescriptionCoverageInput["origin"] } = {}): DescriptionCoverageInput => {
  const url = `https://example.com/${reference}`;
  const source: ProductRecord = {
    providerId: "gam", categoryKey: "maquinaria", categoryName: "Maquinaria",
    url, reference, title: originalTitle, shortDescription: options.short ?? null,
    longDescription: options.long ?? null, brand: options.brand ?? null, model: options.model ?? null,
    ...(options.specs ? { specs: options.specs } : {}), price: null, year: null, location: null, country: null, horometer: null, serialNumber: null, image: null
  };
  const published: ImportCandidate = {
    providerId: source.providerId, sourceUrl: url, reference, title: publishedTitle,
    categorySellID: null, category: null, condition: null, price: null,
    description_title: null, description: null, description_general: null,
    image: null, images: [], spec: {}, attributes: []
  };
  const prepared: PreparedProduct = {
    status: "ready", issues: [], product: { ...published, title: preparedTitle }
  };
  return { published, prepared, source, origin: options.origin ?? "original_canonico" };
};

const signals = (input: DescriptionCoverageInput): readonly string[] =>
  analyzeTitleQuality([input]).cases[0]?.findings.map((finding) => `${finding.code}:${finding.stage}`) ?? [];

test("señala la ausencia inequívoca del tipo de máquina aunque el título tenga tres palabras", () => {
  const input = record("5950", "Littium Ibiza Dogma", "Littium Ibiza Dogma", "Littium Ibiza Dogma", {
    brand: "Littium", model: "Ibiza Dogma",
    short: "La Littium Ibiza Dogma es una bicicleta eléctrica plegable y ligera para ciudad."
  });
  assert.deepEqual(signals(input), ["tipo_maquina_no_identificado:pendiente"]);
  assert.equal(analyzeTitleQuality([input]).cases[0]?.findings[0]?.evidence.includes("bicicleta eléctrica"), true);
});

test("reconoce carencia en título publicado que la preparación corrige sin publicar", () => {
  const input = record("CC1535", "SOCAGE IVECO 35S14", "SOCAGE IVECO 35S14", "Camión cesta SOCAGE IVECO 35S14", {
    brand: "Iveco Socage", model: "35S14", long: "Los Camiones Cesta permiten trabajar en altura."
  });
  const report = analyzeTitleQuality([input]);
  assert.deepEqual(signals(input), ["tipo_maquina_no_identificado:resuelto_preparacion"]);
  assert.equal(report.totals.resolved, 1);
  assert.equal(report.cases[0]?.publishedTitle, "SOCAGE IVECO 35S14");
  assert.equal(report.cases[0]?.preparedTitle, "Camión cesta SOCAGE IVECO 35S14");
});

test("detecta redacción, sufijos y magnitudes repetidas sin marcar modelos iguales como duplicados", () => {
  const inputs = [
    record("6901", null, "Plataformas articulada diésel 16M SNORKEL A46JRT",
      "Plataformas articulada diésel 16M SNORKEL A46JRT", { brand: "SNORKEL", model: "A46JRT" }),
    record("6912", null, "Plataformas articulada diésel 16M SNORKEL A46JRT",
      "Plataformas articulada diésel 16M SNORKEL A46JRT", { brand: "SNORKEL", model: "A46JRT" }),
    record("6607", null, "GENIE Z45/25 | Plataforma Articulada Diésel 16M | GAM Online",
      "GENIE Z45/25 | Plataforma Articulada Diésel 16M", { brand: "GENIE", model: "Z45/25J" }),
    record("M055", null, "Oil & Steel SCORPION 1812 CAMION CESTA 18 MT TELESCOPICO 18 MT",
      "Oil & Steel SCORPION 1812 CAMION CESTA 18 MT TELESCOPICO 18 MT")
  ];
  const report = analyzeTitleQuality(inputs);
  assert.equal(report.totals.products, 4);
  assert.equal(report.totals.affected, 4);
  assert.deepEqual(report.cases.filter((item) => item.reference === "6901" || item.reference === "6912")
    .map((item) => item.findings.map((finding) => finding.code)),
  [["redaccion_incoherente"], ["redaccion_incoherente"]]);
  assert.ok(report.cases.find((item) => item.reference === "6607")?.findings.some((item) =>
    item.code === "residuo_portal" && item.stage === "resuelto_preparacion"));
  assert.ok(report.cases.find((item) => item.reference === "M055")?.findings.some((item) =>
    item.code === "magnitud_repetida"));
});

test("no presume que cualquier descripción o identidad reconstruida acredita un tipo o modelo", () => {
  const input = record("1", "LGMG SS0507E", "LGMG SS0507E", "LGMG SS0507E", {
    brand: "LGMG", model: "SS0507E", long: "Plataforma de tijera eléctrica para interior.",
    origin: "reconstruccion_publicada"
  });
  assert.equal(analyzeTitleQuality([input]).totals.affected, 0);
  assert.equal(analyzeTitleQuality([record("2", "LGMG SS0507E", "LGMG SS0507E", "LGMG SS0507E",
    { brand: "LGMG", model: "SS0507E" })]).totals.affected, 0);
});

test("evita falsos positivos cuando el campo modelo o marca contradice el título y las descripciones", () => {
  const unreliableModel = record("2020", "Carretilla elevadora Hyster E2.0XN", "Carretilla elevadora Hyster E2.0XN",
    "Carretilla elevadora Hyster E2.0XN", { brand: "Hyster", model: "E2.2XN",
      short: "Carretilla Hyster E2.0XN", long: "La Hyster E2.0XN se utiliza en almacén" });
  assert.deepEqual(signals(unreliableModel), []);
  const unreliableBrand = record("6852", "Apilador YALE S1.2", "Apilador YALE S1.2", "Apilador YALE S1.2", {
    brand: "HYSTER", model: "S1.2", short: "YALE S1.2 apilador eléctrico", long: "El YALE S1.2 es un apilador" });
  assert.deepEqual(signals(unreliableBrand), []);
});

test("mantiene alertas de modelos o marcas respaldados por las dos descripciones originales", () => {
  const wrongModel = record("6274", "Hyster H12XD-12", "Hyster H12XD-12", "Hyster H14XD-12", {
    brand: "Hyster", model: "H14XD-12", short: "Hyster H14XD-12", long: "Carretilla Hyster H14XD-12" });
  assert.deepEqual(signals(wrongModel), ["modelo_no_identificado:resuelto_preparacion"]);
  const missingBrand = record("2252", "Transpaleta eléctrica MP25HD", "Transpaleta eléctrica MP25HD",
    "Transpaleta eléctrica YALE MP25HD", { brand: "YALE", model: "MP25HD",
      short: "Yale MP25HD transpaleta", long: "La Yale MP25HD es una transpaleta" });
  assert.deepEqual(signals(missingBrand), ["marca_no_identificada:resuelto_preparacion"]);
});

test("reconoce títulos vacíos, aparición de nuevas señales y protege la identidad", () => {
  const input = record("vacío", "Plataforma articulada GENIE", null, "Plataforma articulada GENIE", { brand: "GENIE" });
  assert.deepEqual(signals(input), ["titulo_ausente:resuelto_preparacion"]);
  const newIssue = record("nuevo", "Plataforma articulada GENIE", "Plataforma articulada GENIE", "", { brand: "GENIE" });
  assert.deepEqual(signals(newIssue), ["titulo_ausente:aparecido_preparacion"]);
  assert.throws(() => analyzeTitleQuality([input, input]), /Identidad duplicada/);
});

test("no atribuye al título el error de una descripción original contradicha por la ficha técnica", () => {
  const title = "Toyota 6FBRE14 CARRETILLA ELEVADORA RETRACTIL 1350 KG";
  const input = record("M547-2372", title, title, title, {
    brand: "Toyota", model: "6FBRE14",
    long: "Ref. MER1123 TRANSPALET ELECTRICO 1350 KG ALTURA DE TRABAJO 6.500 mm TOYOTA 6FBRE14",
    specs: { "Título adicional": "CARRETILLA ELEVADORA RETRACTIL 1350 KG", Marca: "Toyota", Modelo: "6FBRE14" }
  });
  assert.deepEqual(signals(input), []);
  const missing = record("otro", "Toyota 6FBRE14", "Toyota 6FBRE14", "Toyota 6FBRE14", {
    long: "Ref. MER1123 TRANSPALET ELECTRICO 1350 KG TOYOTA 6FBRE14",
    specs: { "Título adicional": "TRANSPALET ELECTRICO 1350 KG" }
  });
  assert.deepEqual(signals(missing), ["tipo_maquina_no_identificado:pendiente"]);
  const uncertain = record("incompleto", "Toyota 6FBRE14", "Toyota 6FBRE14", "Toyota 6FBRE14", {
    long: "Ref. MER1123 TRANSPALET ELECTRICO 1350 KG TOYOTA 6FBRE14",
    specs: { "Título adicional": "CARRETILLA ELEVADORA RETRACTIL 1350 KG" }
  });
  assert.deepEqual(signals(uncertain), []);
});
