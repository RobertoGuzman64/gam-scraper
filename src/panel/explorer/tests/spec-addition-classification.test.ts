import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import type { SpecAdditionAudit } from "../../evidence/spec-addition-audit.js";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { recoverGamPhysicalMeasures } from "../../../preparation/gam/technical/measurements/physical-measures-evidence.js";
import { readPublicationLineage } from "../../evidence/publication-evidence.js";
import { readAccreditedPublication } from "../../../infrastructure/filesystem/catalog/accredited-publication.js";
import { resolvePublicationDirectory } from "../../../infrastructure/filesystem/catalog/publication-identity.js";
import { readPanelExplorer } from "../read-panel-explorer.js";
import { classifySpecAdditions, loadSpecAdditionAudit } from "../spec-addition-classification.js";
import { resolvePanelFieldProvenance } from "../field-provenance.js";
import { compareTechnicalFields } from "../field-differences.js";
import { productIdentity } from "../explorer-identity.js";
import type { PanelFieldDifference, PanelFieldProvenance, PanelSpecAddition } from "../types.js";

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
  assert.deepEqual(counts, { own: 1942, reused: 850, pending: 106 });
});

test("fase 07: la traza del origen conserva los colores y distingue la prueba independiente", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const explorer = await readPanelExplorer(process.cwd(), snapshot);
  let independentOwn = 0;
  let unprovenPending = 0;
  let unprovenReused = 0;
  for (const product of explorer.products) {
    for (const addition of product.specAdditions) {
      const origin = product.provenance.find((entry) => entry.group === "technical" && entry.field === addition.field);
      assert.ok(origin, `${product.identity}: ${addition.field}`);
      assert.equal(origin.historicalApplication, "not-demonstrated");
      if (origin.status === "source-compatible") {
        assert.equal(addition.kind, "own");
        assert.ok(origin.proof);
        if (product.providerId === "gomariz") {
          assert.equal(origin.sourceField, "year");
          assert.equal(origin.sourceValue, addition.value);
          assert.equal(origin.mechanism, null);
        } else {
          assert.equal(product.providerId, "gam");
          assert.ok(origin.sourceField === "url" || origin.sourceField === "longDescription");
          if (origin.sourceField === "url") assert.equal(origin.sourceValue, product.sourceUrl);
          else {
            assert.ok(product.original);
            assert.equal(origin.sourceValue, product.original.generalDescription);
          }
          assert.ok([
            "src/catalog/normalization/gam/year.ts",
            "src/preparation/gam/technical/measurements/work-height-evidence.ts",
            "src/preparation/gam/technical/measurements/measured-machine-specs.ts",
            "src/preparation/gam/technical/measurements/verified-technical-measures.ts",
            "src/preparation/gam/technical/energy/battery-measures-evidence.ts",
            "src/preparation/gam/technical/energy/electric-motor-power-evidence.ts",
            "src/preparation/gam/technical/measurements/operational-measures-evidence.ts",
            "src/preparation/gam/technical/operations/cleaning-tank-evidence.ts",
            "src/preparation/gam/technical/operations/verified-unit-performance-specs.ts",
            "src/preparation/gam/technical/measurements/physical-measures-evidence.ts",
            "src/preparation/gam/technical/measurements/clearance-platform-evidence.ts",
            "src/preparation/gam/technical/energy/autonomy-evidence.ts",
            "src/preparation/gam/technical/measurements/lift-height-evidence.ts",
            "src/preparation/gam/technical/mobility/verified-drivetrain-brakes-evidence.ts",
            "src/preparation/gam/technical/mobility/verified-steering-braking-evidence.ts",
            "src/preparation/gam/technical/measurements/verified-unit-geometry-specs.ts",
            "src/preparation/gam/technical/operations/verified-unit-operation-specs.ts",
            "src/preparation/gam/technical/energy/battery-chemistry-evidence.ts",
            "src/preparation/gam/technical/measurements/reach-evidence.ts",
            "src/preparation/gam/technical/mobility/wheelbase-evidence.ts",
            "src/preparation/gam/technical/mobility/verified-tyre-dimensions-evidence.ts",
            "src/preparation/gam/technical/operations/scrubbing-pressure-evidence.ts",
            "src/preparation/gam/technical/operations/cleaning-productivity-evidence.ts"
          ].includes(origin.mechanism ?? ""));
        }
        independentOwn++;
      } else if (addition.kind === "pending") {
        assert.equal(origin.status, "observed-only");
        unprovenPending++;
      } else if (addition.kind === "reused") {
        assert.equal(origin.status, "observed-only");
        unprovenReused++;
      }
    }
  }
  assert.equal(independentOwn, 1068);
  assert.equal(unprovenPending, 106);
  assert.equal(unprovenReused, 850);
});

test("fases 08 a 16: procedencias propias acreditadas son azules sin matriz", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const originalByProvider = new Map(await Promise.all(snapshot.providers.map(async (provider) => {
    const catalog = await readPortableOriginal(root, provider.providerId);
    return [provider.providerId, new Map(catalog.products.map((record) =>
      [productIdentity(provider.providerId, record.reference, record.url), record]))] as const;
  })));
  const totals = { own: 0, reused: 0, pending: 0 };
  const ownByProvider = { gam: 0, gomariz: 0, mercaeleva: 0 };
  for (const product of explorer.products) {
    const provider = snapshot.providers.find((item) => item.providerId === product.providerId);
    assert.ok(provider);
    const original = originalByProvider.get(product.providerId)?.get(product.identity);
    const additions = classifySpecAdditions(product.changes, provider, product.reference, product.sourceUrl,
      null, original, product.provenance);
    assert.equal(additions.length, product.specAdditions.length);
    for (const addition of additions) {
      totals[addition.kind]++;
      const originalAddition = product.specAdditions.find((item) => item.field === addition.field);
      assert.equal(addition.value, originalAddition?.value);
      if (addition.kind === "own") {
        assert.equal(originalAddition?.kind, "own");
        ownByProvider[product.providerId]++;
      }
    }
  }
  assert.deepEqual(totals, { own: 1068, reused: 0, pending: 1830 });
  assert.deepEqual(ownByProvider, { gam: 901, gomariz: 167, mercaeleva: 0 });
});

