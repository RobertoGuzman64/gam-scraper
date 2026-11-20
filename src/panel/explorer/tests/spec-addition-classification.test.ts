import assert from "node:assert/strict";
import { test } from "node:test";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { readPanelExplorer } from "../read-panel-explorer.js";
import { classifySpecAdditions, loadSpecAdditionAudit } from "../spec-addition-classification.js";
import type { PanelFieldDifference } from "../types.js";

const difference = (field: string, after: string, change: PanelFieldDifference["change"] = "added"): PanelFieldDifference =>
  ({ field, group: "technical", before: null, after, change });

test("clasifica todas las specs realmente incorporadas y no colorea las modificadas", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const explorer = await readPanelExplorer(process.cwd(), snapshot);
  const counts = { own: 0, reused: 0, pending: 0 };
  for (const product of explorer.products) {
    const added = product.changes.filter((item) => item.group === "technical" && item.change === "added");
    assert.equal(product.specAdditions.length, added.length);
    for (const entry of product.specAdditions) {
      assert.equal(added.find((item) => item.field === entry.field)?.after, entry.value);
      counts[entry.kind]++;
    }
  }
  assert.deepEqual(counts, { own: 1903, reused: 646, pending: 349 });
});

test("la reutilización representa un perfil técnico común aplicado a varias fichas", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const source = snapshot.providers.find((item) => item.providerId === "mercaeleva");
  assert.ok(source);
  const shared = audit.entries.filter((item) => item.kind === "reused" &&
    ["M264-2806", "M082-5310"].includes(item.reference ?? "") && item.field === "Alcance horizontal (m)");
  assert.equal(shared.length, 2);
  assert.equal(new Set(shared.map((item) => item.reference)).size, 2);
  assert.equal(new Set(shared.map((item) => item.value)).size, 1);
  for (const item of shared) {
    assert.deepEqual(classifySpecAdditions([difference(item.field, item.value)], source,
      item.reference, item.sourceUrl, audit), [{ field: item.field, value: item.value, kind: "reused" }]);
  }
});

test("reproduce la propia ficha GAM sin confundirla con perfiles compartidos", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const gam = snapshot.providers.find((item) => item.providerId === "gam");
  assert.ok(gam);
  const examples = [
    { reference: "6901", field: "Motorización", value: "Diésel" },
    { reference: "4731", field: "Voltaje batería (V)", value: "24 V" },
    { reference: "4019", field: "Depósito de recuperación", value: "346" },
    { reference: "2219", field: "Frenado regenerativo", value: "true" },
    { reference: "3996", field: "Presión máxima de fregado (kg)", value: "25" }
  ] as const;
  for (const sample of examples) {
    const recorded: (typeof audit.entries)[number] | undefined = audit.entries.find((entry) => entry.providerId === "gam" &&
      entry.reference === sample.reference && entry.field === sample.field && entry.value === sample.value);
    assert.ok(recorded, `${sample.reference}: ${sample.field}`);
    assert.equal(recorded.kind, "own");
    assert.deepEqual(classifySpecAdditions([difference(sample.field, sample.value)], gam,
      recorded.reference, recorded.sourceUrl, audit), [{ field: sample.field, value: sample.value, kind: "own" }]);
  }
});

test("las recuperaciones verificadas de GAM conservan la atribución a su propia ficha", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const gam = snapshot.providers.find((item) => item.providerId === "gam");
  assert.ok(gam);
  const examples = [
    { reference: "6077", field: "Motorización", value: "Eléctrico" },
    { reference: "4738", field: "Frenado automático", value: "true" },
    { reference: "4798", field: "Rotación de torreta", value: "360° (continua)" },
    { reference: "5900", field: "Radio de giro (mm)", value: "7500 mm" },
    { reference: "6423", field: "Nivel sonoro", value: "70,0 dB(A) (asiento del conductor)" }
  ] as const;
  for (const example of examples) {
    const entry: (typeof audit.entries)[number] | undefined = audit.entries.find((item) => item.providerId === "gam" &&
      item.reference === example.reference && item.field === example.field && item.value === example.value);
    assert.ok(entry, `${example.reference}: ${example.field}`);
    assert.equal(entry.kind, "own");
    assert.deepEqual(classifySpecAdditions([difference(entry.field, entry.value)], gam,
      entry.reference, entry.sourceUrl, audit), [{ field: entry.field, value: entry.value, kind: "own" }]);
  }
});

