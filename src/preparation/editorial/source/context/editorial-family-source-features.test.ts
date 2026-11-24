import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveSourceEditorialClaims } from "../../claims/editorial-source-claims.js";
import { cleanAuthenticatedSourceEditorial } from "../../writing/editorial-text-hygiene.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledGomarizPlatform, controlledMercaelevaPlatform
} from "../../core/editorial-contract-records.js";

const general = "La ficha técnica declara características de la máquina anunciada.";

const platform = (record: ProductRecord): ProductRecord => ({
  ...record,
  longDescription: "Las tijeras eléctricas tienen plataforma extensible y ruedas antihuellas. Pueden incorporar estabilizadores según configuración."
});

test("las características de familia son reutilizables entre proveedores sin atribuir equipamiento a una unidad", () => {
  for (const sample of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const record = platform(sample);
    const before = JSON.stringify(record);
    const result = resolveSourceEditorialClaims(record, record, general) ?? "";
    assert.match(result, /plataforma extensible/u);
    assert.match(result, /ruedas antihuellas/u);
    assert.match(result, /su presencia y configuración deben comprobarse para esta unidad/u);
    assert.doesNotMatch(result, /estabilizadores/u);
    assert.equal(JSON.stringify(record), before);
  }
});

test("la procedencia, la familia y las contradicciones impiden extrapolar características", () => {
  const original = platform(controlledGomarizPlatform());
  for (const changed of [
    { ...original, providerId: "gam" },
    { ...original, reference: "OTRA-REFERENCIA" },
    { ...original, url: "https://www.gomarizrent.com/producto/otra-variacion/" },
    { ...original, model: "OTRA-VARIANTE" },
    { ...original, condition: "Nuevo" as const }
  ]) assert.equal(resolveSourceEditorialClaims(original, changed, general), general);

  const ambiguous = { ...original, longDescription: "Se pueden equipar ruedas antihuellas como opción y plataforma extensible según la versión." };
  assert.equal(resolveSourceEditorialClaims(ambiguous, ambiguous, general), general);
  const negated = { ...original, longDescription: "No incluye plataforma extensible ni ruedas antihuellas." };
  assert.equal(resolveSourceEditorialClaims(negated, negated, general), general);
  const conflictingMotor = { ...original, longDescription: "Las tijeras diésel tienen plataforma extensible y ruedas antihuellas." };
  assert.equal(resolveSourceEditorialClaims(conflictingMotor, conflictingMotor, general), general);
});

test("la fuente respalda otras características de limpieza y manutención en el dominio común", () => {
  const forklift: ProductRecord = {
    ...controlledGamForklift(),
    longDescription: "La carretilla incorpora desplazamiento lateral de horquillas."
  };
  assert.match(resolveSourceEditorialClaims(forklift, forklift, general) ?? "", /desplazamiento lateral/u);
  assert.equal(resolveSourceEditorialClaims(forklift, forklift,
    `${general} El desplazamiento lateral está documentado.`),
  `${general} El desplazamiento lateral está documentado.`);

  const sweeper: ProductRecord = {
    ...controlledGamForklift(),
    title: "Barredora MARCA MODELO10",
    categoryName: "Barredoras industriales",
    url: "https://online.gamrentals.com/es/barredoras-industriales/CONTROL-03-barredora",
    longDescription: "La barredora incluye control de polvo y filtro HEPA, con conductor sentado.",
    specs: { Marca: "MARCA", Modelo: "MODELO10", "Anchura limpieza": "1,2 m" }
  };
  const report = resolveSourceEditorialClaims(sweeper, sweeper, general) ?? "";
  assert.match(report, /control de polvo/u);
  assert.match(report, /filtración HEPA/u);
  assert.match(report, /operario sentado/u);
});

test("la preparación reutiliza las características con sus límites sin añadir texto si hay conocimiento firmado", () => {
  const record = platform(controlledGomarizPlatform());
  const result = prepareSourceProduct(record).product.description_general ?? "";
  assert.match(result, /plataforma extensible/u);
  assert.match(result, /deben comprobarse para esta unidad/u);
  const other: ProductRecord = { ...record, reference: "CONTROL-OTRA", model: "MODELO11", title: "Plataforma de tijera eléctrica MARCA MODELO11" };
  assert.doesNotMatch(prepareSourceProduct({ ...other, longDescription: null }).product.description_general ?? "", /ruedas antihuellas/u);
});

test("las introducciones conversacionales son higienizadas con identidad acreditada, sin afectar contenido ajeno", () => {
  const text = `Claro. La plataforma de tijera MARCA MODELO10 declara las prestaciones de la ficha técnica para trabajos de acceso en altura y mantenimiento industrial.`;
  const source = { ...controlledGomarizPlatform(), longDescription: text };
  const cleaned = cleanAuthenticatedSourceEditorial(source, null, text);
  assert.equal(cleaned.general, text.slice("Claro. ".length));
  assert.equal(cleanAuthenticatedSourceEditorial(source, null, "Claro. Información genérica.").general,
    "Claro. Información genérica.");
  assert.equal(cleanAuthenticatedSourceEditorial({ ...source, title: "Equipo distinto" }, null, text).general, text);
});


