import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ProductTechnicalProvenance, TechnicalSpecEvidence } from "../../../contracts/technical-provenance.js";
import { originalRecordFingerprint } from "../../../catalog/identity-fingerprint.js";
import { reviewedModelEditorialSpecs } from "../../technical/documented-technical-evidence.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { resolvePreparedEditorial } from "../core/prepared-editorial.js";
import { captureSourceEditorialEvidence } from "./source-editorial-evidence.js";
import { matchesTechnicalDocumentVerification, technicalDocumentClaimSha256 } from "../../../contracts/technical-provenance.js";
import { resolveDocumentedModelGeneral, resolveSourcedTechnicalContext } from "../measurements/sourced/editorial-sourced-technical-context.js";
import { resolveSourcedConciseShort } from "../writing/editorial-sourced-concise-short.js";
import { resolveSourcedLongEvidence } from "./editorial-sourced-long-evidence.js";
import { controlledGamForklift, controlledGomarizPlatform, controlledMercaelevaPlatform } from "../core/editorial-contract-records.js";

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
  assert.match(result, /Debe contrastarse el estado y la composición/u);
  assert.doesNotMatch(result, /(?:el proveedor describe|corresponde a la descripción del producto)/iu);
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

test("la redacción conserva prestaciones de unidad y no convierte cotas de modelo en una justificación documental", () => {
  for (const source of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const field = "Extensión de plataforma";
    const value = "0,9 m";
    const prepared: ProductRecord = { ...source, specs: { ...source.specs, [field]: value } };
    const before = structuredClone({ source, prepared });
    const evidence = captureSourceEditorialEvidence(prepared);
    const editorial = resolvePreparedEditorial(prepared, source, evidence, source);
    assert.match(editorial.preparedLong ?? "", /altura de trabajo de 10 m/u);
    assert.match(editorial.preparedLong ?? "", /verificar la capacidad de cesta/u);
    assert.doesNotMatch(editorial.preparedLong ?? "", /documentación técnica (?:de referencia )?del modelo|prestaciones de referencia del modelo/iu);
    assert.doesNotMatch(editorial.preparedLong ?? "", /extensión de plataforma de 0,9 m/iu);
    assert.equal(prepared.specs?.[field], value);
    assert.deepEqual({ source, prepared }, before);
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


test("aprovecha las cotas documentadas en generales breves sin añadir ni duplicar especificaciones", () => {
  for (const source of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const original: ProductRecord = { ...source, title: "Plataforma articulada eléctrica MARCA MODELO10" };
    const general = "La ficha técnica de plataforma articulada eléctrica MARCA MODELO10 indica altura de trabajo de 10 m.";
    const prepared: ProductRecord = { ...original, specs: { ...original.specs,
      "Altura de plataforma": "8 m", "Alcance horizontal": "6 m" } };
    const document = { url: "https://example.invalid/manual.pdf", brand: original.brand, model: original.model };
    const reviewedOn = "2026-11-24";
    const support = "Tabla técnica de prueba para la configuración controlada";
    const evidence = (field: string, value: string): TechnicalSpecEvidence => ({
      field, value, mechanism: "src/preparation/technical/documented-technical-evidence.ts", scope: "model-document",
      sourceField: null, sourceValue: null, document, verification: { kind: "reviewed-model-fact", reviewedOn, support,
        claimSha256: technicalDocumentClaimSha256(document, field, value, reviewedOn, support) }
    });
    const provenance: ProductTechnicalProvenance = { originalRecordSha256: originalRecordFingerprint(original),
      entries: [evidence("Altura de plataforma", "8 m"), evidence("Alcance horizontal (m)", "6 m")] };
    const snapshot = structuredClone({ original, prepared, provenance });
    const facts = reviewedModelEditorialSpecs(original, provenance);
    const result = resolveDocumentedModelGeneral(original, prepared, general, facts);
    assert.ok(result, original.providerId);
    assert.match(result, /altura de plataforma de 8 m y alcance horizontal de 6 m/u);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, result, facts), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, undefined), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, reviewedModelEditorialSpecs(original, { ...provenance, entries: [] })), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general,
      reviewedModelEditorialSpecs(original, { ...provenance, originalRecordSha256: "0".repeat(64) })), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, reference: "OTRA" }, general, facts), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, model: "OTRO" }, general, facts), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, specs: { ...prepared.specs,
      "Altura de plataforma": "11 m", "Alcance lateral": "5 m" } }, general, facts), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared,
      `${general} Altura de plataforma de 8 m y alcance lateral de 6 m.`, facts), null);
    assert.deepEqual({ original, prepared, provenance }, snapshot);
  }
});

