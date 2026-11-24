import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ProductTechnicalProvenance, TechnicalSpecEvidence } from "../../../contracts/technical-provenance.js";
import { technicalDocumentClaimSha256 } from "../../../contracts/technical-provenance.js";
import { originalRecordFingerprint } from "../../../catalog/identity-fingerprint.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { resolvePreparedEditorial } from "../core/prepared-editorial.js";
import { captureSourceEditorialEvidence } from "./source-editorial-evidence.js";
import { matchesTechnicalDocumentVerification } from "../../../contracts/technical-provenance.js";
import { resolveSourcedTechnicalContext } from "../measurements/sourced/editorial-sourced-technical-context.js";
import { resolveSourcedConciseShort } from "../writing/editorial-sourced-concise-short.js";
import { resolveSourcedLongEvidence, resolveReviewedModelGeneral } from "./editorial-sourced-long-evidence.js";
import { controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaPlatform, controlledMercaelevaForklift } from "../core/editorial-contract-records.js";

const technicalSource = (): ProductRecord => ({
  ...controlledGamForklift(),
  longDescription: "Carretilla destinada a tareas de almacén y desplazamiento de mercancías.",
  shortDescription: null
});

const genericGeneral = "La ficha presenta una carretilla elevadora destinada al movimiento interno de mercancías.";

test("recupera únicamente magnitudes técnicas corroboradas por la misma ficha original", () => {
  const source = technicalSource();
  const before = JSON.stringify(source);
  const result = resolveSourcedTechnicalContext(source, source, genericGeneral, true) ?? "";
  assert.match(result, /altura de elevación de 4,5 m/u);
  assert.match(result, /capacidad de carga declarada de 2\.500 kg/u);
  assert.match(result, /esta misma referencia, identificada como MARCA MODELO10, constan además/u);
  assert.equal(JSON.stringify(source), before);
  assert.equal(resolveSourcedTechnicalContext(source, source, result, true), null);
});

test("reutiliza la descripción corta acreditada solo para el modelo original y si aporta información adicional", () => {
  const source: ProductRecord = {
    ...technicalSource(),
    shortDescription: "La carretilla MARCA MODELO10 se destina al desplazamiento de mercancías en almacenes y centros de distribución. Su diseño facilita tareas de manutención, movimiento interno y preparación logística, y permite planificar los recorridos en las instalaciones conforme a las operaciones de cada centro de trabajo."
  };
  const result = resolveSourcedTechnicalContext(source, source, genericGeneral, true) ?? "";
  assert.match(result, /descripción breve del mismo anuncio precisa/u);
  assert.match(result, /MARCA MODELO10/u);
  assert.doesNotMatch(result, /identificada como/u);
  assert.equal(resolveSourcedTechnicalContext({ ...source, model: "MODELO11" }, source, genericGeneral, true), null);
});

test("impide mezclar magnitudes de otras unidades, modelos o proveedores", () => {
  const source = technicalSource();
  const changed: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "CONTROL-OTRA" },
    { ...source, url: "https://online.gamrentals.com/es/carretillas/OTRA" },
    { ...source, brand: "OTRA" },
    { ...source, model: "MODELO11", title: "Carretilla elevadora MARCA MODELO11 2500 kg" },
    { ...source, condition: "Nuevo" },
    { ...source, specs: { "Capacidad de carga (kg)": "1800 kg", "Altura de elevación (mm)": "3000 mm" } }
  ];
  for (const candidate of changed) {
    assert.equal(resolveSourcedTechnicalContext(source, candidate, genericGeneral, source.providerId === candidate.providerId), null);
  }
  assert.equal(resolveSourcedTechnicalContext(source, source, genericGeneral, false), null);
  assert.equal(resolveSourcedTechnicalContext({ ...source, longDescription: null }, source, genericGeneral, true), null);
});

test("recupera una única cota exterior con evidencia propia sin inventar accesorios", () => {
  const source: ProductRecord = {
    ...controlledGomarizPlatform(),
    longDescription: "Máquina para realizar trabajos de limpieza profesional sobre pavimentos y superficies continuas.",
    specs: { Altura: "1.35 m" }
  };
  const description = "Esta máquina se destina a trabajos profesionales de mantenimiento de superficies en instalaciones de distinto tamaño. La información existente permite identificar la familia, el fabricante y la unidad concreta, aunque no acredita equipamiento ni accesorios instalados. Deben verificarse las condiciones del recinto para cada operación.";
  const result = resolveSourcedTechnicalContext(source, source, description, true) ?? "";
  assert.match(result, /altura exterior de 1,35 m/u);
  assert.doesNotMatch(result, /incluye accesorios|equipa elementos/u);
  assert.equal(resolveSourcedTechnicalContext(source, { ...source, specs: { Altura: "1.5 m" } }, description, true), null);
});