test("las fichas con evidencia textual propia no se confunden con documentos externos", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const explorer = await readPanelExplorer(process.cwd(), snapshot);
  const own = explorer.products.find((product) => product.providerId === "gam" && product.reference === "6834");
  assert.ok(own);
  assert.equal(own.specAdditions.find((entry) => entry.field === "Potencia aparente nominal anunciada")?.kind, "own");
  const external = explorer.products.find((product) => product.providerId === "gam" && product.reference === "6688");
  assert.ok(external);
  assert.equal(external.specAdditions.find((entry) => entry.field === "Altura exterior del modelo")?.kind, "pending");
});

test("recupera el tipo de motor Mercaeleva desde la propia ficha sin compartirlo por coincidencia", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const provider = snapshot.providers.find((item) => item.providerId === "mercaeleva");
  assert.ok(provider);
  const entry: (typeof audit.entries)[number] | undefined = audit.entries.find((item) => item.providerId === "mercaeleva" &&
    item.reference === "M940-4770" && item.field === "Tipo de motor");
  assert.ok(entry);
  assert.equal(entry.value, "Eléctrico");
  assert.equal(entry.kind, "own");
  assert.deepEqual(classifySpecAdditions([difference(entry.field, entry.value)], provider,
    entry.reference, entry.sourceUrl, audit), [{ field: entry.field, value: entry.value, kind: "own" }]);
});

test("reutiliza una fuente técnica de gama en varias fichas de modelos diferentes", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const gam = snapshot.providers.find((item) => item.providerId === "gam");
  assert.ok(gam);
  for (const reference of ["3425", "3426", "3427"] as const) {
    const entry: (typeof audit.entries)[number] | undefined = audit.entries.find((item) => item.providerId === "gam" &&
      item.reference === reference && item.field === "Anchura de bandeja");
    assert.ok(entry, reference);
    assert.equal(entry.value, "2500 mm");
    assert.equal(entry.kind, "reused");
    assert.deepEqual(classifySpecAdditions([difference(entry.field, entry.value)], gam,
      entry.reference, entry.sourceUrl, audit), [{ field: entry.field, value: entry.value, kind: "reused" }]);
  }
});

test("las incorporaciones documentales compartidas entre dos Mercaeleva son reutilizadas", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const provider = snapshot.providers.find((item) => item.providerId === "mercaeleva");
  assert.ok(provider);
  for (const reference of ["M239-6301", "M011-3720"] as const) {
    const entry: (typeof audit.entries)[number] | undefined = audit.entries.find((item) => item.providerId === "mercaeleva" &&
      item.reference === reference && item.field === "Altura de elevación (mm)");
    assert.ok(entry, reference);
    assert.equal(entry.value, "205 mm");
    assert.equal(entry.kind, "reused");
    assert.deepEqual(classifySpecAdditions([difference(entry.field, entry.value)], provider,
      entry.reference, entry.sourceUrl, audit), [{ field: entry.field, value: entry.value, kind: "reused" }]);
  }
});

test("las fuentes documentales declaradas en la ficha individual se distinguen de las externas", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const examples = [
    { providerId: "gam", reference: "6623", field: "Ejes direccionales", value: "Los dos traseros" },
    { providerId: "mercaeleva", reference: "M294-4678", field: "Climatización instalada según anuncio", value: "Aire acondicionado" }
  ] as const;
  for (const example of examples) {
    const provider = snapshot.providers.find((item) => item.providerId === example.providerId);
    assert.ok(provider);
    const entry: (typeof audit.entries)[number] | undefined = audit.entries.find((item) => item.providerId === example.providerId &&
      item.reference === example.reference && item.field === example.field);
    assert.ok(entry);
    assert.equal(entry.value, example.value);
    assert.equal(entry.kind, "own");
    assert.deepEqual(classifySpecAdditions([difference(entry.field, entry.value)], provider,
      entry.reference, entry.sourceUrl, audit), [{ field: entry.field, value: entry.value, kind: "own" }]);
  }
});

