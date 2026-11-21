import assert from "node:assert/strict";
import { test } from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { loadSpecAdditionAudit } from "../spec-addition-classification.js";
import { classifySpecAdditions } from "../spec-addition-classification.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import type { PanelFieldDifference } from "../types.js";
import type { AuditEntry, FingerprintedAuditEntry, SpecAdditionAudit } from "../../evidence/spec-addition-audit.js";

test("fase 33: una traza emitida se clasifica por el motor sin sobrescritura de la matriz histórica", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const provider = snapshot.providers.find((entry) => entry.providerId === "gam");
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(provider);
  assert.ok(audit);
  const catalog = await readPortableOriginal(root, "gam");
  for (const reference of ["231", "232", "239", "240", "234"]) {
    const original = catalog.products.find((entry) => entry.reference === reference);
    assert.ok(original);
    const emitted = prepareSourceProduct(original).technicalProvenance;
    assert.ok(emitted);
    const changes: readonly PanelFieldDifference[] = emitted.entries.filter((entry) => entry.scope === "model-document" && entry.verification !== undefined &&
      (reference === "239" ? ["Longitud de horquillas", "Altura mínima de horquillas"].includes(entry.field) : true)).map((entry) => ({
      field: entry.field, group: "technical", change: "added", before: null, after: entry.value
    }));
    assert.equal(changes.length, 2);
    const classify = (record = original, source = emitted, requested = reference) =>
      classifySpecAdditions(changes, provider, requested, original.url, audit, record, [], source);
    assert.ok(classify().every((entry) => entry.kind === "reused"));
    const newEntries: readonly AuditEntry[] = changes.map((change): AuditEntry => ({
      providerId: provider.providerId, reference, sourceUrl: original.url,
      field: change.field, value: change.after ?? "", kind: "own"
    }));
    const contradictory: SpecAdditionAudit = audit.version === 2
      ? { ...audit, entries: [...audit.entries,
        ...newEntries.map((entry): FingerprintedAuditEntry => ({
          ...entry, originalRecordSha256: emitted.originalRecordSha256 }))] }
      : { ...audit, entries: [...audit.entries, ...newEntries] };
    assert.ok(classifySpecAdditions(changes, provider, reference, original.url, contradictory, original, [], emitted)
      .every((entry) => entry.kind === "reused"));
    assert.ok(classify({ ...original, title: `${original.title} alterado` }).every((entry) => entry.kind === "pending"));
    assert.ok(classify(original, { ...emitted, originalRecordSha256: "e".repeat(64) })
      .every((entry) => entry.kind === "pending"));
    assert.ok(classify(original, emitted, "otra-referencia").every((entry) => entry.kind === "pending"));
    const missing = changes.map((change) => ({ ...change, after: `${change.after} alterado` }));
    assert.ok(classifySpecAdditions(missing, provider, reference, original.url, audit, original, [], emitted)
      .every((entry) => entry.kind === "pending"));
  }
});

test("fase 34: las ocho acreditaciones nuevas prevalecen en el panel sobre el legado", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  const references = [
    { providerId: "gam", reference: "222", fields: ["Conducción con timón vertical"] },
    { providerId: "gam", reference: "223", fields: ["Conducción con timón vertical"] },
    { providerId: "gam", reference: "216", fields: ["Recorrido de elevación"] },
    { providerId: "gam", reference: "236", fields: ["Sistema de elevación"] },
    { providerId: "gam", reference: "242", fields: ["Timón y componentes de elevación"] },
    { providerId: "gam", reference: "4819", fields: ["Tracción"] },
    { providerId: "mercaeleva", reference: "M879-4639", fields: ["Capacidad nominal de carga", "Tensión del sistema de batería"] }
  ] as const;
  let classified = 0;
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const catalog = await readPortableOriginal(root, providerId);
    const provider = snapshot.providers.find((candidate) => candidate.providerId === providerId);
    assert.ok(provider);
    for (const item of references.filter((candidate) => candidate.providerId === providerId)) {
      const original = catalog.products.find((candidate) => candidate.reference === item.reference);
      assert.ok(original);
      const emitted = prepareSourceProduct(original).technicalProvenance;
      assert.ok(emitted);
      const changes: readonly PanelFieldDifference[] = emitted.entries.filter((entry) =>
        entry.scope === "model-document" && entry.verification !== undefined &&
        item.fields.some((field) => field === entry.field)).map((entry) => ({
        field: entry.field, group: "technical", change: "added", before: null, after: entry.value
      }));
      assert.equal(changes.length, item.fields.length);
      const classify = (source = emitted, matrix = audit) =>
        classifySpecAdditions(changes, provider, original.reference, original.url, matrix, original, [], source);
      assert.ok(classify().every((entry) => entry.kind === "reused"));
      assert.ok(classifySpecAdditions(changes, provider, original.reference, original.url,
        audit, original).every((entry) => entry.kind === "pending"));
      const historical: readonly AuditEntry[] = changes.map((change) => ({
        providerId, reference: original.reference, sourceUrl: original.url,
        field: change.field, value: change.after ?? "", kind: "own"
      }));
      const contradictory: SpecAdditionAudit = audit.version === 2
        ? { ...audit, entries: [...audit.entries, ...historical.map((entry): FingerprintedAuditEntry => ({
          ...entry, originalRecordSha256: emitted.originalRecordSha256
        }))] }
        : { ...audit, entries: [...audit.entries, ...historical] };
      assert.ok(classify(emitted, contradictory).every((entry) => entry.kind === "reused"));
      assert.ok(classify({ ...emitted, originalRecordSha256: "e".repeat(64) })
        .every((entry) => entry.kind === "pending"));
      classified += changes.length;
    }
  }
  assert.equal(classified, 8);
});