test("el trabajo en espacios reducidos se recupera desde la fuente verificada sin inferir equipamiento", () => {
  for (const original of [controlledGamForklift(), controlledGomarizForklift()]) {
    const source: ProductRecord = {
      ...original,
      longDescription: "El proveedor recomienda esta carretilla para operaciones en espacios reducidos."
    };
    const originalSnapshot = JSON.stringify(source);
    const claimed = resolveSourceEditorialClaims(source, source, general) ?? "";
    assert.match(claimed, /trabajo en espacios reducidos como ámbito de aplicación/u);
    assert.match(claimed, /contrastar las dimensiones y maniobras/u);
    assert.doesNotMatch(claimed, /incluye|incorpora|instalado/iu);
    assert.equal(JSON.stringify(source), originalSnapshot);
    const prepared = prepareSourceProduct(source).product.description_general ?? "";
    assert.match(prepared, /trabajo en espacios reducidos como ámbito de aplicación/u);
  }
});

test("el contexto de maniobra no se atribuye a variantes, proveedores ni declaraciones opcionales", () => {
  const source: ProductRecord = {
    ...controlledGamForklift(),
    longDescription: "La carretilla está concebida para espacios reducidos."
  };
  for (const prepared of [
    { ...source, reference: "CONTROL-OTRA" },
    { ...source, url: "https://online.gamrentals.com/es/carretillas/CONTROL-04-carretilla-elevadora" },
    { ...source, model: "MODELO11" },
    { ...source, providerId: "gomariz" },
    { ...source, condition: "Nuevo" as const }
  ]) assert.equal(resolveSourceEditorialClaims(source, prepared, general), general);

  for (const description of [
    "La carretilla puede trabajar en espacios reducidos según la versión.",
    "La carretilla no es adecuada para espacios reducidos.",
    "La carretilla se ofrece para espacios reducidos como opción."
  ]) {
    const conditional = { ...source, longDescription: description };
    assert.equal(resolveSourceEditorialClaims(conditional, conditional, general), general);
  }
  assert.equal(resolveSourceEditorialClaims(source, source,
    `${general} Su utilización en espacios reducidos ya figura documentada.`),
  `${general} Su utilización en espacios reducidos ya figura documentada.`);
});

test("los ámbitos de uso documentados de transpaletas complementan la composición sin inferir accesorios", () => {
  const basis: ProductRecord = {
    ...controlledGamForklift(),
    title: "Transpaleta MARCA MODELO10",
    categoryName: "Transpaletas",
    url: "https://online.gamrentals.com/es/transpaletas/CONTROL-03-transpaleta",
    specs: { Marca: "MARCA", Modelo: "MODELO10", "Capacidad de carga (kg)": "1500 kg" }
  };
  const samples = [
    ["La transpaleta está recomendada para la industria alimentaria por las necesidades de higiene rigurosa.", /exigencias de higiene/u],
    ["El equipo dispone de timón ergonómico para mejorar las condiciones de trabajo.", /ergonomía en el manejo/u],
    ["El modelo permite el pesaje en áreas de almacenamiento mediante cuatro células de peso.", /pesaje de mercancías/u],
    ["La inclinación de hasta 90º facilita la carga de cajas en el almacén.", /inclinación de hasta 90/u],
    ["Las baterías de litio ofrecen operaciones de recarga rápidas.", /batería de litio/u],
    ["El fabricante destaca la reducción de ruido en espacios compartidos.", /reducción de ruido/u],
    ["La centralización de todos los mandos protege al operario.", /centralización de mandos/u],
    ["Indicada para almacenes, talleres y otros entornos industriales.", /almacenes y talleres/u]
  ] as const;
  for (const [description, pattern] of samples) {
    const source = { ...basis, longDescription: description };
    const result = resolveSourceEditorialClaims(source, source, general) ?? "";
    assert.match(result, pattern, description);
    assert.match(prepareSourceProduct(source).product.description_general ?? "", pattern, description);
  }
});

test("los ámbitos de manutención no saltan entre variantes ni convierten opciones en afirmaciones", () => {
  const original: ProductRecord = {
    ...controlledGamForklift(),
    title: "Transpaleta MARCA MODELO10",
    categoryName: "Transpaletas",
    url: "https://online.gamrentals.com/es/transpaletas/CONTROL-03-transpaleta",
    specs: { Marca: "MARCA", Modelo: "MODELO10", "Capacidad de carga (kg)": "1500 kg" },
    longDescription: "El fabricante describe un timón ergonómico para el manejo de cargas."
  };
  for (const changed of [
    { ...original, reference: "OTRA-UNIDAD" },
    { ...original, url: "https://online.gamrentals.com/es/transpaletas/OTRA-UNIDAD-transpaleta" },
    { ...original, model: "MODELO11" },
    { ...original, providerId: "gomariz" },
    { ...original, condition: "Nuevo" as const }
  ]) assert.equal(resolveSourceEditorialClaims(original, changed, general), general);
  for (const description of [
    "La versión opcional incluye timón ergonómico.",
    "Este modelo no incorpora timón ergonómico.",
    "El timón ergonómico se ofrece bajo pedido."
  ]) {
    const source = { ...original, longDescription: description };
    assert.equal(resolveSourceEditorialClaims(source, source, general), general);
  }
  assert.equal(resolveSourceEditorialClaims(original, original, `${general} La ergonomía del equipo ya está documentada.`),
    `${general} La ergonomía del equipo ya está documentada.`);
});