test("completa generales técnicas de plataformas con cotas numéricas ausentes sin repetir la orientación de familia", () => {
  for (const original of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const general = "La ficha técnica de plataforma de tijera eléctrica MARCA MODELO10 indica altura de trabajo de 10 m. Esta unidad consta con año de fabricación declarado por el proveedor y horas registradas en su ficha individual. El equipo se emplea en trabajos de elevación vertical. Las condiciones de acceso dependen de las dimensiones exteriores y de la superficie de apoyo. La altura de trabajo no equivale a la altura de plataforma; verificar la capacidad de cesta.";
    const reviewed = { "Altura de plataforma": "8 m", "Extensión de plataforma": "0,9 m" };
    const prepared: ProductRecord = { ...original, specs: { ...original.specs, ...reviewed } };
    const result = resolveDocumentedModelGeneral(original, prepared, general, reviewed);
    assert.ok(result);
    assert.equal(result, `${general}\n\nEl modelo presenta altura de plataforma de 8 m y extensión de plataforma de 0,9 m.`);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, result, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, `${general} Altura de plataforma de 8 m. Extensión de plataforma de 0,9 m.`, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, { "Altura de plataforma": "7 m", "Extensión de plataforma": "1,2 m" }), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, specs: { ...prepared.specs, "Altura plataforma": "7 m", "Extensión de plataforma": "1,2 m" } }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, reference: "OTRA" }, general, reviewed), null);
    const articulated = { ...original, title: "Plataforma articulada eléctrica MARCA MODELO10" };
    assert.equal(resolveDocumentedModelGeneral(articulated, { ...articulated, specs: { ...prepared.specs } }, general.replace("de tijera", "articulada"), { "Extensión de plataforma": "0,9 m" }), null);
  }
});

test("aprovecha dimensiones documentadas de plataforma sin confundirlas con el tamaño exterior", () => {
  for (const source of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const original: ProductRecord = { ...source, specs: { ...source.specs, Longitud: "3 m", Anchura: "1,5 m" } };
    const reviewed = { "Longitud de plataforma": "2 m", "Anchura de plataforma": "1 m" };
    const prepared: ProductRecord = { ...original, specs: { ...original.specs, ...reviewed } };
    const general = "La ficha técnica de plataforma de tijera eléctrica MARCA MODELO10 indica altura de trabajo de 10 m, longitud de 3 m y anchura de 1,5 m.";
    const result = resolveDocumentedModelGeneral(original, prepared, general, reviewed);
    assert.equal(result, `${general}\n\nEl modelo presenta longitud de plataforma de 2 m y anchura de plataforma de 1 m.`);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, result, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, `${general} Plataforma de 2 × 1 m.`, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, `${general} Cesta 2 m x 1 m.`, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, `${general} Dimensiones de cesta de 2 × 1 m.`, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, specs: { ...prepared.specs, "Dimensiones Cesta": "2 x 1,2 m" } }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, specs: { ...prepared.specs, "Longitud plataforma": "2,5 m", "Ancho plataforma": "1,2 m" } }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, specs: { ...prepared.specs, Longitud: "1 m", Anchura: "0,8 m" } }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, reference: "OTRA" }, general, reviewed), null);
    assert.match(resolveDocumentedModelGeneral(original, prepared, general, { "Anchura de plataforma": "1 m" }) ?? "", /anchura de plataforma de 1 m/u);
    assert.doesNotMatch(resolveDocumentedModelGeneral(original, prepared, general, { "Anchura de plataforma": "1 m" }) ?? "", /longitud de plataforma/u);
  }
});

test("narra alcance, plumín y distancia entre ejes documentados sin confundir sus cotas", () => {
  for (const source of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const original: ProductRecord = { ...source, title: "Plataforma articulada eléctrica MARCA MODELO10", specs: { ...source.specs, Longitud: "4 m" } };
    const reviewed = { "Alcance horizontal (m)": "6 m", "Longitud de plumín": "1,2 m", "Distancia entre ejes (mm)": "1,8 m" };
    const prepared: ProductRecord = { ...original, specs: { ...original.specs, "Alcance horizontal": "6 m", "Longitud de plumín": "1200 mm", "Distancia entre ejes": "1800 mm" } };
    const general = "La ficha técnica de plataforma articulada eléctrica MARCA MODELO10 indica altura de trabajo de 10 m.";
    const result = resolveDocumentedModelGeneral(original, prepared, general, reviewed);
    assert.equal(result, `${general}\n\nEl modelo presenta alcance horizontal de 6 m, longitud de plumín de 1,2 m y distancia entre ejes de 1,8 m.`);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, result, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, model: "OTRO" }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, `${general} Alcance lateral de 6 m. Plumín de 1,2 m. Batalla de 1,8 m.`, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, specs: { ...prepared.specs, "Alcance lateral": "5 m", "Longitud de plumín": "1,5 m", "Distancia entre ejes": "5 m" } }, general, reviewed), null);
  }
});