test("fase 08: la atribución automática exige prueba propia, identidad y hashes vigentes", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const product = explorer.products.find((item) => item.providerId === "gomariz" &&
    item.provenance.some((evidence) => evidence.group === "technical" && evidence.status === "source-compatible"));
  assert.ok(product);
  assert.ok(product.published);
  const provider = snapshot.providers.find((item) => item.providerId === product.providerId);
  assert.ok(provider);
  assert.equal(provider.original.status, "verified");
  const catalog = await readPortableOriginal(root, product.providerId);
  const original = catalog.products.find((item) => item.reference === product.reference && item.url === product.sourceUrl);
  assert.ok(original);
  const proof = product.provenance.find((item) => item.group === "technical" && item.status === "source-compatible");
  assert.ok(proof);
  const change = product.changes.find((item) => item.group === "technical" && item.field === proof.field);
  assert.ok(change);
  const classify = (evidence: readonly PanelFieldProvenance[] = [proof], record = original, target = provider) =>
    classifySpecAdditions([change], target, product.reference, product.sourceUrl, null, record, evidence)[0]?.kind;
  assert.equal(classify(), "own");
  assert.equal(classify([]), "pending");
  assert.equal(classify([{ ...proof, status: "mechanism-compatible" }]), "pending");
  assert.equal(classify([{ ...proof, sourceField: "title" }]), "pending");
  assert.equal(classify([{ ...proof, sourceValue: "2015" }]), "pending");
  assert.equal(classify([{ ...proof, scope: "unknown" }]), "pending");
  assert.equal(classify([{ ...proof, originalSha256: "e".repeat(64) }]), "pending");
  assert.equal(classify([{ ...proof, publicationSha256: "e".repeat(64) }]), "pending");
  assert.equal(classify([{ ...proof, proof: null }]), "pending");
  assert.equal(classify([{ ...proof, proof: { ...provider.original.artifact, path: "otra-ruta" } }]), "pending");
  assert.equal(classify([{ ...proof, proof: { ...provider.original.artifact, sha256: "e".repeat(64) } }]), "pending");
  assert.equal(classify([proof], { ...original, yearSource: "descripcion" }), "pending");
  assert.equal(classify([proof], { ...original, year: "1999" }), "pending");
  assert.equal(classify([proof], { ...original, reference: "otra" }), "pending");
  assert.equal(classify([proof], { ...original, url: original.url + "-otra" }), "pending");
  assert.equal(classify([proof], original, { ...provider, publication: { ...provider.publication, sha256: "e".repeat(64) } }), "pending");
  assert.equal(classify([proof], original, { ...provider, original: {
    status: "unavailable", expectedSha256: provider.original.artifact.sha256, reason: "Original no verificado"
  } }), "pending");
  assert.equal(classify([proof], original, { ...provider, original: { ...provider.original,
    artifact: { ...provider.original.artifact, sha256: "e".repeat(64) }
  } }), "pending");
  const publishedAfterCut = { ...provider, publication: { ...provider.publication, sha256: "e".repeat(64) } };
  const freshProvenance = resolvePanelFieldProvenance(original, product.published, [change],
    publishedAfterCut, null, product.reference, product.sourceUrl);
  assert.equal(classify(freshProvenance, original, publishedAfterCut), "own");
  assert.equal(classifySpecAdditions([{ ...change, change: "changed" }], provider, product.reference,
    product.sourceUrl, null, original, [proof]).length, 0);
  assert.equal(classifySpecAdditions([{ ...change, group: "content" }], provider, product.reference,
    product.sourceUrl, null, original, [proof]).length, 0);
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  assert.equal(classifySpecAdditions([change], provider, product.reference, product.sourceUrl,
    audit, original, [proof])[0]?.kind, "own");
  const priorDecision: SpecAdditionAudit = { version: 1, cuts: audit.cuts, entries: [{
    providerId: product.providerId, reference: product.reference, sourceUrl: product.sourceUrl,
    field: change.field, value: change.after ?? "", kind: "reused"
  }] };
  assert.equal(classifySpecAdditions([change], provider, product.reference, product.sourceUrl,
    priorDecision, original, [proof])[0]?.kind, "reused");
  const incompatibleDecision: SpecAdditionAudit = { ...priorDecision, entries: [{
    ...priorDecision.entries[0]!, value: "valor distinto"
  }] };
  assert.equal(classifySpecAdditions([change], provider, product.reference, product.sourceUrl,
    incompatibleDecision, original, [proof])[0]?.kind, "own");
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

test("las specs sin prueba siguen grises y las documentadas de fabricante pasan a naranja", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const explorer = await readPanelExplorer(process.cwd(), snapshot);
  for (const example of [
    { providerId: "gam", reference: "6688", field: "Altura exterior del modelo", expected: "pending" },
    { providerId: "mercaeleva", reference: "M028-8481", field: "Altura de plataforma", expected: "reused" }
  ] as const) {
    const product = explorer.products.find((item) => item.providerId === example.providerId &&
      item.reference === example.reference);
    assert.ok(product);
    assert.equal(product.specAdditions.find((item) => item.field === example.field)?.kind, example.expected);
  }
});