const generatorSource = (): ProductRecord => ({
  ...controlledGamForklift(),
  title: "Grupo electrógeno MARCA MODELO10",
  url: "https://online.gamrentals.com/es/grupos-electrogenos/CONTROL-03-grupo-electrogeno",
  longDescription: `La bancada se construye con perfil de acero y soportes antivibración dimensionados para el conjunto. La carrocería es insonora y está formada por paneles modulares fijados sobre la estructura de protección. Dispone de puertas laterales para las revisiones y de elementos de cierre que permiten las operaciones de mantenimiento del generador. El proveedor describe las soluciones constructivas del modelo sin acreditar el estado individual de cada pieza ni sustituir la comprobación de la máquina anunciada.`,
  specs: { Marca: "MARCA", Modelo: "MODELO10", "Peso": "1200 kg" }
});

const generatorGeneral = "La ficha técnica del grupo electrógeno MARCA MODELO10 menciona sus principales dimensiones y su utilización para generación autónoma.";

test("recupera sistemas constructivos documentados en cualquier grupo compatible, sin afirmar instalación", () => {
  const source = generatorSource();
  const result = resolveSourcedLongEvidence(source, source, generatorGeneral) ?? "";
  assert.match(result, /carrocería insonora formada por paneles modulares/u);
  assert.match(result, /soportes antivibración/u);
  assert.match(result, /debe contrastarse/u);
  assert.equal(resolveSourcedLongEvidence(source, source, result), null);
});

test("rechaza características opcionales, identidad distinta y familias incompatibles", () => {
  const source = generatorSource();
  const optional: ProductRecord = {
    ...source,
    longDescription: source.longDescription?.replace("La carrocería es insonora", "La carrocería es insonora opcional") ?? null
  };
  assert.equal(resolveSourcedLongEvidence(optional, optional, generatorGeneral), null);
  const alternatives: readonly ProductRecord[] = [
    { ...source, reference: "OTRA-UNIDAD" },
    { ...source, providerId: "gomariz" },
    { ...source, model: "MODELO11", title: "Grupo electrógeno MARCA MODELO11" },
    { ...source, condition: "Nuevo" },
    { ...source, title: "Carretilla elevadora MARCA MODELO10" }
  ];
  for (const candidate of alternatives) assert.equal(resolveSourcedLongEvidence(source, candidate, generatorGeneral), null);
});

const shortSource = (): ProductRecord => ({
  ...controlledGamForklift(),
  shortDescription: "La carretilla MARCA MODELO10 sirve para transportar palés en operaciones logísticas de almacén y centros de distribución. Se presenta como una solución de manutención capaz de mejorar la organización de recorridos y movimientos de mercancías en instalaciones de distintos tamaños. La información de origen describe también su aplicación en operaciones de organización del trabajo y abastecimiento interior de los almacenes."
});

test("reduce la corta repetitiva conservando las afirmaciones técnicas que no constan en la general", () => {
  const source = shortSource();
  const shortened = resolveSourcedConciseShort(source, source, source.shortDescription, genericGeneral, true) ?? "";
  assert.match(shortened, /MARCA MODELO10/u);
  assert.ok(shortened.split(/\s+/u).length < 45);
  assert.ok(shortened.length < (source.shortDescription?.length ?? 0));
  const protectedNumber = `${source.shortDescription} La capacidad es de 3.500 kg.`;
  const numeric: ProductRecord = { ...source, shortDescription: protectedNumber };
  assert.equal(resolveSourcedConciseShort(numeric, numeric, protectedNumber, genericGeneral, true), null);
});

test("no comprime texto de origen diferente, unidades cruzadas ni variantes dudosas", () => {
  const source = shortSource();
  const variations: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "CONTROL-OTRA" },
    { ...source, model: "MODELO11", title: "Carretilla elevadora MARCA MODELO11 2500 kg" },
    { ...source, condition: "Nuevo" }
  ];
  for (const candidate of variations) {
    assert.equal(resolveSourcedConciseShort(source, candidate, source.shortDescription, genericGeneral, source.providerId === candidate.providerId), null);
  }
  assert.equal(resolveSourcedConciseShort(source, source, `${source.shortDescription} texto añadido`, genericGeneral, true), null);
  assert.equal(resolveSourcedConciseShort(source, source, source.shortDescription, null, true), null);
});