test("aprovecha el centro nominal acreditado sin inferir capacidad residual ni duplicar cotas", () => {
  for (const source of [controlledGamForklift(), { ...controlledMercaelevaPlatform(), title: "Carretilla elevadora MARCA MODELO10", specs: { Capacidad: "2500 kg" } }]) {
    const general = "La ficha técnica de carretilla elevadora MARCA MODELO10 indica capacidad de carga de 2.500 kg. La capacidad nominal debe comprobarse con el centro de carga y los implementos reales.";
    const reviewed = { "Centro de carga nominal del modelo": "500 mm" };
    const prepared = { ...source, specs: { ...source.specs, ...reviewed } };
    const result = resolveDocumentedModelGeneral(source, prepared, general, reviewed);
    assert.equal(result, `${general}\n\nEl modelo presenta centro de carga nominal de 500 mm.`);
    assert.equal(resolveDocumentedModelGeneral(source, prepared, result, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(source, prepared, general, { "Centro de carga": "500 mm" }), null);
    assert.equal(resolveDocumentedModelGeneral({ ...source, specs: { ...source.specs, "Centro de carga": "600 mm" } }, prepared, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(source, prepared, `${general} Centro de carga de 0,5 m.`, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(source, { ...prepared, model: "OTRO" }, general, reviewed), null);
  }
});

test("distingue las dimensiones acreditadas de bandeja y del almacén vertical", () => {
  const source: ProductRecord = { ...controlledGamForklift(), title: "Almacén automático vertical MARCA MODELO10", url: "https://online.gamrentals.com/es/almacenes-verticales/CONTROL-03-almacen-vertical", specs: {} };
  const reviewed = { "Anchura de bandeja": "2500 mm", "Profundidad de bandeja": "850 mm", "Anchura exterior del almacén": "2900 mm" };
  const prepared = { ...source, specs: reviewed };
  const general = "La ficha técnica de almacén automático vertical MARCA MODELO10 indica carga neta por bandeja de 250 kg.";
  const result = resolveDocumentedModelGeneral(source, prepared, general, reviewed);
  assert.equal(result, `${general}\n\nEl modelo presenta anchura de bandeja de 2.500 mm, profundidad de bandeja de 850 mm y anchura exterior del almacén de 2.900 mm.`);
  assert.equal(resolveDocumentedModelGeneral(source, prepared, result, reviewed), null);
  assert.equal(resolveDocumentedModelGeneral(source, prepared, `${general} Bandeja de 2500 × 850 mm.`, { "Anchura de bandeja": "2500 mm", "Profundidad de bandeja": "850 mm" }), null);
  assert.equal(resolveDocumentedModelGeneral(source, { ...prepared, reference: "OTRA" }, general, reviewed), null);
  assert.equal(resolveDocumentedModelGeneral(source, prepared, general, {}), null);
});

test("recupera la velocidad máxima y dirección acreditadas del recogepedidos sin confundir magnitudes", () => {
  const source: ProductRecord = { ...controlledGamForklift(), title: "Recogepedidos MARCA MODELO10", url: "https://online.gamrentals.com/es/recogepedidos/CONTROL-03-recogepedidos", specs: {} };
  const general = "La ficha técnica de recogepedidos MARCA MODELO10 indica capacidad de carga de 1.000 kg.";
  const reviewed = { "Velocidad máxima de desplazamiento": "8,5 km/h", "Dirección": "Eléctrica" };
  const prepared = { ...source, specs: reviewed };
  const result = resolveDocumentedModelGeneral(source, prepared, general, reviewed);
  assert.equal(result, `${general}\n\nEl modelo presenta velocidad máxima de desplazamiento de 8,5 km/h y dirección eléctrica.`);
  assert.equal(resolveDocumentedModelGeneral(source, prepared, result, reviewed), null);
  assert.equal(resolveDocumentedModelGeneral(source, prepared, general, { "Velocidad máxima de desplazamiento": "8,5 km" }), null);
  assert.equal(resolveDocumentedModelGeneral({ ...source, specs: { "Dirección": "Manual" } }, prepared, general, { "Dirección": "Eléctrica" }), null);
});

test("distingue propulsión, elevación y maniobra acreditadas en equipos de manutención", () => {
  for (const source of [controlledGamForklift(), controlledMercaelevaPlatform()]) {
    const original: ProductRecord = { ...source, title: "Apilador MARCA MODELO10", specs: {} };
    const general = "La ficha técnica de apilador MARCA MODELO10 indica capacidad de carga de 1.000 kg.";
    const reviewed = { "Propulsión": "Manual", "Accionamiento de elevación": "Hidráulico manual", "Conducción con timón vertical": "Permitida" };
    const prepared = { ...original, specs: reviewed };
    const result = resolveDocumentedModelGeneral(original, prepared, general, reviewed);
    assert.equal(result, `${general}\n\nEl modelo presenta propulsión manual, accionamiento hidráulico manual de elevación y conducción con el timón en posición vertical.`);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, result, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, model: "OTRO" }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral({ ...original, specs: { Propulsión: "Eléctrica" } }, prepared, general, { Propulsión: "Manual" }), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, specs: { ...reviewed, "Propulsion": "Eléctrica" } }, general, { Propulsión: "Manual" }), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, `${general} El equipo no permite conducir con el timón vertical.`, { "Conducción con timón vertical": "Permitida" }), null);
  }
});