test("un lote ambiguo permanece gris y un manual acreditado pasa a naranja", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const explorer = await readPanelExplorer(process.cwd(), snapshot);
  const examples = [
    { providerId: "gam", reference: "6993", field: "JLG E300AJP · Capacidad de cesta", expected: "pending" },
    { providerId: "mercaeleva", reference: "M028-8481", field: "Altura de plataforma", expected: "reused" }
  ] as const;
  for (const example of examples) {
    const product = explorer.products.find((item) => item.providerId === example.providerId &&
      item.reference === example.reference);
    assert.ok(product);
    assert.equal(product.specAdditions.find((item) => item.field === example.field)?.kind, example.expected);
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
  assert.equal(individual.specAdditions.find((item) => item.field === "Altura de plataforma")?.kind, "reused");
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

test("preserva la revisión entre publicaciones y caduca ante cambios de identidad, spec u original", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  const example = audit.entries.find((item) => item.providerId === "gam" && item.kind === "own");
  assert.ok(example);
  const provider = snapshot.providers.find((item) => item.providerId === example.providerId);
  assert.ok(provider);
  assert.equal(provider.original.status, "verified");
  const additions = [difference(example.field, example.value), difference("Campo cambiado", "7", "changed")];
  const expected = [{ field: example.field, value: example.value, kind: "own" }];
  assert.deepEqual(classifySpecAdditions(additions, provider, example.reference, example.sourceUrl, audit), expected);
  const anotherPublication = { ...provider, publication: { ...provider.publication, sha256: "f".repeat(64) } };
  assert.deepEqual(classifySpecAdditions(additions, anotherPublication,
    example.reference, example.sourceUrl, audit), expected);
  assert.equal(classifySpecAdditions(additions, provider, "referencia-distinta", example.sourceUrl, audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions(additions, provider, example.reference, example.sourceUrl + "-otra", audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions([difference(example.field, "valor distinto")], provider,
    example.reference, example.sourceUrl, audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions([difference("Clave distinta", example.value)], provider,
    example.reference, example.sourceUrl, audit)[0]?.kind, "pending");
  assert.deepEqual(classifySpecAdditions([difference(example.field, example.value, "changed")], provider,
    example.reference, example.sourceUrl, audit), []);
  assert.deepEqual(classifySpecAdditions([{ ...difference(example.field, example.value), group: "content" }], provider,
    example.reference, example.sourceUrl, audit), []);
  assert.deepEqual(classifySpecAdditions([{ ...difference(example.field, example.value), change: "ambiguous" }], provider,
    example.reference, example.sourceUrl, audit), []);
  assert.equal(classifySpecAdditions(additions, { ...provider,
    original: { status: "unavailable", expectedSha256: provider.original.artifact.sha256, reason: "Original ausente" }
  }, example.reference, example.sourceUrl, audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions(additions, { ...provider,
    original: { ...provider.original, artifact: { ...provider.original.artifact, sha256: "f".repeat(64) } }
  }, example.reference, example.sourceUrl, audit)[0]?.kind, "pending");
  const otherProvider = snapshot.providers.find((item) => item.providerId === "gomariz");
  assert.ok(otherProvider);
  assert.equal(classifySpecAdditions(additions, otherProvider,
    example.reference, example.sourceUrl, audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions(additions, provider, example.reference, example.sourceUrl, null)[0]?.kind, "pending");
});

test("las publicaciones históricas acreditadas conservan las 2588 decisiones con original idéntico", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  const counts = { own: 0, reused: 0, pending: 0 };
  for (const provider of snapshot.providers) {
    assert.ok(provider.previousApprovalSha256);
    assert.equal(provider.original.status, "verified");
    const folder = await resolvePublicationDirectory(join(root, "catalogs", "providers", provider.providerId, "publications"),
      provider.previousApprovalSha256);
    assert.ok(folder);
    const path = join(folder, `${provider.providerId}-publishable.json`);
    const historical = await readAccreditedPublication(path);
    const lineage = await readPublicationLineage(root, path, provider.providerId, historical.products.length);
    assert.equal(lineage.source.sha256, provider.original.artifact.sha256);
    assert.notEqual(historical.sha256, provider.publication.sha256);
    const byIdentity = new Map(historical.products.map((item) =>
      [productIdentity(provider.providerId, item.reference, item.sourceUrl), item]));
    for (const current of explorer.products.filter((item) => item.providerId === provider.providerId && item.published)) {
      assert.ok(current.original);
      const earlier = byIdentity.get(current.identity);
      assert.ok(earlier);
      const additions = classifySpecAdditions(compareTechnicalFields(current.original.specs, earlier.spec),
        { ...provider, publication: { ...provider.publication, sha256: historical.sha256 } },
        current.reference, current.sourceUrl, audit);
      assert.deepEqual(additions, current.specAdditions, current.identity);
      for (const addition of additions) counts[addition.kind]++;
    }
  }
  assert.deepEqual(counts, { own: 1942, reused: 850, pending: 106 });
});

const accreditedOwnTextPhase01 = [
  {"providerId": "gam", "reference": "6805", "field": "Velocidad máxima", "sourceExcerpt": "velocidad máxima de 45 km/h"},
  {"providerId": "gam", "reference": "6805", "field": "Tensión nominal de batería", "sourceExcerpt": "baterías de litio extraíble (60V 24Ah)"},
  {"providerId": "gam", "reference": "6807", "field": "Velocidad máxima del modelo", "sourceExcerpt": "velocidad máxima de 139 km/h"},
  {"providerId": "gam", "reference": "6807", "field": "Capacidad nominal de batería", "sourceExcerpt": "batería de 14,4 kWh"},
  {"providerId": "gam", "reference": "5918", "field": "Capacidad de carga anunciada, conductor incluido", "sourceExcerpt": "hasta 240 kg (incluido el conductor)"},
  {"providerId": "gam", "reference": "5918", "field": "Volumen de carga anunciado", "sourceExcerpt": "compartimento de carga de hasta 1.200 litros"},
  {"providerId": "gam", "reference": "6806", "field": "Velocidad máxima anunciada", "sourceExcerpt": "velocidad máxima de 45 km/h"},
  {"providerId": "gam", "reference": "6186", "field": "Alcance lateral máximo", "sourceExcerpt": "alcance lateral de hasta 12,70 m"},
  {"providerId": "gam", "reference": "6186", "field": "Altura máxima de cesta", "sourceExcerpt": "altura de cesta de 21,60 m"},
  {"providerId": "gam", "reference": "6186", "field": "Dimensiones de cesta", "sourceExcerpt": "dimensiones de 1.400 x 700 x 1.100 mm"},
  {"providerId": "gam", "reference": "6187", "field": "Alcance lateral máximo", "sourceExcerpt": "alcance lateral de hasta 10,50 m"},
  {"providerId": "gam", "reference": "6187", "field": "Altura máxima de cesta", "sourceExcerpt": "altura de cesta de 15,70 m"},
  {"providerId": "gam", "reference": "6187", "field": "Dimensiones de cesta", "sourceExcerpt": "dimensiones de 1,40 x 0,70 x 1,10 m"},
  {"providerId": "gam", "reference": "6746", "field": "Centro de carga (mm)", "sourceExcerpt": "centro de carga de 600 mm"},
  {"providerId": "gam", "reference": "6746", "field": "Altura máxima de preparación", "sourceExcerpt": "alturas de preparación de hasta 4,8 m"},
  {"providerId": "gam", "reference": "6746", "field": "Accionamiento de traslación", "sourceExcerpt": "accionamiento eléctrico por batería"},
  {"providerId": "gam", "reference": "226", "field": "Material del chasis de horquillas", "sourceExcerpt": "acero resistente al ácido AISI 316L para el chasis de las horquillas"},
  {"providerId": "gam", "reference": "226", "field": "Configuración de horquillas", "sourceExcerpt": "Las horquillas están cerradas"},
  {"providerId": "gam", "reference": "227", "field": "Material del chasis de horquillas", "sourceExcerpt": "acero resistente al ácido AISI 316L para el chasis de las horquillas"},
  {"providerId": "gam", "reference": "227", "field": "Configuración de horquillas", "sourceExcerpt": "Las horquillas están cerradas"},
  {"providerId": "gam", "reference": "228", "field": "Material del chasis de horquillas", "sourceExcerpt": "acero resistente al ácido AISI 316L para el chasis de las horquillas"},
  {"providerId": "gam", "reference": "228", "field": "Configuración de horquillas", "sourceExcerpt": "Las horquillas están cerradas"},
  {"providerId": "gam", "reference": "217", "field": "Rotación de bidón", "sourceExcerpt": "volteo de 360º"},
  {"providerId": "gam", "reference": "217", "field": "Diámetro admitido de bidón", "sourceExcerpt": "Ø 300 hasta Ø 600"},
  {"providerId": "gam", "reference": "217", "field": "Material de bidón admitido", "sourceExcerpt": "bidones de acero y plástico"},
  {"providerId": "gam", "reference": "216", "field": "Diámetro máximo de bobina", "sourceExcerpt": "hasta Ø1270 mm"},
  {"providerId": "gam", "reference": "216", "field": "Anchura máxima de bobina", "sourceExcerpt": "longitudes hasta 520 mm"},
  {"providerId": "gam", "reference": "212", "field": "Inclinación de cajas", "sourceExcerpt": "también 180°"},
  {"providerId": "gam", "reference": "4817", "field": "Potencia nominal del motor", "sourceExcerpt": "motor diésel de 74 kW"},
  {"providerId": "gam", "reference": "4819", "field": "Capacidad a máxima altura de elevación", "sourceExcerpt": "A la altura máxima, el XT4018KH puede levantar hasta 2.500 kg"},
  {"providerId": "gam", "reference": "4029", "field": "Anchura del cepillo principal", "sourceExcerpt": "cepillo principal de 810 mm"},
  {"providerId": "gam", "reference": "4029", "field": "Anchura del cepillo lateral", "sourceExcerpt": "cepillo lateral de 510 mm"},
  {"providerId": "gam", "reference": "4029", "field": "Capacidad de la tolva", "sourceExcerpt": "capacidad de la tolva de 150 litros"},
  {"providerId": "gam", "reference": "4031", "field": "Capacidad de tolva", "sourceExcerpt": "tolva de 310 litros"},
  {"providerId": "gam", "reference": "4018", "field": "Depósito de solución", "sourceExcerpt": "depósito de solución de 303 litros"},
  {"providerId": "gam", "reference": "235", "field": "Ensayo de durabilidad", "sourceExcerpt": "hasta 46000 elevaciones"},
  {"providerId": "mercaeleva", "reference": "M736-5615", "field": "Capacidad de carga (kg)", "sourceExcerpt": "CAPACIDAD DE CARGA 4500 KG"},
  {"providerId": "mercaeleva", "reference": "M958-0132", "field": "Capacidad nominal de carga", "sourceExcerpt": "APILADOR ELECTRICO 1600 KG"},
  {"providerId": "mercaeleva", "reference": "M547-2372", "field": "Capacidad nominal según texto comercial", "sourceExcerpt": "TRANSPALET ELECTRICO 1350 KG"},
] as const;

test("fase 01: atribuye a la propia ficha solo los datos acreditados en su texto original", async () => {
  const snapshot = await readPanelSnapshot(process.cwd());
  const explorer = await readPanelExplorer(process.cwd(), snapshot);
  const audit = await loadSpecAdditionAudit(process.cwd());
  assert.ok(audit);
  for (const sample of accreditedOwnTextPhase01) {
    const product = explorer.products.find((item) => item.providerId === sample.providerId && item.reference === sample.reference);
    assert.ok(product, `${sample.providerId}:${sample.reference}`);
    const source = [product.original?.title, product.original?.shortDescription, product.original?.generalDescription]
      .filter((text): text is string => typeof text === "string").join(" ");
    assert.ok(source.includes(sample.sourceExcerpt), `${sample.reference}: evidencia original ausente: ${sample.sourceExcerpt}`);
    const addition = product.specAdditions.find((item) => item.field === sample.field);
    assert.ok(addition, `${sample.reference}: ${sample.field}`);
    assert.equal(addition.kind, "own", `${sample.reference}: ${sample.field}`);
    assert.ok(audit.entries.some((item) => item.providerId === sample.providerId &&
      item.reference === sample.reference && item.sourceUrl === product.sourceUrl &&
      item.field === sample.field && item.value === addition.value && item.kind === "own"));
  }
  assert.equal(accreditedOwnTextPhase01.length, 39);
});


test("fase 04: una ficha original modificada invalida solo sus propias decisiones", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  assert.equal(audit.version, 2);
  const provider = snapshot.providers.find((item) => item.providerId === "gam");
  assert.ok(provider);
  assert.equal(provider.original.status, "verified");
  const catalog = await readPortableOriginal(root, "gam");
  const entries = audit.entries.filter((item) => item.providerId === "gam");
  const source = entries[0];
  const other = entries.find((item) => item.reference !== source?.reference);
  assert.ok(source);
  assert.ok(other);
  const original = catalog.products.find((item) => item.reference === source.reference && item.url === source.sourceUrl);
  const independent = catalog.products.find((item) => item.reference === other.reference && item.url === other.sourceUrl);
  assert.ok(original);
  assert.ok(independent);
  const changedProvider = {
    ...provider, original: { ...provider.original, artifact: { ...provider.original.artifact, sha256: "e".repeat(64) } }
  };
  const sourceAddition = [difference(source.field, source.value)];
  const otherAddition = [difference(other.field, other.value)];
  assert.equal(classifySpecAdditions(sourceAddition, changedProvider, source.reference, source.sourceUrl,
    audit, original)[0]?.kind, source.kind);
  assert.equal(classifySpecAdditions(sourceAddition, changedProvider, source.reference, source.sourceUrl,
    audit, { ...original, title: `${original.title ?? ""} (actualizada)` })[0]?.kind, "pending");
  assert.equal(classifySpecAdditions(sourceAddition, provider, source.reference, source.sourceUrl,
    audit, { ...original, title: `${original.title ?? ""} (actualizada)` })[0]?.kind, "pending");
  assert.equal(classifySpecAdditions(sourceAddition, changedProvider, source.reference, source.sourceUrl,
    audit)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions(sourceAddition, changedProvider, source.reference, source.sourceUrl + "-other",
    audit, original)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions([difference(source.field, source.value + " distinto")], changedProvider,
    source.reference, source.sourceUrl, audit, original)[0]?.kind, "pending");
  assert.equal(classifySpecAdditions([difference(source.field, source.value, "changed")], changedProvider,
    source.reference, source.sourceUrl, audit, original).length, 0);
  assert.equal(classifySpecAdditions(otherAddition, changedProvider, other.reference, other.sourceUrl,
    audit, independent)[0]?.kind, other.kind);
  const old: SpecAdditionAudit = { version: 1, cuts: audit.cuts, entries: audit.entries };
  assert.equal(classifySpecAdditions(sourceAddition, provider, source.reference, source.sourceUrl,
    old, original)[0]?.kind, source.kind);
  assert.equal(classifySpecAdditions(sourceAddition, changedProvider, source.reference, source.sourceUrl,
    old, original)[0]?.kind, "pending");
});

test("fase 09: GAM requiere URL verificada y no sobreescribe la auditoría revisada", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const provider = snapshot.providers.find((item) => item.providerId === "gam");
  assert.ok(provider);
  const records = (await readPortableOriginal(root, "gam")).products;
  const sample = records.find((item) => item.yearSource === "url" && explorer.products.some((product) =>
    product.providerId === "gam" && product.reference === item.reference && product.sourceUrl === item.url &&
    product.provenance.some((origin) => origin.sourceField === "url" && origin.status === "source-compatible")));
  assert.ok(sample);
  const product = explorer.products.find((item) => item.providerId === "gam" &&
    item.reference === sample.reference && item.sourceUrl === sample.url);
  assert.ok(product);
  const proof = product.provenance.find((item) => item.sourceField === "url" && item.status === "source-compatible");
  assert.ok(proof);
  const added = product.changes.find((item) => item.group === "technical" && item.change === "added" &&
    item.field === proof.field);
  assert.ok(added);
  const classify = (record = sample, evidence: readonly PanelFieldProvenance[] = [proof],
    origin = provider) => classifySpecAdditions([added], origin, product.reference, product.sourceUrl,
    null, record, evidence)[0]?.kind;
  assert.equal(classify(), "own");
  assert.equal(classify(sample, []), "pending");
  assert.equal(classify(sample, [{ ...proof, sourceValue: sample.url + "/extra" }]), "pending");
  assert.equal(classify(sample, [{ ...proof, sourceField: "year" }]), "pending");
  assert.equal(classify(sample, [{ ...proof, mechanism: null }]), "pending");
  assert.equal(classify(sample, [{ ...proof, proof: null }]), "pending");
  assert.equal(classify(sample, [{ ...proof, originalSha256: "f".repeat(64) }]), "pending");
  assert.equal(classify(sample, [{ ...proof, publicationSha256: "f".repeat(64) }]), "pending");
  assert.equal(classify({ ...sample, yearSource: "titulo" }), "pending");
  assert.equal(classify({ ...sample, url: sample.url.replace("online.gamrentals.com", "example.com") }), "pending");
  assert.equal(classify({ ...sample, year: "1999" }), "pending");
  assert.equal(classify({ ...sample, specs: { ...sample.specs, Año: sample.year ?? "" } }), "pending");
  assert.equal(classify(sample, [proof], { ...provider, publication: { ...provider.publication,
    sha256: "f".repeat(64) } }), "pending");
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  const reviewed: SpecAdditionAudit = { version: 1, cuts: audit.cuts, entries: [{
    providerId: "gam", reference: sample.reference, sourceUrl: sample.url,
    field: added.field, value: added.after ?? "", kind: "reused"
  }] };
  assert.equal(classifySpecAdditions([added], provider, product.reference, product.sourceUrl,
    reviewed, sample, [proof])[0]?.kind, "reused");
});


test("fase 10: dos años GAM proceden de su descripción original y conservan prioridad de revisión", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const gam = snapshot.providers.find((provider) => provider.providerId === "gam");
  assert.ok(gam);
  const records = (await readPortableOriginal(root, "gam")).products;
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  for (const [reference, year] of [["6195", "2016"], ["6196", "2015"]] as const) {
    const original = records.find((record) => record.reference === reference);
    const product = explorer.products.find((record) => record.providerId === "gam" && record.reference === reference);
    assert.ok(original);
    assert.ok(product);
    assert.equal(original.yearSource, "descripcion");
    assert.equal(original.year, year);
    const difference = product.changes.find((item) => item.group === "technical" &&
      item.field === "Año" && item.change === "added");
    assert.ok(difference);
    const proof = product.provenance.find((item) => item.group === "technical" && item.field === difference.field);
    assert.ok(proof);
    assert.equal(proof.status, "source-compatible");
    assert.equal(proof.sourceField, "longDescription");
    assert.equal(proof.sourceValue, original.longDescription);
    const classify = (record = original, evidence: readonly PanelFieldProvenance[] = [proof]): PanelSpecAddition["kind"] | undefined =>
      classifySpecAdditions([difference], gam, product.reference, product.sourceUrl,
        null, record, evidence)[0]?.kind;
    assert.equal(classify(), "own");
    assert.equal(classify(original, []), "pending");
    assert.equal(classify(original, [{ ...proof, sourceField: "url" }]), "pending");
    assert.equal(classify(original, [{ ...proof, sourceValue: original.url }]), "pending");
    assert.equal(classify(original, [{ ...proof, mechanism: null }]), "pending");
    assert.equal(classify(original, [{ ...proof, originalSha256: "e".repeat(64) }]), "pending");
    assert.equal(classify({ ...original, longDescription: "Fabricada en 2020" }), "pending");
    assert.equal(classify({ ...original, year: "2020" }), "pending");
    assert.equal(classify({ ...original, yearSource: "titulo" }), "pending");
    const reviewed: SpecAdditionAudit = { version: 1, cuts: audit.cuts, entries: [{
      providerId: "gam", reference, sourceUrl: product.sourceUrl, field: difference.field,
      value: year, kind: "reused"
    }] };
    assert.equal(classifySpecAdditions([difference], gam, product.reference, product.sourceUrl,
      reviewed, original, [proof])[0]?.kind, "reused");
  }
});

test("fase 11: tres recuperadores textuales existentes acreditan 84 medidas propias sin matriz", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const gam = snapshot.providers.find((provider) => provider.providerId === "gam");
  assert.ok(gam);
  const catalog = await readPortableOriginal(root, "gam");
  const originals = new Map(catalog.products.map((record) => [productIdentity("gam", record.reference, record.url), record]));
  const byMechanism = new Map<string, number>();
  const expected = {
    "src/preparation/gam/technical/measurements/work-height-evidence.ts": 23,
    "src/preparation/gam/technical/measurements/verified-technical-measures.ts": 19,
    "src/preparation/gam/technical/measurements/measured-machine-specs.ts": 42
  };
  for (const product of explorer.products.filter((item) => item.providerId === "gam")) {
    const original = originals.get(product.identity);
    if (!original) continue;
    for (const addition of product.specAdditions) {
      const proof = product.provenance.find((entry) => entry.group === "technical" && entry.field === addition.field);
      if (!proof?.mechanism || !(proof.mechanism in expected)) continue;
      assert.equal(addition.kind, "own");
      assert.equal(proof.status, "source-compatible");
      assert.equal(proof.sourceField, "longDescription");
      assert.equal(proof.sourceValue, original.longDescription);
      assert.equal(proof.historicalApplication, "not-demonstrated");
      assert.equal(classifySpecAdditions([difference(addition.field, addition.value)], gam,
        product.reference, product.sourceUrl, null, original, [proof])[0]?.kind, "own");
      byMechanism.set(proof.mechanism, (byMechanism.get(proof.mechanism) ?? 0) + 1);
    }
  }
  assert.deepEqual(Object.fromEntries(byMechanism), expected);
});

test("fase 11: las medidas textuales requieren identidad, extracción exacta y prueba verificada", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const gam = snapshot.providers.find((provider) => provider.providerId === "gam");
  assert.ok(gam);
  const catalog = await readPortableOriginal(root, "gam");
  const original = catalog.products.find((item) => item.reference === "4731");
  assert.ok(original);
  const field = "Altura de trabajo (m)";
  const value = "5,9 m";
  const publication = {
    title: original.title, shortDescription: original.shortDescription,
    generalDescription: original.longDescription, category: original.categoryName,
    price: original.price, image: original.image, images: original.images ?? [],
    specs: { ...original.specs, [field]: value }
  };
  const differences = compareTechnicalFields(original.specs ?? {}, publication.specs);
  const change = differences.find((entry) => entry.change === "added" && entry.field === field);
  assert.ok(change);
  const proof = resolvePanelFieldProvenance(original, publication, [change], gam, null,
    original.reference, original.url)[0];
  assert.ok(proof);
  assert.equal(proof.status, "source-compatible");
  assert.equal(proof.mechanism, "src/preparation/gam/technical/measurements/work-height-evidence.ts");
  const classify = (record = original, evidence: readonly PanelFieldProvenance[] = [proof], provider = gam) =>
    classifySpecAdditions([change], provider, original.reference, original.url, null, record, evidence)[0]?.kind;
  assert.equal(classify(), "own");
  assert.equal(classify(original, []), "pending");
  assert.equal(classify(original, [{ ...proof, status: "mechanism-compatible" }]), "pending");
  assert.equal(classify(original, [{ ...proof, sourceValue: "dato externo" }]), "pending");
  assert.equal(classify(original, [{ ...proof, mechanism: "src/preparation/shared/technical/recovery/documented-technical-recovery.ts" }]), "pending");
  assert.equal(classify(original, [{ ...proof, publicationSha256: "b".repeat(64) }]), "pending");
  assert.equal(classify(original, [{ ...proof, proof: null }]), "pending");
  assert.equal(classify({ ...original, longDescription: "Texto sin altura de trabajo" }), "pending");
  assert.equal(classify({ ...original, specs: { ...original.specs, [field]: value } }), "pending");
  assert.equal(classify({ ...original, url: original.url.replace("online.gamrentals.com", "example.com") }), "pending");
  assert.equal(classify({ ...original, url: original.url + "?rev=1" }), "pending");
  assert.equal(classify({ ...original, providerId: "mercaeleva" }), "pending");
  assert.equal(classify(original, [proof], { ...gam, original: {
    status: "unavailable", expectedSha256: gam.original.status === "verified" ? gam.original.artifact.sha256 : "",
    reason: "No verificado"
  } }), "pending");
});