test("la atribución técnica requiere identidad corroborada en ambos registros", () => {
  const source = technicalSource();
  const ambiguous: ProductRecord = { ...source, title: "Carretilla MARCA MODELO11" };
  const result = resolveSourcedTechnicalContext(ambiguous, ambiguous, genericGeneral, true) ?? "";
  assert.match(result, /capacidad de carga declarada de 2\.500 kg/u);
  assert.doesNotMatch(result, /identificada como/u);
  const otherVariant = "La carretilla MARCA MODELO11 se destina a almacenes.";
  assert.doesNotMatch(resolveSourcedTechnicalContext(source, source, otherVariant, true) ?? "", /identificada como/u);
});

const reviewedFixture = (source: ProductRecord, field: string, value: string): TechnicalSpecEvidence => {
  const document = { url: "https://example.com/technical-sheet.pdf", brand: source.brand, model: source.model };
  const reviewedOn = "2026-01-01";
  const support = `${field}: ${value}`;
  return { field, value, mechanism: "src/preparation/technical/documented-technical-evidence.ts",
    scope: "model-document", document, sourceField: null, sourceValue: null,
    verification: { kind: "reviewed-model-fact", reviewedOn, support,
      claimSha256: technicalDocumentClaimSha256(document, field, value, reviewedOn, support) } };
};

const reviewedProvenance = (source: ProductRecord, entries: readonly TechnicalSpecEvidence[]): ProductTechnicalProvenance => ({
  originalRecordSha256: originalRecordFingerprint(source), entries
});

test("la acreditación documental de una prestación no altera la redacción cuando los hechos son idénticos", () => {
  for (const source of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const field = "Extensión de plataforma";
    const value = "0,9 m";
    const prepared: ProductRecord = { ...source, specs: { ...source.specs, [field]: value } };
    const claim = reviewedFixture(source, field, value);
    assert.ok(claim.document && claim.verification);
    assert.ok(matchesTechnicalDocumentVerification(claim.document, field, value, claim.verification));
    const provenance = reviewedProvenance(source, [claim]);
    const before = JSON.stringify({ source, prepared, provenance });
    const evidence = captureSourceEditorialEvidence(prepared);
    const plain = resolvePreparedEditorial(prepared, source, evidence, source);
    const accredited = resolvePreparedEditorial(prepared, source, evidence, source, provenance);
    assert.match(plain.preparedLong ?? "", /altura de trabajo de 10 m/u);
    assert.match(plain.preparedLong ?? "", /verificar la capacidad de cesta/u);
    assert.equal(prepared.specs?.[field], value);
    assert.equal(JSON.stringify({ source, prepared, provenance }), before);
    assert.deepEqual(accredited, plain, source.providerId);
  }
});

test("la recuperación acreditada conserva specs y procedencia sin narrar su acreditación en la preparación final", () => {
  const source: ProductRecord = {
    ...controlledGomarizPlatform(), brand: "SNORKEL", model: "S3219E", year: "2017",
    url: "https://www.gomarizrent.com/producto/snorkel-s3219e-control/",
    title: "Plataforma de tijera eléctrica SNORKEL S3219E",
    longDescription: "Plataforma de tijera eléctrica SNORKEL S3219E para trabajos en altura.",
    specs: { Marca: "SNORKEL", Modelo: "S3219E", "Altura de trabajo": "7,79 m", Capacidad: "250 kg",
      Motor: "Eléctrico", Longitud: "1,78 m", Anchura: "0,81 m", "Año": "2017" }
  };
  const before = JSON.stringify(source);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.spec["Altura de plataforma"], "5,79 m");
  const claim = prepared.technicalProvenance?.entries.find((entry) => entry.field === "Altura de plataforma");
  assert.equal(claim?.scope, "model-document");
  assert.ok(claim?.document && claim.verification);
  assert.ok(matchesTechnicalDocumentVerification(claim.document, claim.field, claim.value, claim.verification));
  assert.equal(prepared.technicalProvenance?.originalRecordSha256, originalRecordFingerprint(source));
  assert.equal(JSON.stringify(source), before);
  assert.match(prepared.product.description_general ?? "", /altura de trabajo de 7,79 m/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /documentación técnica (?:de referencia )?del modelo|otras fichas del catálogo|prestaciones de referencia del modelo/iu);
});