test("distingue alcance y dimensiones de transporte del manipulador", () => {
  const original: ProductRecord = { ...controlledGamForklift(), title: "Manipulador telescópico MARCA MODELO10", specs: {} };
  const general = "La ficha técnica de manipulador telescópico MARCA MODELO10 indica capacidad de carga de 4.000 kg.";
  const reviewed = { "Alcance horizontal (m)": "9 m", "Longitud de transporte": "6 m", "Anchura de transporte": "2 m" };
  const prepared = { ...original, specs: reviewed };
  const result = resolveDocumentedModelGeneral(original, prepared, general, reviewed);
  assert.equal(result, `${general}\n\nEl modelo presenta alcance horizontal de 9 m, longitud de transporte de 6 m y anchura de transporte de 2 m.`);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, result, reviewed), null);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, general, { Capacidad: "2500 kg" }), null);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, general, { "Alcance horizontal (m)": "8 m" }), null);
  assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, reference: "OTRA" }, general, reviewed), null);
});

test("no aprovecha cotas documentadas cuando la discrepancia original de altura no está reconciliada por evidencia", () => {
  const original: ProductRecord = { ...controlledMercaelevaPlatform(),
    title: "MARCA MODELO10 PLATAFORMA ARTICULADA ELECTRICA 10 MT",
    specs: { "Título adicional": "PLATAFORMA ARTICULADA ELECTRICA 10 MT", "Altura de trabajo": "8 m" } };
  const prepared: ProductRecord = { ...original, specs: { ...original.specs, "Altura de trabajo": "10 m", "Altura de plataforma": "8 m" } };
  const general = "La ficha técnica de plataforma articulada eléctrica MARCA MODELO10 indica altura de trabajo de 10 m.";
  assert.equal(resolveDocumentedModelGeneral(original, prepared, general, { "Altura de plataforma": "8 m" }), null);
});

test("la recuperación de batería no desplaza una prestación documental por la longitud de la composición", () => {
  const source: ProductRecord = { ...controlledGamForklift(), condition: "Nuevo",
    title: "Carretilla elevadora eléctrica MARCA MODELO10 2500 kg",
    longDescription: "La carretilla MARCA MODELO10 utiliza accionamiento eléctrico.", year: "2022", horometer: "200",
    specs: { ...controlledGamForklift().specs, Marca: "MARCA", Modelo: "MODELO10", "Tipo de motor": "Eléctrico",
      Longitud: "3 m", Anchura: "1,2 m", Altura: "2,5 m", Peso: "3500 kg", "Capacidad de la batería": "48V / 420Ah(V/Ah)" } };
  const reviewed = { "Centro de carga nominal del modelo": "500 mm" };
  const prepared: ProductRecord = { ...source, specs: { ...source.specs, ...reviewed } };
  const editorial = resolvePreparedEditorial(prepared, source, captureSourceEditorialEvidence(source), source, reviewed);
  assert.match(editorial.preparedLong ?? "", /centro de carga nominal de 500 mm/u);
  assert.match(editorial.preparedLong ?? "", /batería a 48 V con 420 Ah/u);
  const withoutBatterySpecs = { ...source.specs };
  delete withoutBatterySpecs["Capacidad de la batería"];
  const noBattery: ProductRecord = { ...source, specs: withoutBatterySpecs };
  const withoutBattery = resolvePreparedEditorial({ ...noBattery, specs: { ...noBattery.specs, ...reviewed } }, noBattery,
    captureSourceEditorialEvidence(noBattery), noBattery, reviewed);
  assert.ok(editorial.preparedLong?.startsWith(withoutBattery.preparedLong ?? ""));
  assert.equal(editorial.preparedShort, withoutBattery.preparedShort);
});

