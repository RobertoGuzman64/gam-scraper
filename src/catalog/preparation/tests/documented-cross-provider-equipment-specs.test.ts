import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { gamTechnicalReviewReferences } from "./support/phase1-reviewed-identities.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { analyzeTechnicalDensity } from "../../diagnostics/technical-density.js";
import { recoverGamDocumentedMobilityAndAccessSpecs } from "../evidence/providers/gam/verified-models/documented-mobility-and-access-specs.js";
import { recoverMercaelevaDocumentedTransportAndAccessSpecs } from "../evidence/providers/mercaeleva/documented-transport-and-access-specs.js";
import { recoverGomarizDocumentedRenaultPremiumSpecs } from "../evidence/providers/gomariz/documented-renault-premium-specs.js";

const expected: Readonly<Record<string, Readonly<Record<string, SpecsMap>>>> = {
  "gam": {
    "2364": {
      "Peso neto del portapaneles": "4,2 kg",
      "Dimensiones del panel admitido": "1500 x 750 x 120 mm",
      "Número máximo de soportes por Leonardo HD": "3",
      "Montaje del soporte": "Sin herramientas"
    },
    "5949": {
      "Potencia del motor": "250 W",
      "Velocidad máxima de asistencia": "25 km/h",
      "Carga máxima admitida": "120 kg",
      "Peso con batería": "20,5 kg",
      "Tensión nominal del motor": "36 V"
    },
    "6623": {
      "Número de ejes": "3",
      "Ejes direccionales": "Los dos traseros",
      "Primer eje elevable": "Sí",
      "Piso móvil": "Sí"
    },
    "6807": {
      "Par motor máximo del modelo": "109 Nm",
      "Velocidad máxima del modelo": "139 km/h",
      "Peso en orden de marcha del modelo": "187 kg",
      "Altura del asiento": "843 mm",
      "Capacidad nominal de batería": "14,4 kWh"
    },
    "6358": {
      "Carga vertical estática admisible del KRV20": "100 kg",
      "Sistema de frenado del KRV20": "Por inercia",
      "Freno de estacionamiento del KRV20": "Accionamiento manual"
    },
    "6367": {
      "Carga vertical estática admisible del KRV20": "100 kg",
      "Sistema de frenado del KRV20": "Por inercia",
      "Freno de estacionamiento del KRV20": "Accionamiento manual"
    },
    "6688": {
      "Tipo de tracción": "Trasera",
      "Transmisión del modelo": "Manual de 5 velocidades",
      "Distancia entre ejes del modelo": "2250 mm"
    },
    "6689": {
      "Cilindrada del motor": "2598 cm³",
      "Potencia máxima del motor": "150 CV",
      "Par motor máximo": "225 Nm",
      "Tipo de tracción": "Delantera"
    },
    "6690": {
      "Cilindrada del motor": "1288 cm³",
      "Potencia máxima DIN": "74,5 CV",
      "Caja de cambios": "Manual de 4 velocidades",
      "Tipo de tracción": "Delantera"
    },
    "4650": {
      "Alcance lateral indicado para B-LIFT 18": "12,5 m",
      "Rotación de torreta": "±320°",
      "Dimensiones de cesta": "1400 x 700 x 1100 mm"
    },
    "4847": {
      "Alcance lateral del modelo": "8,2 m",
      "Rotación de torreta": "±310°",
      "Aislamiento eléctrico declarado del brazo": "Hasta 1000 V"
    },
    "5918": {
      "Capacidad de carga anunciada, conductor incluido": "Hasta 240 kg",
      "Volumen de carga anunciado": "Hasta 1200 L",
      "Número de plazas del modelo": "1"
    },
    "2145": {
      "Centro de carga del modelo": "600 mm"
    },
    "4846": {
      "Alcance lateral máximo del modelo": "8,2 m"
    },
    "5254": {
      "Tipo de tracción": "4x4 conectable",
      "Caja de cambios del modelo": "Manual de 4 velocidades",
      "Distancia entre ejes del modelo": "2769 mm"
    }
  },
  "mercaeleva": {
    "M294-4678": {
      "Longitud exterior anunciada": "6 m",
      "Anchura exterior anunciada": "2,35 m",
      "Climatización instalada según anuncio": "Aire acondicionado",
      "Ubicación de la puerta": "Lado corto"
    },
    "M928-9933": {
      "Configuración de ejes declarada": "4x2",
      "Masa máxima autorizada declarada": "12.000 kg",
      "Arquitectura del motor declarada": "6 cilindros en línea"
    },
    "M028-8481": {
      "Capacidad nominal de la plataforma estándar": "227 kg",
      "Anchura de la máquina": "0,75 m"
    },
    "M582-1882": {
      "Combustible del motor": "Diésel"
    }
  },
  "gomariz": {
    "1011JFB": {
      "Potencia nominal del modelo": "320 CV",
      "Familia de motor del modelo": "Renault dCi 11"
    }
  }
};
const providers = ["gam", "gomariz", "mercaeleva"] as const;
const recover = {
  gam: recoverGamDocumentedMobilityAndAccessSpecs,
  gomariz: recoverGomarizDocumentedRenaultPremiumSpecs,
  mercaeleva: recoverMercaelevaDocumentedTransportAndAccessSpecs
};
const catalogs = await Promise.all(providers.map(async (providerId) => ({
  providerId,
  products: (await readCanonicalCatalog(`catalogs/providers/${providerId}/original/scrape-${providerId}-catalog.json`)).products
})));