test("fase 12: batería y motores eléctricos acreditan 144 specs propias sin matriz", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const gam = snapshot.providers.find((provider) => provider.providerId === "gam");
  assert.ok(gam);
  const catalog = await readPortableOriginal(root, "gam");
  const originals = new Map(catalog.products.map((record) => [productIdentity("gam", record.reference, record.url), record]));
  const byMechanism = new Map<string, number>();
  const phase12Mechanisms = new Set([
    "src/preparation/gam/technical/energy/battery-measures-evidence.ts",
    "src/preparation/gam/technical/energy/electric-motor-power-evidence.ts"
  ]);
  for (const product of explorer.products.filter((item) => item.providerId === "gam")) {
    const original = originals.get(product.identity);
    if (!original) continue;
    for (const addition of product.specAdditions) {
      const proof = product.provenance.find((entry) => entry.group === "technical" && entry.field === addition.field);
      if (!proof?.mechanism || !phase12Mechanisms.has(proof.mechanism)) continue;
      assert.equal(addition.kind, "own");
      assert.equal(proof.status, "source-compatible");
      assert.equal(proof.sourceField, "longDescription");
      assert.equal(proof.sourceValue, original.longDescription);
      assert.equal(proof.historicalApplication, "not-demonstrated");
      assert.equal(classifySpecAdditions([difference(addition.field, addition.value)], gam,
        product.reference, product.sourceUrl, null, original, [proof])[0]?.kind, "own");
      byMechanism.set(proof.mechanism, (byMechanism.get(proof.mechanism) ?? 0) + 1);
    }
  }
  assert.deepEqual(Object.fromEntries(byMechanism), {
    "src/preparation/gam/technical/energy/battery-measures-evidence.ts": 84,
    "src/preparation/gam/technical/energy/electric-motor-power-evidence.ts": 60
  });
});