test("fase 35: referencias documentales verificadas se clasifican por el motor y no por el legado", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const provider = snapshot.providers.find((entry) => entry.providerId === "gam");
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(provider);
  assert.ok(audit);
  const originals = await readPortableOriginal(root, "gam");
  const references = [
    { reference: "171", fields: ["Anchura de la boquilla de aspiración", "Depósito de agua limpia estándar", "Depósito de recuperación"] },
    { reference: "2737", fields: ["Cargador a bordo del modelo", "Frenado en posición neutra del modelo", "Reducción de transmisión del modelo", "Velocidad de avance y retroceso del modelo"] },
    { reference: "6689", fields: ["Cilindrada del motor", "Par motor máximo", "Potencia máxima del motor", "Tipo de tracción"] }
  ] as const;
  let count = 0;
  for (const item of references) {
    const original = originals.products.find((entry) => entry.reference === item.reference);
    assert.ok(original);
    const emitted = prepareSourceProduct(original).technicalProvenance;
    assert.ok(emitted);
    const changes: readonly PanelFieldDifference[] = emitted.entries.filter((entry) =>
      entry.scope === "document-reference" && entry.verification !== undefined &&
      item.fields.some((field) => field === entry.field)).map((entry) => ({
      field: entry.field, group: "technical", change: "added", before: null, after: entry.value
    }));
    assert.equal(changes.length, item.fields.length);
    const classify = (source = emitted, matrix = audit) =>
      classifySpecAdditions(changes, provider, original.reference, original.url, matrix, original, [], source);
    assert.ok(classify().every((entry) => entry.kind === "reused"));
    const contradictory: readonly AuditEntry[] = changes.map((change) => ({
      providerId: "gam", reference: original.reference, sourceUrl: original.url,
      field: change.field, value: change.after ?? "", kind: "own"
    }));
    const matrix: SpecAdditionAudit = audit.version === 2
      ? { ...audit, entries: [...audit.entries, ...contradictory.map((entry): FingerprintedAuditEntry => ({
        ...entry, originalRecordSha256: emitted.originalRecordSha256
      }))] }
      : { ...audit, entries: [...audit.entries, ...contradictory] };
    assert.ok(classify(emitted, matrix).every((entry) => entry.kind === "reused"));
    assert.ok(classify({ ...emitted, originalRecordSha256: "0".repeat(64) }).every((entry) => entry.kind === "pending"));
    assert.ok(classifySpecAdditions(changes, provider, "otra-referencia", original.url,
      audit, original, [], emitted).every((entry) => entry.kind === "pending"));
    count += changes.length;
  }
  assert.equal(count, 11);
});