test("aprovecha recorridos y componentes de manutención solo con evidencia de modelo concordante", () => {
  for (const base of [controlledGamForklift(), controlledMercaelevaPlatform()]) {
    const original: ProductRecord = { ...base, title: "Transpaleta MARCA MODELO10", specs: {} };
    const general = "La ficha técnica de transpaleta MARCA MODELO10 indica capacidad de carga de 1.000 kg.";
    const reviewed = { "Recorrido de elevación": "275 mm", "Controlador de tracción": "Curtis ACF2C", "Sistema de elevación": "Elevación rápida permanente", "Protección de las células de carga": "IP68" };
    const prepared = { ...original, specs: reviewed };
    const result = resolveDocumentedModelGeneral(original, prepared, general, reviewed);
    assert.equal(result, `${general}\n\nEl modelo presenta controlador de tracción Curtis ACF2C, recorrido de elevación de 275 mm, sistema de elevación rápida permanente y protección IP68 de las células de carga.`);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, result, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, model: "OTRO" }, general, reviewed), null);
    assert.equal(resolveDocumentedModelGeneral({ ...original, specs: { "Recorrido de elevación": "300 mm" } }, prepared, general, { "Recorrido de elevación": "275 mm" }), null);
    assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, specs: { "Recorrido de elevación": "275 kg" } }, general, { "Recorrido de elevación": "275 kg" }), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, `${general} No dispone de controlador Curtis.`, { "Controlador de tracción": reviewed["Controlador de tracción"] }), null);
    assert.equal(resolveDocumentedModelGeneral(original, prepared, general, { "Controlador de tracción": "Curtis (CA)" }), null);
  }
});

test("conserva la condición de las cotas y capacidades documentadas de plataformas telescópicas", () => {
  const original: ProductRecord = { ...controlledMercaelevaPlatform(), title: "Plataforma telescópica MARCA MODELO10", specs: { "Altura de trabajo": "20 m" } };
  const general = "La ficha técnica de plataforma telescópica MARCA MODELO10 indica altura de trabajo de 20 m.";
  const reviewed = { "Anchura con ejes recogidos": "2,5 m", "Capacidad de plataforma sin restricciones": "230 kg" };
  const prepared = { ...original, specs: { ...original.specs, ...reviewed } };
  const result = resolveDocumentedModelGeneral(original, prepared, general, reviewed);
  assert.equal(result, `${general}\n\nEl modelo presenta anchura con ejes recogidos de 2,5 m y capacidad de plataforma sin restricciones de 230 kg.`);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, result, reviewed), null);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, `${general} Capacidad de plataforma de 200 kg.`, { "Capacidad de plataforma sin restricciones": "230 kg" }), null);
  assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, reference: "OTRA" }, general, reviewed), null);
});

test("distingue el giro del cabezal trilateral de otras rotaciones", () => {
  const original: ProductRecord = { ...controlledGamForklift(), title: "Carretilla trilateral MARCA MODELO10", specs: {} };
  const general = "La ficha técnica de carretilla elevadora MARCA MODELO10 indica capacidad de carga de 1.500 kg.";
  const reviewed = { "Rotación del cabezal trilateral": "180°" };
  const prepared = { ...original, specs: reviewed };
  const result = resolveDocumentedModelGeneral(original, prepared, general, reviewed);
  assert.equal(result, `${general}\n\nEl modelo presenta rotación del cabezal trilateral de 180°.`);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, result, reviewed), null);
  assert.equal(resolveDocumentedModelGeneral(original, prepared, general, {}), null);
  assert.equal(resolveDocumentedModelGeneral(original, { ...prepared, specs: { "Rotación del cabezal trilateral": "400°" } }, general, { "Rotación del cabezal trilateral": "400°" }), null);
  const other = { ...original, title: "Carretilla elevadora MARCA MODELO10" };
  assert.equal(resolveDocumentedModelGeneral(other, { ...other, specs: reviewed }, general, reviewed), null);
});