const reviewedGeneralFixture = "La plataforma de tijera eléctrica MARCA MODELO10 declara una altura de trabajo de 10 m. La altura de trabajo no equivale a la altura de plataforma.";

test("incorpora cotas de modelo acreditadas a la general de unidades compatibles, sin afirmar instalación", () => {
  const sources = [controlledGomarizPlatform(), controlledMercaelevaPlatform()];
  for (const source of sources) {
    const prepared: ProductRecord = { ...source, specs: { ...source.specs,
      "Altura de plataforma": "8 m", "Extensión de plataforma": "0,9 m" } };
    const entries = [reviewedFixture(source, "Altura de plataforma", "8 m"), reviewedFixture(source, "Extensión de plataforma", "0,9 m")];
    const provenance = reviewedProvenance(source, entries);
    const general = resolveReviewedModelGeneral(source, prepared, reviewedGeneralFixture, provenance) ?? "";
    assert.match(general, /extensión de plataforma de 0,9 m y altura de plataforma de 8 m/u, source.providerId);
    assert.match(general, /prestaciones de referencia del modelo/u);
    assert.equal(resolveReviewedModelGeneral(source, prepared, general, provenance), null);
  }
});

test("protege la identidad, los valores contradictorios y las procedencias no acreditadas", () => {
  const source = controlledGomarizPlatform();
  const field = "Extensión de plataforma";
  const prepared: ProductRecord = { ...source, specs: { ...source.specs, [field]: "0,9 m" } };
  const claim = reviewedFixture(source, field, "0,9 m");
  const provenance = reviewedProvenance(source, [claim]);
  const other: readonly ProductRecord[] = [
    { ...prepared, providerId: "mercaeleva" },
    { ...prepared, reference: "OTRA-UNIDAD" },
    { ...prepared, model: "MODELO11" },
    { ...prepared, title: "Carretilla elevadora MARCA MODELO10" },
    { ...prepared, specs: { ...prepared.specs, [field]: "1,2 m" } },
    { ...prepared, specs: { ...prepared.specs, Modelo: "MODELO11" } }
  ];
  for (const candidate of other) assert.equal(resolveReviewedModelGeneral(source, candidate, reviewedGeneralFixture, provenance), null);
  assert.equal(resolveReviewedModelGeneral(source, prepared, `${reviewedGeneralFixture} La extensión de plataforma es de 1,2 m.`, provenance), null);
  assert.equal(resolveReviewedModelGeneral(source, prepared, `${reviewedGeneralFixture} Se indican 0,9 m de extensión.`, provenance), null);
  assert.equal(resolveReviewedModelGeneral(source, prepared, reviewedGeneralFixture, reviewedProvenance(source, [])), null);
  assert.equal(resolveReviewedModelGeneral(source, prepared, reviewedGeneralFixture, reviewedProvenance(source, [{
    field, value: "0,9 m", mechanism: claim.mechanism, scope: "unknown", sourceField: null, sourceValue: null
  }])), null);
  const otherOriginal = { ...source, reference: "CONTROL-OTRO" };
  assert.equal(resolveReviewedModelGeneral(otherOriginal, { ...prepared, reference: otherOriginal.reference }, reviewedGeneralFixture, provenance), null);
  assert.equal(resolveReviewedModelGeneral(source, prepared, reviewedGeneralFixture.replace("MODELO10", "MODELO11"), provenance), null);
  assert.equal(resolveReviewedModelGeneral(source, prepared, reviewedGeneralFixture, reviewedProvenance(source, [claim, claim])), null);
});