test("fase 12: batería y motores solo acreditan una medida explícita de la unidad y su prueba", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const gam = snapshot.providers.find((provider) => provider.providerId === "gam");
  assert.ok(gam);
  const catalog = await readPortableOriginal(root, "gam");
  for (const { reference, field, value, mechanism } of [
    { reference: "6963", field: "Voltaje batería (V)", value: "24 V",
      mechanism: "src/preparation/gam/technical/energy/battery-measures-evidence.ts" },
    { reference: "2030", field: "Potencia de tracción (kW)", value: "6,5 kW",
      mechanism: "src/preparation/gam/technical/energy/electric-motor-power-evidence.ts" }
  ]) {
    const original = catalog.products.find((record) => record.reference === reference);
    assert.ok(original);
    const publication = {
      title: original.title, shortDescription: original.shortDescription,
      generalDescription: original.longDescription, category: original.categoryName,
      price: original.price, image: original.image, images: original.images ?? [],
      specs: { ...original.specs, [field]: value }
    };
    const change = compareTechnicalFields(original.specs ?? {}, publication.specs)
      .find((entry) => entry.group === "technical" && entry.change === "added" && entry.field === field);
    assert.ok(change);
    const proof: PanelFieldProvenance | undefined = resolvePanelFieldProvenance(original, publication, [change], gam, null,
      original.reference, original.url)[0];
    assert.ok(proof);
    assert.equal(proof.status, "source-compatible");
    assert.equal(proof.mechanism, mechanism);
    const classification = (record: ProductRecord, evidence: readonly PanelFieldProvenance[]): PanelSpecAddition["kind"] | undefined =>
      classifySpecAdditions([change], gam, reference, original.url, null, record, evidence)[0]?.kind;
    assert.equal(classification(original, [proof]), "own");
    assert.equal(classification(original, []), "pending");
    assert.equal(classification(original, [{ ...proof, sourceValue: "otro origen" }]), "pending");
    assert.equal(classification(original, [{ ...proof, mechanism: null }]), "pending");
    assert.equal(classification(original, [{ ...proof, status: "mechanism-compatible" }]), "pending");
    assert.equal(classification(original, [{ ...proof, originalSha256: "b".repeat(64) }]), "pending");
    assert.equal(classification({ ...original, longDescription: "Sin medidas técnicas explícitas" }, [proof]), "pending");
    assert.equal(classification({ ...original, specs: { ...original.specs, [field]: value } }, [proof]), "pending");
    assert.equal(classification({ ...original, url: original.url + "?otra=unidad" }, [proof]), "pending");
    assert.equal(classification({ ...original, url: original.url.replace("online.gamrentals.com", "example.com") }, [proof]), "pending");
    assert.equal(classification({ ...original, providerId: "mercaeleva" }, [proof]), "pending");
    assert.equal(classifySpecAdditions([difference(field, `${value} otro`)], gam, reference, original.url,
      null, original, [proof])[0]?.kind, "pending");
  }
});