test("las correcciones de campos cruzados de GAM se clasifican como propia ficha", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const provider = snapshot.providers.find((item) => item.providerId === "gam");
  assert.ok(provider);
  for (const field of ["Altura de elevación (mm)", "Batería (V / Ah)", "Peso (kg)"] as const) {
    const entry: (typeof audit.entries)[number] | undefined = audit.entries.find((item) => item.providerId === "gam" &&
      item.reference === "2300" && item.field === field);
    assert.ok(entry, field);
    assert.equal(entry.kind, "own");
    assert.deepEqual(classifySpecAdditions([difference(entry.field, entry.value)], provider,
      entry.reference, entry.sourceUrl, audit), [{ field: entry.field, value: entry.value, kind: "own" }]);
  }
});

test("las correcciones verificadas desde la descripción Mercaeleva son propia ficha", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const provider = snapshot.providers.find((item) => item.providerId === "mercaeleva");
  assert.ok(provider);
  const examples = [
    { reference: "M329-6156", field: "Kilómetros (km)", value: "73 883 km" },
    { reference: "M958-0132", field: "Año", value: "2004" }
  ] as const;
  for (const example of examples) {
    const entry: (typeof audit.entries)[number] | undefined = audit.entries.find((item) => item.providerId === "mercaeleva" &&
      item.reference === example.reference && item.field === example.field);
    assert.ok(entry);
    assert.equal(entry.value, example.value);
    assert.equal(entry.kind, "own");
    assert.deepEqual(classifySpecAdditions([difference(entry.field, entry.value)], provider,
      entry.reference, entry.sourceUrl, audit), [{ field: entry.field, value: entry.value, kind: "own" }]);
  }
});

test("una fuente documental común puede aportar la misma spec con valores diferentes por modelo", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const provider = snapshot.providers.find((item) => item.providerId === "gam");
  assert.ok(provider);
  const groups = [
    [
      { reference: "6191", field: "Altura aproximada de cesta", value: "19 m" },
      { reference: "6192", field: "Altura aproximada de cesta", value: "21 m" }
    ],
    [
      { reference: "4683", field: "Distancia entre ejes (mm)", value: "1650 mm" },
      { reference: "4691", field: "Distancia entre ejes (mm)", value: "1700 mm" }
    ],
    [
      { reference: "72", field: "Capacidad de arrastre (kg)", value: "7000 KG" },
      { reference: "73", field: "Capacidad de arrastre (kg)", value: "8000 KG" }
    ],
    [
      { reference: "3434", field: "Anchura de bandeja", value: "1300 mm" },
      { reference: "3435", field: "Anchura de bandeja", value: "1900 mm" },
      { reference: "3436", field: "Anchura de bandeja", value: "2500 mm" }
    ]
  ] as const;
  for (const group of groups) {
    assert.ok(new Set(group.map((item) => item.value)).size > 1);
    for (const example of group) {
      const entry: (typeof audit.entries)[number] | undefined = audit.entries.find((item) => item.providerId === "gam" &&
        item.reference === example.reference && item.field === example.field);
      assert.ok(entry);
      assert.equal(entry.value, example.value);
      assert.equal(entry.kind, "reused");
      assert.deepEqual(classifySpecAdditions([difference(example.field, example.value)], provider,
        entry.reference, entry.sourceUrl, audit), [{ field: example.field, value: example.value, kind: "reused" }]);
    }
  }
});

test("reconoce recuperaciones propias que requieren la secuencia completa de preparación GAM", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const provider = snapshot.providers.find((item) => item.providerId === "gam");
  assert.ok(provider);
  const examples = [
    { reference: "6981", field: "Motorización", value: "Diésel" },
    { reference: "6688", field: "Marca", value: "ALFA ROMEO" },
    { reference: "2218", field: "Capacidad de la batería (Ah)", value: "735-875 Ah" },
    { reference: "2134", field: "Capacidad de arrastre (kg)", value: "5000 KG" }
  ] as const;
  for (const example of examples) {
    const entry: (typeof audit.entries)[number] | undefined = audit.entries.find((item) =>
      item.providerId === "gam" && item.reference === example.reference && item.field === example.field);
    assert.ok(entry, `${example.reference}: ${example.field}`);
    assert.equal(entry.value, example.value);
    assert.equal(entry.kind, "own");
    assert.deepEqual(classifySpecAdditions([difference(entry.field, entry.value)], provider,
      entry.reference, entry.sourceUrl, audit), [{ field: entry.field, value: entry.value, kind: "own" }]);
  }
});

