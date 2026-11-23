import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readVerifiedManainRecordSource } from "../../../../infrastructure/filesystem/catalog/manain-record-source.js";
import { prepareImportBatch } from "../../../batch-identity.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { normalizeManainTechnicalSpecs } from "../../technical/reconciliation/normalization.js";
import { resolveEditorialSource } from "../../../shared/editorial/domain/editorial-source.js";
import { resolveEditorialFacts } from "../../../shared/editorial/domain/editorial-facts.js";
import { captureSourceEditorialEvidence } from "../../../shared/editorial/mapping/source-editorial-evidence.js";
import { reconcileManainEditorialSourceSpecs, resolveManainEditorialDomainSource } from "../mapping/domain-source.js";

const originals = async () => (await readVerifiedManainRecordSource(process.cwd())).originalProducts;

test("Manain: la identidad de origen permite composición editorial solo con URL, título y ficha coherentes", async () => {
  const records = await originals();
  const generator = records.find((record) => record.reference === "MAN1842");
  const platform = records.find((record) => record.reference === "MA3978");
  assert.ok(generator);
  assert.ok(platform);

  for (const record of [generator, platform]) {
    assert.deepEqual(resolveEditorialSource(record), resolveManainEditorialDomainSource(record));
    assert.deepEqual(captureSourceEditorialEvidence(record), { identityVerified: true, sourceVerified: true });
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready");
    assert.ok(record.brand);
    assert.ok(record.model);
    assert.ok((prepared.product.description ?? "").includes(record.brand));
    assert.ok((prepared.product.description_general ?? "").includes(record.model));
    assert.deepEqual(prepared.product.images, record.images);
  }
});

test("Manain: URLs y señales contradictorias no autentican el anuncio ni generan textos", async () => {
  const record = (await originals()).find((item) => item.reference === "MAN1842");
  assert.ok(record);
  const rejected: ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, url: "https://manain.com.ejemplo.org/producto/venta-energia-grupo-electrogeno-inmesol-iir-165/" },
    { ...record, url: "http://manain.com/producto/venta-energia-grupo-electrogeno-inmesol-iir-165/" },
    { ...record, url: `${record.url}?otra=unidad` },
    { ...record, url: "https://manain.com/otra/venta-energia-grupo-electrogeno-inmesol-iir-165/" },
    { ...record, url: "https://manain.com/producto/venta-energia-grupo-electrogeno-inmesol-iir-180/" },
    { ...record, title: "Modelo diferente" },
    { ...record, brand: "OTRA" },
    { ...record, model: "IIR-180" },
    { ...record, specs: { ...record.specs, Marca: "OTRA" } },
    { ...record, specs: { ...record.specs, Modelo: "IIR-180" } },
    { ...record, categoryKey: "alquiler" },
    { ...record, condition: "Nuevo" }
  ];
  for (const changed of rejected) {
    assert.equal(resolveManainEditorialDomainSource(changed), null, changed.url);
    const prepared = prepareSourceProduct(changed);
    assert.equal(prepared.product.description, null);
    assert.equal(prepared.product.description_general, null);
  }
});