test("los sistemas de movilidad, nivelación y descenso documentados se recuperan para plataformas compatibles", () => {
  for (const original of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const record: ProductRecord = {
      ...original,
      longDescription: "La plataforma incorpora tracción 4x4, nivelación automática, descenso manual y protección contra sobrecarga."
    };
    const before = JSON.stringify(record);
    const result = resolveSourceEditorialClaims(record, record, general) ?? "";
    for (const evidence of ["tracción a las cuatro ruedas", "nivelación automática", "descenso manual", "protección contra sobrecarga"]) {
      assert.match(result, new RegExp(evidence, "u"));
      assert.match(prepareSourceProduct(record).product.description_general ?? "", new RegExp(evidence, "u"));
    }
    assert.match(result, /su presencia y configuración deben comprobarse para esta unidad/u);
    assert.equal(JSON.stringify(record), before);
  }
});

test("la recuperación distingue plataformas articuladas, telescópicas y manipuladores", () => {
  const basis = controlledGamForklift();
  const examples: readonly { readonly record: ProductRecord; readonly expected: RegExp }[] = [
    {
      record: {
        ...basis,
        title: "Plataforma articulada MARCA MODELO10",
        categoryName: "Plataformas articuladas",
        longDescription: "La plataforma tiene nivelación automática y sistema de descenso de emergencia."
      },
      expected: /nivelación automática.*descenso de emergencia/u
    },
    {
      record: {
        ...basis,
        title: "Plataforma telescópica MARCA MODELO10",
        categoryName: "Plataformas telescópicas",
        longDescription: "La plataforma cuenta con tracción total 4x4 y descenso manual."
      },
      expected: /tracción a las cuatro ruedas.*descenso manual/u
    },
    {
      record: {
        ...basis,
        title: "Manipulador telescópico MARCA MODELO10",
        categoryName: "Manipuladores telescópicos",
        longDescription: "El manipulador telescópico incorpora tracción en las cuatro ruedas."
      },
      expected: /tracción a las cuatro ruedas/u
    }
  ];
  for (const { record, expected } of examples) {
    assert.match(resolveSourceEditorialClaims(record, record, general) ?? "", expected);
  }
});

test("los sistemas de trabajo no se heredan de otra unidad, variante o proveedor ni de opciones", () => {
  const source: ProductRecord = {
    ...controlledGomarizPlatform(),
    longDescription: "La plataforma incorpora tracción a las cuatro ruedas y sistema de descenso manual."
  };
  const mismatches: readonly ProductRecord[] = [
    { ...source, reference: "CONTROL-OTRA" },
    { ...source, providerId: "gam" },
    { ...source, url: "https://www.gomarizrent.com/producto/otra-maquina/" },
    { ...source, brand: "OTRA" },
    { ...source, model: "MODELO11" },
    { ...source, condition: "Nuevo" },
    { ...source, title: "Carretilla elevadora MARCA MODELO10" }
  ];
  for (const mismatch of mismatches) {
    assert.equal(resolveSourceEditorialClaims(source, mismatch, general), general);
  }
  for (const original of [
    "La plataforma puede incorporar tracción 4x4 y descenso manual según la versión.",
    "La plataforma no incluye tracción 4x4 ni descenso manual.",
    "La plataforma ofrece nivelación automática como opción y protección contra sobrecarga bajo pedido."
  ]) {
    const record = { ...source, longDescription: original };
    assert.equal(resolveSourceEditorialClaims(record, record, general), general);
  }
  assert.equal(resolveSourceEditorialClaims(source, source,
    `${general} El proveedor menciona tracción a las cuatro ruedas y descenso manual.`),
  `${general} El proveedor menciona tracción a las cuatro ruedas y descenso manual.`);
  const forklift = {
    ...controlledGamForklift(),
    longDescription: "La carretilla cuenta con tracción 4x4 y descenso manual."
  };
  assert.equal(resolveSourceEditorialClaims(forklift, forklift, general), general);
  const emergency = {
    ...source,
    longDescription: "El equipo dispone de descenso manual de emergencia."
  };
  const emergencyGeneral = resolveSourceEditorialClaims(emergency, emergency, general) ?? "";
  assert.match(emergencyGeneral, /descenso de emergencia/u);
  assert.doesNotMatch(emergencyGeneral, /descenso manual y descenso de emergencia/u);
});