test("distingue las prestaciones de desplazamiento del recogepedidos de la capacidad de carga", () => {
  const source: ProductRecord = { ...controlledGomarizPlatform(), title: "Recogepedidos eléctrico MARCA MODELO10",
    specs: { Capacidad: "1200 kg", Motor: "Eléctrico" } };
  const prepared: ProductRecord = { ...source, specs: { ...source.specs,
    "Velocidad máxima de desplazamiento": "9,6 km/h", Dirección: "Eléctrica" } };
  const provenance = reviewedProvenance(source, [reviewedFixture(source, "Velocidad máxima de desplazamiento", "9,6 km/h"),
    reviewedFixture(source, "Dirección", "Eléctrica")]);
  const general = "El recogepedidos MARCA MODELO10 tiene capacidad de carga declarada de 1.200 kg.";
  const result = resolveReviewedModelGeneral(source, prepared, general, provenance) ?? "";
  assert.match(result, /velocidad máxima de desplazamiento de 9,6 km\/h y dirección eléctrica/u);
  assert.equal(resolveReviewedModelGeneral(source, prepared, result, provenance), null);
});

test("distingue las dimensiones de plataforma documentadas de las dimensiones exteriores de la unidad", () => {
  for (const source of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const prepared: ProductRecord = { ...source, specs: { ...source.specs,
      "Anchura de plataforma": "760 mm", "Longitud de plataforma": "1,83 m" } };
    const provenance = reviewedProvenance(source, [reviewedFixture(source, "Anchura de plataforma", "760 mm"),
      reviewedFixture(source, "Longitud de plataforma", "1,83 m")]);
    const general = `${reviewedGeneralFixture} La unidad declara longitud de 2,4 m y anchura de 0,83 m.`;
    const result = resolveReviewedModelGeneral(source, prepared, general, provenance) ?? "";
    assert.match(result, /anchura de plataforma de 0,76 m y longitud de plataforma de 1,83 m/u);
    assert.ok(result.startsWith(general));
    assert.equal(resolveReviewedModelGeneral(source, prepared, result, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, prepared, `${general} Las dimensiones de la cesta están declaradas.`, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, prepared, `${general} Cesta de 1,83 × 0,76 m.`, provenance), null);
    const existing = resolveReviewedModelGeneral(source, prepared, `${general} La cesta tiene una anchura de 0,76 m.`, provenance) ?? "";
    assert.doesNotMatch(existing, /anchura de plataforma de/u);
    assert.match(existing, /longitud de plataforma de 1,83 m/u);
    const contradictory: ProductRecord = { ...prepared, specs: { ...prepared.specs, "Anchura de plataforma": "1 m" } };
    assert.doesNotMatch(resolveReviewedModelGeneral(source, contradictory, general, provenance) ?? "", /anchura de plataforma de/u);
    assert.equal(resolveReviewedModelGeneral(source, { ...prepared, model: "MODELO11" }, general, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, prepared, general, reviewedProvenance(source, [])), null);
  }
});

test("la torre de iluminación reconciliada recupera altura y potencia originales sin mezclar unidades", () => {
  const source: ProductRecord = { ...controlledGomarizPlatform(), brand: "MARCA", model: null, title: "MARCA MODELO10",
    subcategory: null, categoryName: "Iluminación", url: "https://www.gomarizrent.com/energia-electrica-e-iluminacion/torre-de-luz/marca-modelo10/",
    shortDescription: null, longDescription: "Las torres de iluminación son regulables en altura.",
    specs: { "Altura de trabajo": "8 m", Longitud: "3 m", Anchura: "1,4 m", Peso: "1100 kg", Potencia: "4x120 W" } };
  const prepared = { ...source, model: "MODELO10" };
  const text = "La torre de iluminación MARCA MODELO10 declara longitud de 3 m, anchura de 1,4 m y peso de 1.100 kg.";
  const result = resolveSourcedTechnicalContext(source, prepared, text, true) ?? "";
  assert.match(result, /altura de trabajo de 8 m/u);
  assert.match(result, /4 × 120 W/u);
  assert.equal(resolveSourcedTechnicalContext(source, { ...prepared, model: "MODELO11" }, text, true), null);
  assert.equal(resolveSourcedTechnicalContext(source, { ...prepared, reference: "OTRA" }, text, true), null);
});