test("fase 13: prestaciones, velocidades y depósitos acreditan 166 specs de su ficha sin matriz", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const gam = snapshot.providers.find((provider) => provider.providerId === "gam");
  assert.ok(gam);
  const catalog = await readPortableOriginal(root, "gam");
  const originals = new Map(catalog.products.map((record) => [productIdentity("gam", record.reference, record.url), record]));
  const expected = {
    "src/preparation/gam/technical/measurements/operational-measures-evidence.ts": 53,
    "src/preparation/gam/technical/operations/cleaning-tank-evidence.ts": 48,
    "src/preparation/gam/technical/operations/verified-unit-performance-specs.ts": 65
  };
  const counts = new Map<string, number>();
  for (const product of explorer.products.filter((item) => item.providerId === "gam")) {
    const original = originals.get(product.identity);
    if (!original) continue;
    for (const addition of product.specAdditions) {
      const proof = product.provenance.find((entry) => entry.group === "technical" && entry.field === addition.field);
      if (!proof?.mechanism || !(proof.mechanism in expected)) continue;
      assert.equal(addition.kind, "own");
      assert.equal(proof.status, "source-compatible");
      assert.equal(proof.sourceField, "longDescription");
      assert.equal(proof.sourceValue, original.longDescription);
      assert.equal(proof.historicalApplication, "not-demonstrated");
      assert.equal(classifySpecAdditions([difference(addition.field, addition.value)], gam,
        product.reference, product.sourceUrl, null, original, [proof])[0]?.kind, "own");
      counts.set(proof.mechanism, (counts.get(proof.mechanism) ?? 0) + 1);
    }
  }
  assert.deepEqual(Object.fromEntries(counts), expected);
});

test("fase 13: prestaciones textuales exigen identidad, descripción, valor y evidencia vigente", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const gam = snapshot.providers.find((provider) => provider.providerId === "gam");
  assert.ok(gam);
  const catalog = await readPortableOriginal(root, "gam");
  for (const { reference, field, mechanism } of [
    { reference: "6542", field: "Rotación de plataforma",
      mechanism: "src/preparation/gam/technical/operations/verified-unit-performance-specs.ts" },
    { reference: "6218", field: "Velocidad de desplazamiento (km/h)",
      mechanism: "src/preparation/gam/technical/measurements/operational-measures-evidence.ts" },
    { reference: "4019", field: "Depósito de recuperación",
      mechanism: "src/preparation/gam/technical/operations/cleaning-tank-evidence.ts" }
  ]) {
    const original = catalog.products.find((record) => record.reference === reference);
    const product = explorer.products.find((item) => item.providerId === "gam" && item.reference === reference);
    assert.ok(original);
    assert.ok(product);
    assert.ok(product.published);
    const addition = product.specAdditions.find((item) => item.field === field);
    const change = product.changes.find((item) => item.group === "technical" && item.field === field);
    const proof = product.provenance.find((item) => item.group === "technical" && item.field === field);
    assert.ok(addition);
    assert.ok(change);
    assert.ok(proof);
    assert.equal(proof.status, "source-compatible");
    assert.equal(proof.mechanism, mechanism);
    const classify = (record: ProductRecord = original, evidence: readonly PanelFieldProvenance[] = [proof]): PanelSpecAddition["kind"] | undefined =>
      classifySpecAdditions([change], gam, original.reference, original.url, null, record, evidence)[0]?.kind;
    assert.equal(classify(), "own");
    assert.equal(classify(original, []), "pending");
    assert.equal(classify(original, [{ ...proof, sourceValue: "otro texto" }]), "pending");
    assert.equal(classify(original, [{ ...proof, mechanism: null }]), "pending");
    assert.equal(classify(original, [{ ...proof, status: "mechanism-compatible" }]), "pending");
    assert.equal(classify(original, [{ ...proof, originalSha256: "b".repeat(64) }]), "pending");
    assert.equal(classify({ ...original, longDescription: "Sin evidencia de prestaciones" }), "pending");
    assert.equal(classify({ ...original, specs: { ...original.specs, [field]: addition.value } }), "pending");
    assert.equal(classify({ ...original, reference: `${reference}-otra` }), "pending");
    assert.equal(classify({ ...original, url: `${original.url}?otra=unidad` }), "pending");
    assert.equal(classify({ ...original, providerId: "mercaeleva" }), "pending");
    assert.equal(classifySpecAdditions([difference(field, `${addition.value} distinto`)], gam,
      original.reference, original.url, null, original, [proof])[0]?.kind, "pending");
    const alteredProvenance = resolvePanelFieldProvenance({ ...original, longDescription: "Sin evidencia" },
      product.published, [change], gam, null, original.reference, original.url);
    assert.equal(alteredProvenance[0]?.status, "observed-only");
  }
});


test("fase 14: medidas físicas, despejes, autonomía y elevación acreditan 121 specs propias sin matriz", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const gam = snapshot.providers.find((provider) => provider.providerId === "gam");
  assert.ok(gam);
  const catalog = await readPortableOriginal(root, "gam");
  const originals = new Map(catalog.products.map((record) => [productIdentity("gam", record.reference, record.url), record]));
  const expected = {
    "src/preparation/gam/technical/measurements/physical-measures-evidence.ts": 44,
    "src/preparation/gam/technical/measurements/clearance-platform-evidence.ts": 30,
    "src/preparation/gam/technical/energy/autonomy-evidence.ts": 26,
    "src/preparation/gam/technical/measurements/lift-height-evidence.ts": 21
  };
  const counts = new Map<string, number>();
  for (const product of explorer.products.filter((item) => item.providerId === "gam")) {
    const original = originals.get(product.identity);
    if (!original) continue;
    for (const addition of product.specAdditions) {
      const proof = product.provenance.find((item) => item.group === "technical" && item.field === addition.field);
      if (!proof?.mechanism || !(proof.mechanism in expected)) continue;
      assert.equal(addition.kind, "own");
      assert.equal(proof.status, "source-compatible");
      assert.equal(proof.sourceField, "longDescription");
      assert.equal(proof.sourceValue, original.longDescription);
      assert.equal(proof.historicalApplication, "not-demonstrated");
      assert.equal(classifySpecAdditions([difference(addition.field, addition.value)], gam,
        product.reference, product.sourceUrl, null, original, [proof])[0]?.kind, "own");
      counts.set(proof.mechanism, (counts.get(proof.mechanism) ?? 0) + 1);
    }
  }
  assert.deepEqual(Object.fromEntries(counts), expected);
});