test("las fuentes TECNA y LOGITRANS compartidas identifican ocho incorporaciones reutilizadas", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const provider = snapshot.providers.find((item) => item.providerId === "gam");
  assert.ok(provider);
  const examples = [
    { reference: "297", fields: ["Número de plataformas de carga", "Transporte del carro"] },
    { reference: "298", fields: ["Plataformas de elevación", "Transporte de los carros"] },
    { reference: "299", fields: ["Bloqueo del carro", "Carga y descarga", "Transporte de plataforma rodante"] },
    { reference: "229", fields: ["Configuración de ruedas de carga"] }
  ] as const;
  let classified = 0;
  for (const example of examples) {
    for (const field of example.fields) {
      const entry: (typeof audit.entries)[number] | undefined = audit.entries.find((item) =>
        item.providerId === "gam" && item.reference === example.reference && item.field === field);
      assert.ok(entry, `${example.reference}: ${field}`);
      assert.equal(entry.kind, "reused");
      assert.deepEqual(classifySpecAdditions([difference(field, entry.value)], provider,
        entry.reference, entry.sourceUrl, audit), [{ field, value: entry.value, kind: "reused" }]);
      classified++;
    }
  }
  assert.equal(classified, 8);
});

test("las specs de documentación de una sola ficha permanecen pendientes", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const explorer = await readPanelExplorer(process.cwd(), snapshot);
  for (const example of [
    { providerId: "gam", reference: "6688", field: "Altura exterior del modelo" },
    { providerId: "mercaeleva", reference: "M028-8481", field: "Altura de plataforma" }
  ] as const) {
    const product = explorer.products.find((item) => item.providerId === example.providerId &&
      item.reference === example.reference);
    assert.ok(product);
    assert.equal(product.specAdditions.find((item) => item.field === example.field)?.kind, "pending");
  }
});

test("un lote y un manual externo de una única unidad permanecen grises", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const explorer = await readPanelExplorer(process.cwd(), snapshot);
  const examples = [
    { providerId: "gam", reference: "6993", field: "JLG E300AJP · Capacidad de cesta" },
    { providerId: "mercaeleva", reference: "M028-8481", field: "Altura de plataforma" }
  ] as const;
  for (const example of examples) {
    const product = explorer.products.find((item) => item.providerId === example.providerId &&
      item.reference === example.reference);
    assert.ok(product);
    assert.equal(product.specAdditions.find((item) => item.field === example.field)?.kind, "pending");
  }
});

test("acredita las prestaciones originales documentadas en veinte fichas GAM", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const explorer = await readPanelExplorer(process.cwd(), snapshot);
  const cases = [
    ["3993", "Autonomía anunciada por carga"],
    ["3994", "Autonomía máxima anunciada por carga"],
    ["4013", "Anchura máxima de fregado con cepillo lateral"],
    ["4014", "Anchura máxima de fregado con cepillo lateral"],
    ["4023", "Capacidad del depósito de residuos"],
    ["4028", "Tensión de alimentación de batería"],
    ["4036", "Longitud de cable de alimentación"],
    ["4039", "Longitud de cable de alimentación"],
    ["4650", "Masa mínima autorizada del camión soporte"],
    ["4659", "Longitud de plumín"],
    ["4844", "Masa mínima autorizada del camión soporte"],
    ["4845", "Masa mínima autorizada del camión soporte"],
    ["4847", "Masa del camión soporte anunciada"],
    ["5918", "Autonomía máxima anunciada"],
    ["6148", "Capacidad del depósito de solución"],
    ["6186", "Rotación de torre"],
    ["6187", "Rotación de torre"],
    ["6805", "Autonomía máxima anunciada"],
    ["6807", "Autonomía máxima anunciada en ciudad"],
    ["6834", "Potencia aparente nominal anunciada"]
  ] as const;
  for (const [reference, field] of cases) {
    const product = explorer.products.find((item) => item.providerId === "gam" && item.reference === reference);
    assert.ok(product, reference);
    assert.equal(product.specAdditions.find((item) => item.field === field)?.kind, "own", `${reference}: ${field}`);
  }
});

