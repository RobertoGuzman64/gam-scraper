import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fingerprintAuditedFinding } from "../../../../catalog/diagnostics/finding-recognitions.js";
import { loadFindingRecognitionRegistry, parseFindingRecognitionRegistry } from "../finding-recognition-store.js";

const empty = { version: 1, recognitions: [] };

test("acepta el registro vacío y no inventa reconocimientos", () => {
  assert.deepEqual(parseFindingRecognitionRegistry(empty), empty);
});

test("rechaza registros malformados, versiones desconocidas y propiedades inesperadas", () => {
  for (const value of [null, [], {}, { version: 2, recognitions: [] },
    { version: 1, recognitions: [{}] }, { version: 1, recognitions: [], ignored: true },
    { version: 1, recognitions: [{ fingerprint: "x", decision: {} }] }]) {
    assert.throws(() => parseFindingRecognitionRegistry(value), /Registro de reconocimientos/);
  }
});

test("carga registros persistentes desde data sin crear ni modificar archivos", async () => {
  const root = await mkdtemp(join(tmpdir(), "finding-recognitions-"));
  try {
    const folder = join(root, "data");
    await mkdir(folder);
    await writeFile(join(folder, "audit-finding-recognitions.json"), JSON.stringify(empty));
    assert.deepEqual(await loadFindingRecognitionRegistry(root), empty);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("no permite tratar un registro ausente como autorización vacía implícita", async () => {
  const root = await mkdtemp(join(tmpdir(), "finding-recognitions-missing-"));
  try {
    await assert.rejects(loadFindingRecognitionRegistry(root), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("una decisión documentada puede persistir sin promover un estado bloqueante", () => {
  const finding = {
    providerId: "gam", reference: "5961", sourceUrl: "https://supplier.test/5961",
    audit: "acreditacion_comercial" as const, severity: "warn" as const,
    field: "year", code: "ano-url-atributo-discordante",
    evidenceSha256: "b".repeat(64),
    facts: [{ name: "url", value: "2018" }, { name: "attribute", value: "2015" }]
  };
  const fingerprint = fingerprintAuditedFinding(finding);
  const accepted = { version: 1, recognitions: [{ finding, fingerprint, decision: {
    reviewedBy: "responsable", reviewedAt: "2026-11-10T11:00:00Z", rationale: "Unidad investigada",
    evidence: [{ origin: "https://supplier.test/5961", content: "Años discordantes en el anuncio" }]
  } }] };
  assert.deepEqual(parseFindingRecognitionRegistry(JSON.parse(JSON.stringify(accepted))), accepted);
  const blocking = { ...finding, severity: "blocking" };
  assert.throws(() => parseFindingRecognitionRegistry({ version: 1, recognitions: [{
    ...accepted.recognitions[0], finding: blocking
  }] }), /Registro de reconocimientos/);
});