test("fase 36: nuevas afirmaciones del motor prevalecen sobre la matriz y rechazan trazas inválidas", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  const references = [
    { providerId: "gam", reference: "6690", fields: [
      "Caja de cambios", "Cilindrada del motor", "Potencia máxima DIN", "Tipo de tracción"
    ] },
    { providerId: "mercaeleva", reference: "M329-6156", fields: ["Anchura de plataforma", "Longitud de plataforma"] },
    { providerId: "mercaeleva", reference: "M061-0041", fields: ["Altura de plataforma"] },
    { providerId: "mercaeleva", reference: "M091-1956", fields: ["Anchura (mm)", "Capacidad máxima de plataforma"] },
    { providerId: "mercaeleva", reference: "M622-7084", fields: ["Anchura (mm)"] }
  ] as const;
  let classified = 0;
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const catalog = await readPortableOriginal(root, providerId);
    const provider = snapshot.providers.find((candidate) => candidate.providerId === providerId);
    assert.ok(provider);
    for (const item of references.filter((candidate) => candidate.providerId === providerId)) {
      const original = catalog.products.find((candidate) => candidate.reference === item.reference);
      assert.ok(original);
      const emitted = prepareSourceProduct(original).technicalProvenance;
      assert.ok(emitted);
      const changes: readonly PanelFieldDifference[] = emitted.entries.filter((entry) =>
        (entry.scope === "model-document" || entry.scope === "document-reference") &&
        entry.verification !== undefined && item.fields.some((field) => field === entry.field)).map((entry) => ({
        field: entry.field, group: "technical", change: "added", before: null, after: entry.value
      }));
      assert.equal(changes.length, item.fields.length);
      const classify = (source = emitted, matrix = audit) =>
        classifySpecAdditions(changes, provider, original.reference, original.url, matrix, original, [], source);
      assert.ok(classify().every((entry) => entry.kind === "reused"));
      assert.ok(classifySpecAdditions(changes, provider, original.reference, original.url,
        audit, original).every((entry) => entry.kind === "pending"));
      const historical: readonly AuditEntry[] = changes.map((change) => ({
        providerId, reference: original.reference, sourceUrl: original.url,
        field: change.field, value: change.after ?? "", kind: "own"
      }));
      const contradictory: SpecAdditionAudit = audit.version === 2
        ? { ...audit, entries: [...audit.entries, ...historical.map((entry): FingerprintedAuditEntry => ({
          ...entry, originalRecordSha256: emitted.originalRecordSha256
        }))] }
        : { ...audit, entries: [...audit.entries, ...historical] };
      assert.ok(classify(emitted, contradictory).every((entry) => entry.kind === "reused"));
      assert.ok(classify({ ...emitted, originalRecordSha256: "e".repeat(64) })
        .every((entry) => entry.kind === "pending"));
      assert.ok(classifySpecAdditions(changes, provider, "referencia-manipulada", original.url,
        audit, original, [], emitted).every((entry) => entry.kind === "pending"));
      classified += changes.length;
    }
  }
  assert.equal(classified, 10);
});

test("fase 37: el motor distingue procedencia original y documental aunque contradiga la matriz", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit);
  const references = [
    { providerId: "gam", reference: "243", fields: ["Ruedas de carga", "Timón y bomba de pistones"], kind: "own" },
    { providerId: "gam", reference: "244", fields: ["Timón y bomba de pistones", "Restantes componentes exteriores"], kind: "own" },
    { providerId: "gam", reference: "6806", fields: ["Batería anunciada"], kind: "own" },
    { providerId: "mercaeleva", reference: "M044-4093", fields: ["Altura de plataforma", "Alcance horizontal (m)"], kind: "reused" },
    { providerId: "mercaeleva", reference: "M570-8735", fields: ["Centro de carga (mm)"], kind: "reused" },
    { providerId: "mercaeleva", reference: "M484-4055", fields: ["Altura de plataforma", "Capacidad máxima de plataforma"], kind: "reused" }
  ] as const;
  let count = 0;
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const originals = await readPortableOriginal(root, providerId);
    const provider = snapshot.providers.find((item) => item.providerId === providerId);
    assert.ok(provider);
    for (const item of references.filter((candidate) => candidate.providerId === providerId)) {
      const original = originals.products.find((candidate) => candidate.reference === item.reference);
      assert.ok(original);
      const emitted = prepareSourceProduct(original).technicalProvenance;
      assert.ok(emitted);
      const changes: readonly PanelFieldDifference[] = emitted.entries.filter((entry) =>
        item.fields.some((field) => field === entry.field)).map((entry) => ({
        field: entry.field, group: "technical", change: "added", before: null, after: entry.value
      }));
      assert.equal(changes.length, item.fields.length);
      const classify = (source = emitted, matrix = audit) => classifySpecAdditions(changes,
        provider, original.reference, original.url, matrix, original, [], source);
      assert.ok(classify().every((entry) => entry.kind === item.kind));
      const contradictory: readonly AuditEntry[] = changes.map((change) => ({
        providerId, reference: original.reference, sourceUrl: original.url,
        field: change.field, value: change.after ?? "", kind: item.kind === "own" ? "reused" : "own"
      }));
      const matrix: SpecAdditionAudit = audit.version === 2
        ? { ...audit, entries: [...audit.entries, ...contradictory.map((entry): FingerprintedAuditEntry => ({
          ...entry, originalRecordSha256: emitted.originalRecordSha256
        }))] }
        : { ...audit, entries: [...audit.entries, ...contradictory] };
      assert.ok(classify(emitted, matrix).every((entry) => entry.kind === item.kind));
      assert.ok(classify({ ...emitted, originalRecordSha256: "0".repeat(64) })
        .every((entry) => entry.kind === "pending"));
      assert.ok(classifySpecAdditions(changes, provider, "referencia-falsa", original.url,
        audit, original, [], emitted).every((entry) => entry.kind === "pending"));
      count += changes.length;
    }
  }
  assert.equal(count, 10);
});