test("Manain: las 384 unidades atraviesan el motor común conservando los datos y las revisiones legítimas", async (t) => {
  const records = await originals();
  const preparation = prepareImportBatch(records);
  assert.equal(records.length, 384);
  assert.equal(preparation.totals.ready + preparation.totals.review, records.length);
  assert.ok(preparation.totals.ready > 0);
  assert.ok(preparation.totals.review > 0);
  let recognized = 0;
  let composed = 0;
  for (const [index, record] of records.entries()) {
    const prepared = preparation.products[index];
    assert.ok(prepared);
    assert.equal(prepared.product.reference, record.reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.deepEqual(prepared.product.images, record.images);
    assert.deepEqual(prepared.product.spec, normalizeManainTechnicalSpecs(record, record.specs ?? {}));
    assert.equal(prepared.product.price, null);
    assert.equal(prepared.product.categorySellID, null);
    assert.deepEqual(prepared.product.attributes, []);
    if (resolveEditorialSource(record)) recognized++;
    if (prepared.product.description?.trim() && prepared.product.description_general?.trim()) composed++;
    if (prepared.status === "ready") {
      assert.ok(prepared.product.description?.trim());
      assert.ok(prepared.product.description_general?.trim());
      assert.deepEqual(prepared.issues, []);
    }
  }
  assert.ok(recognized >= preparation.totals.ready);
  assert.ok(composed >= preparation.totals.ready);
  const documentedDiscCutter = preparation.products.find((item) => item.product.reference === "MAN1188");
  assert.equal(documentedDiscCutter?.status, "ready");
  assert.match(documentedDiscCutter.product.description ?? "", /Equipo de corte con disco eléctrico HOLZSTAR TKS 316 E/u);
  const unsupportedFamily = preparation.products.find((item) => item.product.reference === "MA3727");
  assert.equal(unsupportedFamily?.status, "review");
  t.diagnostic(`${recognized} fuentes reconocidas; ${composed} fichas con ambos textos; ${preparation.totals.ready} ready, ${preparation.totals.review} review`);
});


test("Manain: las familias web en español y catalán alimentan el editor sin alterar las especificaciones", async () => {
  const records = await originals();
  const cases = [
    { reference: "MA3904", family: "plataforma-tijera" },
    { reference: "MA3857", family: "plataforma-articulada" },
    { reference: "MAN2327", family: "plataforma-mastil" },
    { reference: "MAN1956", family: "plataforma-tijera" },
    { reference: "MAN1077", family: "carretilla-elevadora" },
    { reference: "MA1109", family: "carretilla-retractil" },
    { reference: "MAN200", family: "grupo-electrogeno" }
  ] as const;
  for (const { reference, family } of cases) {
    const record = records.find((item) => item.reference === reference);
    assert.ok(record);
    assert.equal(resolveEditorialFacts(record)?.family, family, reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.ok(prepared.product.description?.trim(), reference);
    assert.ok(prepared.product.description_general?.trim(), reference);
    assert.deepEqual(prepared.product.images, record.images);
    assert.deepEqual(prepared.product.spec, normalizeManainTechnicalSpecs(record, record.specs ?? {}));
  }
});

test("Manain: familias no equivalentes y fuentes sin identidad verificable no reciben textos ficticios", async () => {
  const records = await originals();
  const cutter = records.find((item) => item.reference === "MAN1188");
  assert.ok(cutter);
  const unsupported: ProductRecord = { ...cutter, specs: { ...cutter.specs, "Diametro max. disco": "sin dato" } };
  assert.equal(resolveEditorialFacts(unsupported), null);
  assert.equal(prepareSourceProduct(unsupported).status, "review");
  assert.equal(prepareSourceProduct(unsupported).product.description, null);
  const authenticated = records.find((item) => item.reference === "MA3904");
  assert.ok(authenticated);
  const contradictingSpecs: ProductRecord = { ...authenticated, specs: { ...authenticated.specs, Marca: "OTRA" } };
  assert.equal(resolveManainEditorialDomainSource(contradictingSpecs), null);
  assert.equal(prepareSourceProduct(contradictingSpecs).product.description, null);
});


test("Manain: las unidades nuevas se autentican solo con condición documental coherente", async () => {
  const records = await originals();
  for (const reference of ["MAN3178", "MAN3194", "MAN3236", "MAN3192", "MAN3190", "MAN3053", "MAN3209", "MAN2632", "MAN2859", "MAN2922"]) {
    const record = records.find((item) => item.reference === reference);
    assert.ok(record);
    assert.equal(record.condition, "Nuevo", reference);
    assert.equal(record.specs?.["Nueva o usada"], "nueva", reference);
    assert.ok(resolveManainEditorialDomainSource(record), reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.condition, "Nuevo", reference);
    assert.ok(prepared.product.description?.trim(), reference);
    assert.ok(prepared.product.description_general?.trim(), reference);
    assert.deepEqual(prepared.product.spec, normalizeManainTechnicalSpecs(record, record.specs ?? {}));
    assert.deepEqual(prepared.product.images, record.images);
  }
  const sample = records.find((item) => item.reference === "MAN3178");
  assert.ok(sample);
  const rejected: ProductRecord[] = [
    { ...sample, condition: "Segunda mano" },
    { ...sample, specs: { ...sample.specs, "Nueva o usada": "usada" } },
    { ...sample, specs: { ...sample.specs, Estado: "usada" } },
    { ...sample, specs: { "Estado": "nueva" } }
  ];
  for (const changed of rejected) {
    assert.equal(resolveManainEditorialDomainSource(changed), null);
    assert.equal(prepareSourceProduct(changed).product.description, null);
  }
});

test("Manain: marcas con ampersand mantienen identidad exacta aunque la URL suprima el signo", async () => {
  const records = await originals();
  for (const reference of ["MAN664", "MAN630", "MAN634"]) {
    const record = records.find((item) => item.reference === reference);
    assert.ok(record);
    assert.equal(record.brand, "OIL&STEEL");
    assert.equal(resolveManainEditorialDomainSource(record)?.brand, "OIL&STEEL");
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.match(prepared.product.description ?? "", /OIL&STEEL/u);
    assert.deepEqual(prepared.product.images, record.images);
    assert.deepEqual(prepared.product.spec, normalizeManainTechnicalSpecs(record, record.specs ?? {}));
  }
  const source = records.find((item) => item.reference === "MAN664");
  assert.ok(source);
  for (const changed of [
    { ...source, url: source.url.replace("oilsteel", "oilsteels") },
    { ...source, brand: "OIL STEEL" },
    { ...source, specs: { ...source.specs, Marca: "OIL STEEL" } },
    { ...source, url: source.url.replace("manain.com", "manain.com.ejemplo.org") }
  ]) assert.equal(resolveManainEditorialDomainSource(changed), null);
});

test("Manain: el modelo duplicado literalmente en origen se interpreta sin alterar la unidad ni aceptar variantes", async () => {
  const records = await originals();
  for (const reference of ["MAN1623", "MAN1622", "MAN1079", "MAN594"]) {
    const record = records.find((item) => item.reference === reference);
    assert.ok(record);
    assert.equal(record.title, "MT 625 H");
    assert.equal(record.model, "MT 625 H, MT 625 H");
    assert.equal(resolveManainEditorialDomainSource(record)?.model, "MT 625 H");
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.match(prepared.product.description ?? "", /MANITOU MT 625 H/u);
    assert.doesNotMatch(prepared.product.description ?? "", /MT 625 H, MT 625 H/u);
    assert.deepEqual(prepared.product.spec, normalizeManainTechnicalSpecs(record, record.specs ?? {}));
    assert.deepEqual(prepared.product.images, record.images);
  }
  const source = records.find((item) => item.reference === "MAN1623");
  assert.ok(source);
  for (const changed of [
    { ...source, model: "MT 625 H, MT 625 R", specs: { ...source.specs, Modelo: "MT 625 H, MT 625 R" } },
    { ...source, model: "MT 625 H, MT 625 H, MT 625 H", specs: { ...source.specs, Modelo: "MT 625 H, MT 625 H, MT 625 H" } },
    { ...source, specs: { ...source.specs, Modelo: "MT 625 H" } },
    { ...source, url: source.url.replace("mt-625-h", "mt-625-r") }
  ]) assert.equal(resolveManainEditorialDomainSource(changed), null);
});


test("Manain: equipos de compactación con bandeja verificable reutilizan la familia compactadora", async () => {
  const records = await originals();
  for (const reference of ["MAN980", "MAN743", "MAN742"]) {
    const record = records.find((item) => item.reference === reference);
    assert.ok(record);
    assert.equal(resolveEditorialFacts(record)?.family, "compactadora", reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.match(prepared.product.description ?? "", /Compactadora de gasolina/u);
    assert.match(prepared.product.description_general ?? "", /compactación del terreno/u);
    assert.deepEqual(prepared.product.spec, normalizeManainTechnicalSpecs(record, record.specs ?? {}));
    assert.deepEqual(prepared.product.images, record.images);
  }

  const source = records.find((item) => item.reference === "MAN980");
  assert.ok(source);
  const rejected: ProductRecord[] = [
    { ...source, specs: { ...source.specs, "Ancho bandeja": "420 cm" } },
    { ...source, specs: { ...source.specs, "Ancho bandeja": "sin dato" } },
    { ...source, specs: { ...source.specs, "Ancho bandeja": false } },
    { ...source, specs: { ...source.specs, "Ancho bandeja": "" } },
    { ...source, specs: Object.fromEntries(Object.entries(source.specs ?? {}).filter(([key]) => key !== "Ancho bandeja")) },
    { ...source, specs: { ...source.specs, Marca: "OTRA" } },
    { ...source, model: "LF76", specs: { ...source.specs, Modelo: "LF76" } },
    { ...source, url: source.url.replace("manain.com", "manain.com.ejemplo.org") }
  ];
  for (const changed of rejected) {
    assert.equal(resolveEditorialFacts(changed), null);
    assert.equal(prepareSourceProduct(changed).product.description, null);
  }
  const screed = records.find((item) => item.reference === "MAN553");
  assert.ok(screed);
  assert.equal(resolveEditorialFacts(screed)?.family, "regla-vibrante");
  assert.equal(prepareSourceProduct(screed).status, "ready");
});

test("Manain: capacidad del apilador alimenta la composición sin modificar sus specs ni atribuir altura", async () => {
  const records = await originals();
  const source = records.find((item) => item.reference === "MA1824");
  assert.ok(source);
  assert.equal(resolveEditorialFacts(source), null);
  assert.equal(source.specs?.["Capacidad de carga"], undefined);
  const adapted = reconcileManainEditorialSourceSpecs(source);
  assert.notEqual(adapted, source);
  assert.equal(adapted.specs?.["Capacidad de carga"], "1600 kg");
  assert.equal(resolveEditorialFacts(adapted)?.loadCapacityKg, 1600);
  assert.equal(source.specs?.["Capacidad de carga"], undefined);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description ?? "", /capacidad de carga de 1\.600 kg/u);
  assert.doesNotMatch(prepared.product.description_general ?? "", /altura de elevación de/u);
  assert.deepEqual(prepared.product.spec, normalizeManainTechnicalSpecs(source, source.specs ?? {}));
  assert.deepEqual(prepared.product.images, source.images);

  const rejected: ProductRecord[] = [
    { ...source, specs: { ...source.specs, "Capacidad carga": "1600 lb" } },
    { ...source, specs: { ...source.specs, "Capacidad carga": "sin dato" } },
    { ...source, specs: { ...source.specs, "Capacidad carga": 1600 } },
    { ...source, specs: { ...source.specs, Modelo: "OTRO" } },
    { ...source, url: source.url.replace("manain.com", "manain.com.ejemplo.org") },
    { ...source, condition: "Nuevo" }
  ];
  for (const changed of rejected) {
    assert.equal(reconcileManainEditorialSourceSpecs(changed), changed);
    assert.equal(prepareSourceProduct(changed).product.description, null);
  }
  const alreadyNormalized: ProductRecord = {
    ...source, specs: { ...source.specs, "Capacidad de carga": "2000 kg" }
  };
  assert.equal(reconcileManainEditorialSourceSpecs(alreadyNormalized), alreadyNormalized);
});

test("Manain: capacidad de carga por unidad en familias compatibles, sin alterar specs ni propagar variantes", () => {
  const source: ProductRecord = {
    providerId: "manain",
    categoryKey: "venta",
    categoryName: "Maquinaria en venta",
    url: "https://manain.com/producto/venta-elevacion-tijera-marca-modelo10/",
    title: "MODELO10",
    shortDescription: null,
    longDescription: null,
    price: null,
    condition: "Segunda mano",
    reference: "CONTROL-01",
    brand: "MARCA",
    model: "MODELO10",
    year: "2022",
    location: null,
    country: null,
    horometer: "300",
    serialNumber: null,
    image: null,
    specs: {
      Marca: "MARCA", Modelo: "MODELO10", Motor: "Eléctrico", Peso: "2000 kg",
      "Altura trabajo": "10 m", "Capacidad carga": "230 kg", "Nueva o usada": "usada"
    }
  };
  const original = JSON.stringify(source);
  assert.equal(resolveEditorialFacts(source)?.loadCapacityKg, null);
  const adapted = reconcileManainEditorialSourceSpecs(source);
  assert.equal(adapted.specs?.["Capacidad de carga"], "230 kg");
  assert.equal(resolveEditorialFacts(adapted)?.loadCapacityKg, 230);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.match(prepared.product.description_general ?? "", /capacidad de 230 kg/u);
  assert.deepEqual(prepared.product.spec, normalizeManainTechnicalSpecs(source, source.specs ?? {}));
  assert.equal(JSON.stringify(source), original);

  const next: ProductRecord = {
    ...source, reference: "CONTROL-02", url: source.url.replace("modelo10", "modelo11"),
    title: "MODELO11", model: "MODELO11",
    specs: { ...source.specs, Modelo: "MODELO11", "Capacidad carga": "320 kg" }
  };
  assert.match(prepareSourceProduct(next).product.description_general ?? "", /capacidad de 320 kg/u);
  assert.doesNotMatch(prepareSourceProduct(next).product.description_general ?? "", /capacidad de 230 kg/u);

  const rejected: readonly ProductRecord[] = [
    { ...source, specs: { ...source.specs, "Capacidad carga": "230 lb" } },
    { ...source, specs: { ...source.specs, "Capacidad carga": "230 o 320 kg" } },
    { ...source, specs: { ...source.specs, "Capacidad carga": 230 } },
    { ...source, specs: { ...source.specs, "Capacidad de carga": "250 kg" } },
    { ...source, providerId: "gam" },
    { ...source, url: "https://manain.com.ejemplo.org/producto/venta-elevacion-tijera-marca-modelo10/" },
    { ...source, model: "OTRO" },
    { ...source, condition: "Nuevo" },
    { ...source, url: "https://manain.com/producto/venta-energia-grupo-electrogeno-marca-modelo10/" }
  ];
  for (const record of rejected) {
    assert.equal(reconcileManainEditorialSourceSpecs(record), record);
  }
});

test("Manain: plataformas unipersonales componen textos con medidas originales sin cambiar su clasificación a tijera o mástil", async () => {
  const records = await originals();
  for (const reference of ["MA3620", "MA3621", "MA3518", "MA3342"]) {
    const record = records.find((item) => item.reference === reference);
    assert.ok(record);
    assert.equal(resolveEditorialFacts(record)?.family, "plataforma-unipersonal", reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.match(prepared.product.description ?? "", /Plataforma unipersonal eléctrica/u);
    assert.match(prepared.product.description_general ?? "", /altura de trabajo de 4,[5]/u);
    assert.doesNotMatch(prepared.product.description_general ?? "", /plataforma de tijera|mástil vertical/iu);
    assert.deepEqual(prepared.product.images, record.images);
    assert.deepEqual(prepared.product.spec, normalizeManainTechnicalSpecs(record, record.specs ?? {}));
  }

  const source = records.find((item) => item.reference === "MA3620");
  assert.ok(source);
  const invalidRecords: ProductRecord[] = [
    { ...source, url: source.url.replace("manain.com", "manain.com.ejemplo.org") },
    { ...source, specs: { ...source.specs, Modelo: "OTRO" } },
    { ...source, specs: { ...source.specs, "Altura trabajo": "altura desconocida" } },
    { ...source, specs: { ...source.specs, Motor: "desconocido" } },
    { ...source, condition: "Nuevo" }
  ];
  for (const invalid of invalidRecords) {
    assert.equal(prepareSourceProduct(invalid).product.description, null);
    assert.equal(prepareSourceProduct(invalid).product.description_general, null);
  }
});

test("Manain: martillos para miniexcavadora reutilizan el editor sin atribuir al accesorio el motor de la máquina", async () => {
  const records = await originals();
  const references = ["MAN1261", "MAN775", "MAN923", "MAN866", "MAN861", "MAN943",
    "MAN1109", "MAN942", "MAN941", "MAN177", "MAN175"];
  for (const reference of references) {
    const record = records.find((item) => item.reference === reference);
    assert.ok(record);
    assert.equal(record.specs?.Motor, "Diésel");
    assert.equal(resolveManainEditorialDomainSource(record)?.motor, undefined);
    assert.equal(resolveEditorialFacts(record)?.family, "martillo-miniexcavadora");
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.match(prepared.product.description ?? "", /Martillo para miniexcavadora/u);
    assert.match(prepared.product.description_general ?? "", /peso declarado de/u);
    assert.doesNotMatch(prepared.product.description ?? "", /diésel|gasolina|eléctrico/iu);
    assert.doesNotMatch(prepared.product.description_general ?? "", /diésel|gasolina|eléctrico/iu);
    assert.deepEqual(prepared.product.images, record.images);
    assert.deepEqual(prepared.product.spec, normalizeManainTechnicalSpecs(record, record.specs ?? {}));
  }

  const source = records.find((item) => item.reference === "MAN775");
  assert.ok(source);
  const rejected: ProductRecord[] = [
    { ...source, specs: { ...source.specs, Maquina: "sin dato" } },
    { ...source, specs: { ...source.specs, Enganche: "" } },
    { ...source, specs: { ...source.specs, Marca: "OTRA" } },
    { ...source, url: source.url.replace("manain.com", "manain.com.ejemplo.org") },
    { ...source, condition: "Nuevo" }
  ];
  for (const record of rejected) {
    assert.equal(resolveEditorialFacts(record), null);
    assert.equal(prepareSourceProduct(record).product.description, null);
  }
});

test("Manain: la pequeña maquinaria documentada utiliza familias editoriales distintas y conserva las especificaciones", async () => {
  const records = await originals();
  const cases = [
    { reference: "MAN683", family: "radial-electrica", label: "Amoladora radial eléctrica", weight: "5,2" },
    { reference: "MAN682", family: "radial-electrica", label: "Amoladora radial eléctrica", weight: "5,2" },
    { reference: "MAN681", family: "radial-electrica", label: "Amoladora radial eléctrica", weight: "5,2" },
    { reference: "MAN676", family: "martillo-electrico", label: "Martillo eléctrico", weight: "10,1" },
    { reference: "MAN677", family: "martillo-electrico", label: "Martillo eléctrico", weight: "5,5" },
    { reference: "MAN671", family: "martillo-electrico", label: "Martillo eléctrico", weight: "16,9" },
    { reference: "MAN680", family: "martillo-electrico", label: "Martillo eléctrico", weight: "8,9" },
    { reference: "MAN169", family: "martillo-electrico", label: "Martillo eléctrico", weight: "16,9" },
    { reference: "MAN685", family: "hidrolimpiadora", label: "Hidrolimpiadora eléctrica", weight: "27" },
    { reference: "MAN118", family: "bomba-sumergible", label: "Bomba sumergible eléctrica", weight: "10" },
    { reference: "MAN553", family: "regla-vibrante", label: "Regla vibrante de gasolina", weight: "10" }
  ] as const;
  for (const { reference, family, label, weight } of cases) {
    const record = records.find((item) => item.reference === reference);
    assert.ok(record);
    const adapted = reconcileManainEditorialSourceSpecs(record);
    assert.equal(resolveEditorialFacts(adapted)?.family, family, reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.deepEqual(prepared.issues, [], reference);
    assert.ok(prepared.product.description?.startsWith(label), reference);
    assert.ok(prepared.product.description?.includes(`peso declarado de ${weight} kg`), reference);
    assert.ok(prepared.product.description_general?.trim(), reference);
    assert.deepEqual(prepared.product.spec, normalizeManainTechnicalSpecs(record, record.specs ?? {}), reference);
    assert.deepEqual(prepared.product.images, record.images, reference);
    assert.equal(prepared.product.sourceUrl, record.url, reference);
    assert.equal(prepared.product.price, null, reference);
  }
});

test("Manain: los decimales de peso del original solo se interpretan en la entrada editorial", async () => {
  const records = await originals();
  const source = records.find((item) => item.reference === "MAN683");
  assert.ok(source);
  assert.equal(source.specs?.Peso, "5.2000 kg");
  const adapted = reconcileManainEditorialSourceSpecs(source);
  assert.equal(adapted.specs?.Peso, "5,2 kg");
  assert.equal(source.specs?.Peso, "5.2000 kg");
  assert.equal(resolveEditorialFacts(adapted)?.weightKg, 5.2);
  assert.equal(prepareSourceProduct(source).product.spec.Peso, "5.2000 kg");
  const rejected: ProductRecord[] = [
    { ...source, specs: { ...source.specs, Peso: "5.2000 lb" } },
    { ...source, specs: { ...source.specs, Peso: "0.5000 kg" } },
    { ...source, specs: { ...source.specs, Peso: "5.20000 kg" } },
    { ...source, specs: { ...source.specs, Peso: 5.2 } },
    { ...source, specs: { ...source.specs, Motor: "Diésel" } },
    { ...source, specs: { ...source.specs, Marca: "OTRA" } },
    { ...source, url: source.url.replace("manain.com", "manain.com.ejemplo.org") },
    { ...source, condition: "Nuevo" }
  ];
  for (const changed of rejected) {
    assert.equal(prepareSourceProduct(changed).status, "review");
    assert.equal(prepareSourceProduct(changed).product.description, null);
  }
});

test("Manain: las medidas de alcance ambiguas permanecen pendientes sin depender del catálogo", () => {
  const record: ProductRecord = {
    providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
    url: "https://manain.com/producto/venta-manipulacion-manipulador-equiptest-mt1/",
    title: "MT1", shortDescription: null, longDescription: null, price: null,
    condition: "Segunda mano", reference: "PRUEBA-MT1", brand: "EQUIPTEST", model: "MT1",
    year: "2021", location: null, country: null, horometer: "750", serialNumber: null,
    image: "https://manain.com/imagen-mt1.jpg",
    specs: {
      Marca: "EQUIPTEST", Modelo: "MT1", Motor: "Diésel", "Nueva o usada": "usada",
      "Capacidad carga": "4000 kg", "Altura de elevacion max": "14 m",
      "Alcance maximo": "3,09/1,01 m", Peso: "11370 kg"
    }
  };
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.status, "review");
  assert.ok(prepared.issues.includes("Atributo no normalizable: Alcance máximo"));
  assert.equal(prepared.product.spec["Alcance maximo"], "3,09/1,01 m");
});


test("Manain: equipos de corte con disco requieren diámetro, motorización, peso e identidad acreditados", async () => {
  const records = await originals();
  const source = records.find((item) => item.reference === "MAN1188");
  assert.ok(source);
  assert.equal(source.specs?.["Diametro max. disco"], "315 mm");
  assert.equal(resolveEditorialFacts(source)?.family, "equipo-corte-disco");
  assert.equal(resolveEditorialFacts(source)?.discDiameterMm, 315);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.issues, []);
  assert.match(prepared.product.description ?? "", /^Equipo de corte con disco eléctrico HOLZSTAR TKS 316 E/u);
  assert.match(prepared.product.description_general ?? "", /diámetro máximo de disco de 315 mm/u);
  assert.match(prepared.product.description_general ?? "", /peso declarado de 53 kg/u);
  assert.deepEqual(prepared.product.spec, normalizeManainTechnicalSpecs(source, source.specs ?? {}));
  assert.deepEqual(prepared.product.images, source.images);
  assert.equal(prepared.product.sourceUrl, source.url);
  const rejected: ProductRecord[] = [
    { ...source, specs: { ...source.specs, "Diametro max. disco": "315 cm" } },
    { ...source, specs: { ...source.specs, "Diametro max. disco": "40 mm" } },
    { ...source, specs: { ...source.specs, "Diametro max. disco": "700 mm" } },
    { ...source, specs: { ...source.specs, "Diametro max. disco": "315/400 mm" } },
    { ...source, specs: { ...source.specs, Peso: "6 kg" } },
    { ...source, specs: { ...source.specs, Peso: "350 kg" } },
    { ...source, specs: { ...source.specs, Motor: "Diésel" } },
    { ...source, specs: { ...source.specs, Marca: "OTRA" } },
    { ...source, url: source.url.replace("manain.com", "manain.com.ejemplo.org") },
    { ...source, condition: "Nuevo" }
  ];
  for (const record of rejected) {
    assert.equal(resolveEditorialFacts(record), null);
    assert.equal(prepareSourceProduct(record).status, "review");
    assert.equal(prepareSourceProduct(record).product.description, null);
  }
});
