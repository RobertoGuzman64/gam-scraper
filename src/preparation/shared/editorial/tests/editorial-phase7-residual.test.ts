import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../testing/domain-cases/accredited-source-samples.js";
import { resolveSourceEditorialClaims } from "../domain/editorial-source-claims.js";
import { compressVerifiedSourceShort } from "../domain/editorial-source-brief.js";

const original = (provider: string, reference: string): ProductRecord => {
  if (provider === "gam") return accreditedSourceRecord("gam-original", reference);
  if (provider === "gomariz") return accreditedSourceRecord("gomariz-original", reference);
  if (provider === "mercaeleva") return accreditedSourceRecord("mercaeleva-original", reference);
  throw new Error(`Proveedor desconocido: ${provider}`);
};

test("la tensión afirmada de batería se reutiliza por fuente, no por proveedor ni referencia", () => {
  const examples = [original("gam", "6901"), original("mercaeleva", "M288-9739")];
  for (const record of examples) {
    const source: ProductRecord = {
      ...record,
      longDescription: "La batería incorporada funciona con una tensión de 24 V.",
      specs: { ...record.specs, "Voltaje de la batería": "24 V" }
    };
    const general = "La ficha de esta máquina describe sus características técnicas.";
    assert.match(resolveSourceEditorialClaims(source, source, general) ?? "", /tensión de batería de 24 V/u);
    const optional = { ...source, longDescription: "La batería de 24 V es opcional según la versión." };
    assert.equal(resolveSourceEditorialClaims(optional, optional, general), general);
    const mixed = { ...source, longDescription: "La batería incorporada funciona a 24 V. Otra batería funciona a 48 V." };
    assert.equal(resolveSourceEditorialClaims(mixed, mixed, general), general);
    assert.equal(resolveSourceEditorialClaims(source, source, `${general} Voltaje general de 48 V.`), `${general} Voltaje general de 48 V.`);
    const incompatible = { ...source, specs: { ...source.specs, "Voltaje de la batería": "48 V" } };
    assert.equal(resolveSourceEditorialClaims(source, incompatible, general), general);
    const falsified = { ...source, url: "https://example.invalid/otra-maquina" };
    assert.equal(resolveSourceEditorialClaims(falsified, falsified, general), general);
    assert.equal(resolveSourceEditorialClaims(source, source, `${general} Batería de 24 V.`), `${general} Batería de 24 V.`);
  }
});

test("la compresión compartida conserva los hechos omitidos en la general y rechaza pérdidas", () => {
  const record = original("gam", "6218");
  const first = "La LVNENG LX05 es un ciclomotor eléctrico compacto y eficiente para uso urbano, con un diseño práctico para circular en ciudad.";
  const repeated = "Su diseño compacto facilita los desplazamientos cotidianos, y su propulsión eléctrica favorece una circulación silenciosa en zonas urbanas. ";
  const source = { ...record, shortDescription: `${first} ${repeated.repeat(3).trim()}` };
  const general = "La LVNENG LX05 es un ciclomotor eléctrico de diseño compacto para circulación urbana, con propulsión eléctrica silenciosa y mantenimiento práctico.";
  assert.ok((source.shortDescription ?? "").split(/\s+/u).length > 45);
  assert.equal(compressVerifiedSourceShort(source, source.shortDescription, general), first);
  const lost = { ...source, shortDescription: `${source.shortDescription} También incorpora 9999 unidades adicionales.` };
  assert.equal(compressVerifiedSourceShort(lost, lost.shortDescription, general), null);
  assert.equal(compressVerifiedSourceShort(source, "Resumen independiente del anuncio.", general), null);
  assert.equal(compressVerifiedSourceShort({ ...source, model: "OTRO" }, source.shortDescription, general), null);
  assert.equal(compressVerifiedSourceShort({ ...source, url: "https://example.invalid/6218" }, source.shortDescription, general), null);
});