test("recupera dimensiones documentadas de bandejas sin confundirlas con el tamaño exterior del almacén", () => {
  for (const factory of [controlledGomarizPlatform, controlledMercaelevaPlatform]) {
    const source: ProductRecord = { ...factory(), title: "Almacén automático vertical MARCA MODELO10",
      specs: { Marca: "MARCA", Modelo: "MODELO10", Altura: "2500 mm" } };
    const prepared: ProductRecord = { ...source, specs: { ...source.specs,
      "Anchura de bandeja": "2500 mm", "Profundidad de bandeja": "850 mm", "Anchura exterior del almacén": "2900 mm" } };
    const claims = [reviewedFixture(source, "Anchura de bandeja", "2500 mm"),
      reviewedFixture(source, "Profundidad de bandeja", "850 mm")];
    const provenance = reviewedProvenance(source, claims);
    const general = "El almacén automático vertical MARCA MODELO10 declara una altura de 2,5 m.";
    const result = resolveReviewedModelGeneral(source, prepared, general, provenance) ?? "";
    assert.ok(result.startsWith(general));
    assert.match(result, /anchura de bandeja de 2,5 m y profundidad de bandeja de 0,85 m/u);
    assert.doesNotMatch(result, /2,9 m/u);
    assert.equal(resolveReviewedModelGeneral(source, prepared, result, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, prepared, `${general} Bandeja de 2,5 × 0,85 m.`, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, prepared, general, reviewedProvenance(source, claims.slice(0, 1))), null);
    assert.equal(resolveReviewedModelGeneral(source, { ...prepared, specs: { ...prepared.specs, "Profundidad de bandeja": "900 mm" } }, general, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, { ...prepared, model: "MODELO11" }, general, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, { ...prepared, reference: "OTRA" }, general, provenance), null);
  }
});

test("diferencia propulsión y accionamiento de elevación documentados en manutención", () => {
  for (const base of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const source: ProductRecord = { ...base, title: "Apilador MARCA MODELO10", specs: { Capacidad: "1200 kg" } };
    const general = "El apilador MARCA MODELO10 declara una capacidad de carga de 1.200 kg.";
    const fields = { "Propulsión": "Manual", "Accionamiento de elevación": "Eléctrico" };
    const prepared: ProductRecord = { ...source, specs: { ...source.specs, ...fields } };
    const claims = Object.entries(fields).map(([key, value]) => reviewedFixture(source, key, value));
    const provenance = reviewedProvenance(source, claims);
    const result = resolveReviewedModelGeneral(source, prepared, general, provenance);
    assert.match(result ?? "", /propulsión manual y accionamiento eléctrico de elevación/u);
    assert.match(result ?? "", /prestaciones de referencia del modelo/u);
    assert.equal(resolveReviewedModelGeneral(source, prepared, result, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, { ...prepared, reference: "OTRA" }, general, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, { ...prepared, model: "OTRO" }, general, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, prepared, general, reviewedProvenance(source, [])), null);
    assert.doesNotMatch(resolveReviewedModelGeneral(source, { ...prepared, specs: { ...prepared.specs, Propulsión: "Eléctrica" } }, general, provenance) ?? "", /propulsión manual/u);
    assert.doesNotMatch(resolveReviewedModelGeneral(source, prepared, `${general} Propulsión manual.`, provenance) ?? "", /recoge propulsión manual/u);
  }
});

test("conserva el significado de recorrido de elevación y altura de trabajo con carga inclinada", () => {
  const source: ProductRecord = { ...controlledGomarizPlatform(), title: "Transpaleta MARCA MODELO10", specs: { Capacidad: "1000 kg" } };
  const general = "La transpaleta MARCA MODELO10 declara una capacidad de carga de 1.000 kg.";
  const fields = { "Recorrido de elevación": "300 mm", "Altura de trabajo con caja inclinada": "700–900 mm" };
  const prepared: ProductRecord = { ...source, specs: { ...source.specs, ...fields } };
  const provenance = reviewedProvenance(source, Object.entries(fields).map(([key, value]) => reviewedFixture(source, key, value)));
  const result = resolveReviewedModelGeneral(source, prepared, general, provenance);
  assert.match(result ?? "", /recorrido de elevación de 0,3 m y altura de trabajo con caja inclinada de 0,7 a 0,9 m/u);
  assert.equal(resolveReviewedModelGeneral(source, prepared, result, provenance), null);
  assert.doesNotMatch(resolveReviewedModelGeneral(source, prepared, `${general} Altura de trabajo de 0,8 m.`, provenance) ?? "", /recoge.*altura de trabajo/u);
});