test("evidencia cruzada entre proveedores: incorporar solo las prestaciones documentadas de las 20 referencias", () => {
  let count = 0;
  let additions = 0;
  for (const { providerId, products } of catalogs) {
    const referenceSpecs = expected[providerId];
    assert.ok(referenceSpecs);
    for (const record of products) {
      const original = record.specs ?? {};
      const snapshot = JSON.stringify(record);
      const actual = recover[providerId](record, original);
      const selected: SpecsMap | undefined = record.reference ? referenceSpecs[record.reference] : undefined;
      if (!selected) {
        assert.equal(actual, original, `${providerId}:${record.reference}`);
        continue;
      }
      assert.deepEqual(actual, { ...original, ...selected }, `${providerId}:${record.reference}`);
      const prepared = prepareSourceProduct(record);
      assert.equal(prepared.status, providerId === "gam" && gamTechnicalReviewReferences.has(record.reference ?? "") ? "review" : "ready", `${providerId}:${record.reference}`);
      for (const [key, value] of Object.entries(selected)) {
        assert.ok(!(key in original), `${providerId}:${record.reference}:${key}`);
        assert.equal(prepared.product.spec[key], value, `${providerId}:${record.reference}:${key}`);
        additions++;
      }
      assert.equal(JSON.stringify(record), snapshot);
      count++;
    }
  }
  assert.equal(count, 20);
  assert.equal(additions, 61);
});

test("evidencia cruzada entre proveedores: no propagar especificaciones a originales modificados ni sobrescribir valores", () => {
  for (const { providerId, products } of catalogs) {
    for (const record of products) {
      if (!record.reference || !expected[providerId]?.[record.reference]) continue;
      const original = record.specs ?? {};
      const key = Object.keys(expected[providerId][record.reference] ?? {})[0];
      assert.ok(key, `${providerId}:${record.reference}`);
      const variants: readonly ProductRecord[] = [
        { ...record, providerId: providerId === "gam" ? "gomariz" : "gam" },
        { ...record, categoryKey: "otra-categoria" },
        { ...record, reference: `${record.reference}-variante` },
        { ...record, url: `${record.url}?variant=1` },
        { ...record, title: `${record.title} variante` },
        { ...record, brand: "Marca diferente" },
        { ...record, model: "Modelo diferente" },
        { ...record, year: "2099" },
        { ...record, longDescription: `${record.longDescription} variante` },
        { ...record, specs: { ...original, "Especificación adicional": "Alterada" } }
      ];
      for (const [index, variant] of variants.entries()) {
        const input = variant.specs ?? {};
        assert.equal(recover[providerId](variant, input), input, `${providerId}:${record.reference}:${index}`);
      }
      const occupied = { ...original, [key]: "Ya acreditado" };
      assert.equal(recover[providerId](record, occupied), occupied, `${providerId}:${record.reference}`);
    }
  }
});

test("evidencia cruzada entre proveedores: las 20 fichas salen de alta y media sin alterar los umbrales", () => {
  const before = [];
  const after = [];
  for (const { providerId, products } of catalogs) {
    for (const record of products) {
      const selected = record.reference ? expected[providerId]?.[record.reference] : undefined;
      if (!selected) continue;
      const result = prepareSourceProduct(record);
      assert.equal(result.status, providerId === "gam" && gamTechnicalReviewReferences.has(record.reference ?? "") ? "review" : "ready");
      const product = result.product;
      before.push({ ...product, spec: Object.fromEntries(Object.entries(product.spec).filter(([key]) => !(key in selected))) });
      after.push(product);
    }
  }
  assert.equal(before.length, 20);
  const base = analyzeTechnicalDensity(before);
  const result = analyzeTechnicalDensity(after);
  assert.equal(base.totals.sparse + base.totals.medium, 20);
  assert.deepEqual([result.totals.sparse, result.totals.medium], [0, 1]);
  assert.deepEqual(result.mediumCases.map((item) => `${item.providerId}:${item.reference}`), ["gam:6688"]);
});