test("fase 14: dimensiones y autonomía requieren identidad, medida explícita y prueba vigente", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const gam = snapshot.providers.find((provider) => provider.providerId === "gam");
  assert.ok(gam);
  const catalog = await readPortableOriginal(root, "gam");
  for (const { reference, field, mechanism } of [
    { reference: "6802", field: "Peso (kg)",
      mechanism: "src/preparation/gam/technical/measurements/physical-measures-evidence.ts" },
    { reference: "6669", field: "Altura plataforma (m)",
      mechanism: "src/preparation/gam/technical/measurements/clearance-platform-evidence.ts" },
    { reference: "6950", field: "Autonomía máxima (h)",
      mechanism: "src/preparation/gam/technical/energy/autonomy-evidence.ts" },
    { reference: "6980", field: "Altura de elevación (mm)",
      mechanism: "src/preparation/gam/technical/measurements/lift-height-evidence.ts" }
  ]) {
    const original = catalog.products.find((record) => record.reference === reference);
    const product = explorer.products.find((item) => item.providerId === "gam" && item.reference === reference);
    assert.ok(original);
    assert.ok(product);
    assert.ok(product.published);
    const addition = product.specAdditions.find((item) => item.field === field);
    const change = product.changes.find((item) => item.group === "technical" && item.field === field);
    const proof = product.provenance.find((item) => item.group === "technical" && item.field === field);
    assert.ok(addition);
    assert.ok(change);
    assert.ok(proof);
    assert.equal(proof.status, "source-compatible");
    assert.equal(proof.mechanism, mechanism);
    const classify = (record: ProductRecord = original, evidence: readonly PanelFieldProvenance[] = [proof]): PanelSpecAddition["kind"] | undefined =>
      classifySpecAdditions([change], gam, original.reference, original.url, null, record, evidence)[0]?.kind;
    assert.equal(classify(), "own");
    assert.equal(classify(original, []), "pending");
    assert.equal(classify(original, [{ ...proof, sourceValue: "otra descripción" }]), "pending");
    assert.equal(classify(original, [{ ...proof, mechanism: null }]), "pending");
    assert.equal(classify(original, [{ ...proof, status: "mechanism-compatible" }]), "pending");
    assert.equal(classify(original, [{ ...proof, publicationSha256: "a".repeat(64) }]), "pending");
    assert.equal(classify({ ...original, longDescription: "Sin medidas expresas" }), "pending");
    assert.equal(classify({ ...original, specs: { ...original.specs, [field]: addition.value } }), "pending");
    assert.equal(classify({ ...original, reference: `${reference}-otra` }), "pending");
    assert.equal(classify({ ...original, url: `${original.url}?otra=unidad` }), "pending");
    assert.equal(classify({ ...original, providerId: "mercaeleva" }), "pending");
    assert.equal(classifySpecAdditions([difference(field, `${addition.value} diferente`)], gam,
      original.reference, original.url, null, original, [proof])[0]?.kind, "pending");
    assert.equal(resolvePanelFieldProvenance({ ...original, longDescription: "Sin medidas expresas" },
      product.published, [change], gam, null, original.reference, original.url)[0]?.status, "observed-only");
  }
});


test("fase 14: un recuperador dimensional nuevo no sustituye una fuente anterior acreditada", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const gam = snapshot.providers.find((provider) => provider.providerId === "gam");
  assert.ok(gam);
  const catalog = await readPortableOriginal(root, "gam");
  const original = catalog.products.find((item) => item.reference === "6963");
  const product = explorer.products.find((item) => item.providerId === "gam" && item.reference === "6963");
  assert.ok(original);
  assert.ok(product);
  const field = "Anchura (mm)";
  const addition = product.specAdditions.find((item) => item.field === field);
  const proof = product.provenance.find((item) => item.group === "technical" && item.field === field);
  const change = product.changes.find((item) => item.group === "technical" && item.field === field);
  assert.ok(addition);
  assert.ok(proof);
  assert.ok(change);
  assert.equal(proof.status, "source-compatible");
  assert.equal(proof.mechanism, "src/preparation/gam/technical/measurements/verified-technical-measures.ts");
  const recovered = compareTechnicalFields(original.specs ?? {}, recoverGamPhysicalMeasures(original));
  assert.ok(recovered.some((item) => item.group === "technical" && item.change === "added" &&
    item.field === field && item.after === addition.value));
  assert.equal(classifySpecAdditions([change], gam, original.reference, original.url,
    null, original, [proof])[0]?.kind, "own");
});


test("fase 15: transmisión, dirección, geometría y operaciones acreditan 143 specs propias sin matriz", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const gam = snapshot.providers.find((provider) => provider.providerId === "gam");
  assert.ok(gam);
  const catalog = await readPortableOriginal(root, "gam");
  const originals = new Map(catalog.products.map((record) => [productIdentity("gam", record.reference, record.url), record]));
  const expected = {
    "src/preparation/gam/technical/mobility/verified-drivetrain-brakes-evidence.ts": 41,
    "src/preparation/gam/technical/mobility/verified-steering-braking-evidence.ts": 40,
    "src/preparation/gam/technical/measurements/verified-unit-geometry-specs.ts": 26,
    "src/preparation/gam/technical/operations/verified-unit-operation-specs.ts": 36
  };
  const counts = new Map<string, number>();
  for (const product of explorer.products.filter((item) => item.providerId === "gam")) {
    const original = originals.get(product.identity);
    if (!original) continue;
    for (const addition of product.specAdditions) {
      const proof = product.provenance.find((item) => item.group === "technical" && item.field === addition.field);
      if (!proof?.mechanism || !(proof.mechanism in expected)) continue;
      assert.equal(addition.kind, "own");
      assert.equal(proof.status, "source-compatible");
      assert.equal(proof.sourceField, "longDescription");
      assert.equal(proof.sourceValue, original.longDescription);
      assert.equal(proof.historicalApplication, "not-demonstrated");
      assert.equal(classifySpecAdditions([difference(addition.field, addition.value)], gam,
        product.reference, product.sourceUrl, null, original, [proof])[0]?.kind, "own");
      counts.set(proof.mechanism, (counts.get(proof.mechanism) ?? 0) + 1);
    }
  }
  assert.deepEqual(Object.fromEntries(counts), expected);
});