test("distingue el centro de carga nominal documentado de la capacidad efectiva de cada carretilla", () => {
  for (const source of [controlledGamForklift(), controlledMercaelevaForklift()]) {
    const field = "Centro de carga nominal del modelo";
    const prepared: ProductRecord = { ...source, specs: { ...source.specs, [field]: "600 mm" } };
    const claim = reviewedFixture(source, field, "600 mm");
    const provenance = reviewedProvenance(source, [claim]);
    const general = "La carretilla elevadora MARCA MODELO10 declara 2.500 kg. La capacidad efectiva depende del centro de carga y los implementos reales.";
    const result = resolveReviewedModelGeneral(source, prepared, general, provenance);
    assert.ok(result?.startsWith(general), source.providerId);
    assert.match(result ?? "", /centro de carga nominal de 600 mm/u);
    assert.match(result ?? "", /prestaciones de referencia del modelo/u);
    assert.equal(resolveReviewedModelGeneral(source, prepared, result, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, prepared, `${general} El centro de carga es de 500 mm.`, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, { ...prepared, specs: { ...prepared.specs, "Centro de carga": "500 mm" } }, general, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, { ...prepared, specs: { ...prepared.specs, [field]: "500 mm" } }, general, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, { ...prepared, reference: "OTRA" }, general, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, prepared, general, reviewedProvenance(source, [])), null);
    assert.equal(resolveReviewedModelGeneral(source, prepared, general, reviewedProvenance(source, [{
      field, value: "600 mm", mechanism: claim.mechanism, scope: "model-document", sourceField: null, sourceValue: null,
      document: { url: "https://example.com/technical-sheet.pdf", brand: source.brand, model: source.model }
    }])), null);
    const other = { ...source, longDescription: "Centro de carga de 500 mm." };
    assert.equal(resolveReviewedModelGeneral(other, { ...prepared, longDescription: other.longDescription }, general,
      reviewedProvenance(other, [reviewedFixture(other, field, "600 mm")])), null);
  }
});

test("aprovecha el plumín documentado sin confundirlo con alcance ni equipamiento instalado", () => {
  for (const base of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const source: ProductRecord = { ...base, title: "Plataforma articulada eléctrica MARCA MODELO10", specs: { "Altura de trabajo": "10 m" } };
    const field = "Longitud de plumín";
    const prepared: ProductRecord = { ...source, specs: { ...source.specs, [field]: "1,24 m" } };
    const provenance = reviewedProvenance(source, [reviewedFixture(source, field, "1,24 m")]);
    const general = "La plataforma articulada eléctrica MARCA MODELO10 declara altura de trabajo de 10 m y alcance horizontal de 5 m.";
    const result = resolveReviewedModelGeneral(source, prepared, general, provenance);
    assert.ok(result?.startsWith(general));
    assert.match(result ?? "", /longitud de plumín de 1,24 m/u);
    assert.match(result ?? "", /prestaciones de referencia del modelo/u);
    assert.equal(resolveReviewedModelGeneral(source, prepared, result, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, prepared, `${general} Plumín opcional.`, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, { ...prepared, model: "OTRO" }, general, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, { ...prepared, specs: { ...prepared.specs, [field]: "2 m" } }, general, provenance), null);
    assert.equal(resolveReviewedModelGeneral(source, prepared, general, reviewedProvenance(source, [])), null);
  }
});


test("integra el plumín en la referencia documental existente sin repetir la advertencia", () => {
  const source: ProductRecord = { ...controlledMercaelevaPlatform(), title: "Plataforma articulada eléctrica MARCA MODELO10", specs: { "Altura de trabajo": "10 m" } };
  const field = "Longitud de plumín";
  const prepared: ProductRecord = { ...source, specs: { ...source.specs, [field]: "1,24 m" } };
  const provenance = reviewedProvenance(source, [reviewedFixture(source, field, "1,24 m")]);
  const prefix = "La plataforma articulada eléctrica MARCA MODELO10 se destina a trabajos en altura. ";
  const reference = "La documentación técnica de referencia del modelo MARCA MODELO10 recoge altura de plataforma de 8 m. Las magnitudes corresponden al modelo o versión documentada y no acreditan la configuración ni las prestaciones de esta unidad.";
  const general = `${prefix.repeat(8)}${reference}`;
  const result = resolveReviewedModelGeneral(source, prepared, general, provenance);
  assert.equal(result, general.replace("8 m. Las magnitudes", "8 m, longitud de plumín de 1,24 m. Las magnitudes"));
  assert.equal(resolveReviewedModelGeneral(source, prepared, result, provenance), null);
  assert.equal(resolveReviewedModelGeneral(source, prepared, general.replace("modelo MARCA MODELO10 recoge", "modelo MARCA MODELO11 recoge"), provenance), null);
});