test("las fuentes técnicas comunes de otros modelos reclasifican diez incorporaciones Mercaeleva", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const explorer = await readPanelExplorer(process.cwd(), snapshot);
  const cases = [
    { reference: "M567-8260", fields: ["Altura de plataforma"] },
    { reference: "M584-9410", fields: ["Altura de plataforma"] },
    { reference: "M665-4166", fields: ["Altura de plataforma", "Anchura de plataforma", "Capacidad máxima de plataforma", "Extensión de plataforma"] },
    { reference: "M887-9469", fields: ["Alcance horizontal (m)", "Altura de plataforma", "Anchura (mm)", "Capacidad máxima de plataforma"] }
  ] as const;
  let classified = 0;
  for (const sample of cases) {
    const product = explorer.products.find((item) => item.providerId === "mercaeleva" && item.reference === sample.reference);
    assert.ok(product, sample.reference);
    for (const field of sample.fields) {
      assert.equal(product.specAdditions.find((item) => item.field === field)?.kind, "reused", `${sample.reference}: ${field}`);
      classified++;
    }
  }
  assert.equal(classified, 10);
  const individual = explorer.products.find((item) => item.providerId === "mercaeleva" && item.reference === "M018-7013");
  assert.ok(individual);
  assert.equal(individual.specAdditions.find((item) => item.field === "Altura de plataforma")?.kind, "pending");
});

test("los lotes reutilizan prestaciones de fichas individuales enlazadas y mantienen las no acreditadas en gris", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const explorer = await readPanelExplorer(process.cwd(), snapshot);
  const samples = [
    { lot: "6971", source: "6738", fields: ["UniCarriers A1N1L18Q · Altura de elevación", "UniCarriers A1N1L18Q · Capacidad de carga"] },
    { lot: "6987", source: "5937", fields: ["Hyster P2.0SD · Altura de elevación", "Hyster P2.0SD · Capacidad de carga"] },
    { lot: "6988", source: "6436", fields: ["Hyster P2.0 · Altura de elevación", "Hyster P2.0 · Capacidad de carga"] },
    { lot: "6988", source: "6860", fields: ["Still RX 60-35 · Altura de elevación", "Still RX 60-35 · Capacidad de carga"] },
    { lot: "6989", source: "5792", fields: ["Toyota LPE200 · Capacidad de carga", "Toyota LPE200 · Longitud de horquillas"] },
    { lot: "6989", source: "6835", fields: ["Yale ERP35VL · Altura de elevación", "Yale ERP35VL · Capacidad de carga"] }
  ] as const;
  let total = 0;
  for (const sample of samples) {
    const product = explorer.products.find((item) => item.providerId === "gam" && item.reference === sample.lot);
    const source = explorer.products.find((item) => item.providerId === "gam" && item.reference === sample.source);
    assert.ok(product, sample.lot);
    assert.ok(source, sample.source);
    for (const field of sample.fields) {
      assert.equal(product.specAdditions.find((item) => item.field === field)?.kind, "reused", `${sample.lot}: ${field}`);
      total++;
    }
  }
  assert.equal(total, 12);
  const lot6971 = explorer.products.find((item) => item.providerId === "gam" && item.reference === "6971");
  assert.ok(lot6971);
  assert.equal(lot6971.specAdditions.find((item) => item.field === "UniCarriers 1Q2L25Q · Capacidad de carga")?.kind, "pending");
  const lot6987 = explorer.products.find((item) => item.providerId === "gam" && item.reference === "6987");
  assert.ok(lot6987);
  assert.equal(lot6987.specAdditions.find((item) => item.field === "Yale MP20 · Capacidad de carga")?.kind, "pending");
});

test("caduca la atribución si cambia el corte, la URL, el campo o el valor", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const example = audit.entries.find((item) => item.providerId === "gam" && item.kind === "own");
  assert.ok(example);
  const provider = snapshot.providers.find((item) => item.providerId === example.providerId);
  assert.ok(provider);
  const additions = [difference(example.field, example.value), difference("Campo cambiado", "7", "changed")];
  assert.deepEqual(classifySpecAdditions(additions, provider, example.reference, example.sourceUrl, audit),
    [{ field: example.field, value: example.value, kind: "own" }]);
  assert.equal(classifySpecAdditions(additions, provider, example.reference, example.sourceUrl + "-otra", audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions([difference(example.field, "valor distinto")], provider,
    example.reference, example.sourceUrl, audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions([difference("Clave distinta", example.value)], provider,
    example.reference, example.sourceUrl, audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions(additions, { ...provider,
    publication: { ...provider.publication, sha256: "f".repeat(64) }
  }, example.reference, example.sourceUrl, audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions(additions, provider, example.reference, example.sourceUrl, null)[0]?.kind, "pending");
});