test("fase 15: las nuevas evidencias requieren ficha, valor, descripción y prueba originales", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const gam = snapshot.providers.find((provider) => provider.providerId === "gam");
  assert.ok(gam);
  const catalog = await readPortableOriginal(root, "gam");
  for (const { reference, field, mechanism } of [
    { reference: "4748", field: "Neumáticos",
      mechanism: "src/preparation/gam/technical/mobility/verified-drivetrain-brakes-evidence.ts" },
    { reference: "2018", field: "Frenado regenerativo",
      mechanism: "src/preparation/gam/technical/mobility/verified-steering-braking-evidence.ts" },
    { reference: "4798", field: "Rotación de torreta",
      mechanism: "src/preparation/gam/technical/measurements/verified-unit-geometry-specs.ts" },
    { reference: "5900", field: "Radio de giro (mm)",
      mechanism: "src/preparation/gam/technical/operations/verified-unit-operation-specs.ts" }
  ]) {
    const original = catalog.products.find((record) => record.reference === reference);
    const product = explorer.products.find((item) => item.providerId === "gam" && item.reference === reference);
    assert.ok(original);
    assert.ok(product);
    assert.ok(product.published);
    const addition = product.specAdditions.find((item) => item.field === field);
    const change = product.changes.find((item) => item.group === "technical" && item.field === field);
    const proof = product.provenance.find((item) => item.group === "technical" && item.field === field);
    assert.ok(addition);
    assert.ok(change);
    assert.ok(proof);
    assert.equal(proof.status, "source-compatible");
    assert.equal(proof.mechanism, mechanism);
    const classify = (record: ProductRecord = original, evidence: readonly PanelFieldProvenance[] = [proof]): PanelSpecAddition["kind"] | undefined =>
      classifySpecAdditions([change], gam, original.reference, original.url, null, record, evidence)[0]?.kind;
    assert.equal(classify(), "own");
    assert.equal(classify(original, []), "pending");
    assert.equal(classify(original, [{ ...proof, sourceValue: "otra descripción" }]), "pending");
    assert.equal(classify(original, [{ ...proof, mechanism: null }]), "pending");
    assert.equal(classify(original, [{ ...proof, status: "mechanism-compatible" }]), "pending");
    assert.equal(classify(original, [{ ...proof, originalSha256: "a".repeat(64) }]), "pending");
    assert.equal(classify({ ...original, longDescription: "Descripción sin los datos acreditados" }), "pending");
    assert.equal(classify({ ...original, specs: { ...original.specs, [field]: addition.value } }), "pending");
    assert.equal(classify({ ...original, reference: `${reference}-otra` }), "pending");
    assert.equal(classify({ ...original, url: `${original.url}?otra=unidad` }), "pending");
    assert.equal(classify({ ...original, providerId: "mercaeleva" }), "pending");
    assert.equal(classifySpecAdditions([difference(field, `${addition.value} diferente`)], gam,
      original.reference, original.url, null, original, [proof])[0]?.kind, "pending");
    assert.equal(resolvePanelFieldProvenance({ ...original, longDescription: "Descripción sin los datos acreditados" },
      product.published, [change], gam, null, original.reference, original.url)[0]?.status, "observed-only");
  }
});


test("fase 16: seis recuperadores acreditan 106 specs originales sin matriz", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const provider = snapshot.providers.find((item) => item.providerId === "gam");
  assert.ok(provider);
  const catalog = await readPortableOriginal(root, "gam");
  const originals = new Map(catalog.products.map((record) => [productIdentity("gam", record.reference, record.url), record]));
  const expected: Readonly<Record<string, number>> = {
    "src/preparation/gam/technical/energy/battery-chemistry-evidence.ts": 28,
    "src/preparation/gam/technical/measurements/reach-evidence.ts": 28,
    "src/preparation/gam/technical/mobility/wheelbase-evidence.ts": 15,
    "src/preparation/gam/technical/mobility/verified-tyre-dimensions-evidence.ts": 13,
    "src/preparation/gam/technical/operations/scrubbing-pressure-evidence.ts": 18,
    "src/preparation/gam/technical/operations/cleaning-productivity-evidence.ts": 4
  };
  const counts = new Map<string, number>();
  for (const product of explorer.products.filter((item) => item.providerId === "gam")) {
    const original = originals.get(product.identity);
    if (!original) continue;
    for (const addition of product.specAdditions) {
      const proof = product.provenance.find((item) => item.group === "technical" && item.field === addition.field);
      if (!proof?.mechanism || !(proof.mechanism in expected)) continue;
      assert.equal(addition.kind, "own");
      assert.equal(proof.status, "source-compatible");
      assert.equal(proof.scope, "unit");
      assert.equal(proof.sourceField, "longDescription");
      assert.equal(proof.sourceValue, original.longDescription);
      assert.equal(proof.historicalApplication, "not-demonstrated");
      assert.equal(classifySpecAdditions([difference(addition.field, addition.value)], provider,
        original.reference, original.url, null, original, [proof])[0]?.kind, "own");
      counts.set(proof.mechanism, (counts.get(proof.mechanism) ?? 0) + 1);
    }
  }
  assert.deepEqual(Object.fromEntries(counts), expected);
});

test("fase 16: las medidas textuales se invalidan si cambia su identidad, valor u origen", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const provider = snapshot.providers.find((item) => item.providerId === "gam");
  assert.ok(provider);
  const catalog = await readPortableOriginal(root, "gam");
  for (const { reference, field, mechanism } of [
    { reference: "6218", field: "Tipo de batería", mechanism: "src/preparation/gam/technical/energy/battery-chemistry-evidence.ts" },
    { reference: "4766", field: "Alcance horizontal (m)", mechanism: "src/preparation/gam/technical/measurements/reach-evidence.ts" },
    { reference: "6767", field: "Distancia entre ejes (mm)", mechanism: "src/preparation/gam/technical/mobility/wheelbase-evidence.ts" },
    { reference: "2093", field: "Neumáticos", mechanism: "src/preparation/gam/technical/mobility/verified-tyre-dimensions-evidence.ts" },
    { reference: "3996", field: "Presión máxima de fregado (kg)", mechanism: "src/preparation/gam/technical/operations/scrubbing-pressure-evidence.ts" },
    { reference: "6150", field: "Anchura trabajo (mm)", mechanism: "src/preparation/gam/technical/operations/cleaning-productivity-evidence.ts" }
  ]) {
    const original = catalog.products.find((record) => record.reference === reference);
    const product = explorer.products.find((item) => item.providerId === "gam" && item.reference === reference);
    assert.ok(original);
    assert.ok(product);
    assert.ok(product.published);
    const addition = product.specAdditions.find((item) => item.field === field);
    const change = product.changes.find((item) => item.group === "technical" && item.field === field);
    const proof = product.provenance.find((item) => item.group === "technical" && item.field === field);
    assert.ok(addition);
    assert.ok(change);
    assert.ok(proof);
    assert.equal(proof.mechanism, mechanism);
    assert.equal(proof.status, "source-compatible");
    const classify = (record: ProductRecord = original, evidence: readonly PanelFieldProvenance[] = [proof]): PanelSpecAddition["kind"] | undefined =>
      classifySpecAdditions([change], provider, original.reference, original.url, null, record, evidence)[0]?.kind;
    assert.equal(classify(), "own");
    assert.equal(classify(original, []), "pending");
    assert.equal(classify(original, [{ ...proof, status: "observed-only" }]), "pending");
    assert.equal(classify(original, [{ ...proof, sourceValue: "otra descripción" }]), "pending");
    assert.equal(classify(original, [{ ...proof, originalSha256: "e".repeat(64) }]), "pending");
    assert.equal(classify({ ...original, longDescription: "Sin medida técnica de esta unidad" }), "pending");
    assert.equal(classify({ ...original, specs: { ...original.specs, [field]: addition.value } }), "pending");
    assert.equal(classify({ ...original, url: `${original.url}?otra=unidad` }), "pending");
    assert.equal(classify({ ...original, reference: `${reference}-otra` }), "pending");
    assert.equal(classifySpecAdditions([difference(field, `${addition.value} diferente`)], provider,
      original.reference, original.url, null, original, [proof])[0]?.kind, "pending");
    assert.equal(resolvePanelFieldProvenance({ ...original, longDescription: "Sin medida técnica de esta unidad" },
      product.published, [change], provider, null, original.reference, original.url)[0]?.status, "observed-only");
  }
});
