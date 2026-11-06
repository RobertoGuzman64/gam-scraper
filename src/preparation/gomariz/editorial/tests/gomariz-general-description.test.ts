import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGomarizCriticalBriefGeneral } from "../mapping/critical-brief-general.js";
import { resolveGomarizGeneralDescription } from "../mapping/general-description.js";
import { resolveGomarizVerifiedModelGeneral } from "../mapping/verified-model-general.js";
import { verifiedGomarizPriorityGeneral } from "../evidence/verified-priority-general.js";
import { verifiedCanonicalBriefEditorial } from "../../../shared/editorial/evidence/verified-canonical-brief-editorial.js";
import { resolveGomarizIndividualizedGeneral } from "../mapping/individualized-general.js";
import { removeGomarizConversationalLead, resolveGomarizUnitSpecificGeneral } from "../mapping/unit-specific-general.js";
import { recoverGomarizDocumentedRenaultPremiumSpecs } from "../../technical/evidence/documented-renault-premium-specs.js";
import { reconcileGomarizVerifiedPlatformHeight } from "../../technical/reconciliation/gomariz.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { recoverGomarizDocumentedScaniaP220Specs } from "../../technical/evidence/documented-scania-p220-specs.js";

const signedGenerals: Readonly<Record<string, { readonly general: string }>> = verifiedCanonicalBriefEditorial;

const source = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = source.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Gomariz: las generales sustituyen texto de familia por datos específicos respaldados", () => {
  const cases = [
    ["TE1620", "La plataforma de tijera LGMG S1413EII", "15,8 m", "320 kg", "13,8 m"],
    ["TD1511", "La plataforma de tijera GENIE GS4390RT", "14,75 m", "680 kg", "12,75 m"],
    ["BA1335", "La plataforma articulada SKYJACK SJ85AJ", "27,74 m", "227 kg", "25,91 m"],
    ["BA1344", "La plataforma articulada Manitou 120 AETJC", "12 m", "200 kg", "10 m"],
    ["MT1661", "El manipulador telescópico JCB 540-140", "13,8 m", "4000 kg", "6,25 m"],
    ["CAE1207", "La carretilla industrial Nissan Q02L25CU", "2500 kg", "2,37 m", "1,18 m"]
  ] as const;
  for (const [reference, identity, first, second, third] of cases) {
    const record = find(reference);
    const original = JSON.stringify(record);
    const general = resolveGomarizGeneralDescription(record);
    assert.ok(general, reference);
    for (const fragment of [identity, first, second, third]) assert.ok(general.includes(fragment), `${reference}: ${fragment}`);
    assert.equal(general.includes(record.longDescription ?? ""), false, reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.description_general, verifiedGomarizPriorityGeneral(record) ?? general, reference);
    assert.equal(prepared.product.reference, reference);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.deepEqual(prepared.product.spec, { ...recoverGomarizDocumentedRenaultPremiumSpecs(record, recoverGomarizDocumentedScaniaP220Specs(record, { ...record.specs, ...(record.year ? { "Año de fabricación": record.year } : {}) })), ...reconcileGomarizVerifiedPlatformHeight(record).specs });
    assert.equal(JSON.stringify(record), original);
  }
});

test("Gomariz: incorpora altura de almacenaje coherente y rechaza valores sin evidencia válida", () => {
  const record = find("TE1620");
  const general = resolveGomarizGeneralDescription(record);
  assert.ok(general?.includes("una altura de almacenaje de 2,74 m"));
  assert.equal(prepareSourceProduct(record).product.description_general, general);
  for (const value of ["20 m", "0 m", "-1 m", "2 kg", "2 a 3 m"]) {
    const variant = { ...record, specs: { ...record.specs, "Altura almacenaje": value } };
    const result = resolveGomarizGeneralDescription(variant);
    assert.ok(result);
    assert.equal(result.includes("altura de almacenaje"), false, value);
  }
  assert.equal(resolveGomarizGeneralDescription(find("TE1858")), null);
  assert.equal(resolveGomarizGeneralDescription(find("GR1113")), null);
});

test("Gomariz: contradicciones o descripción propia acreditada no se reescriben", () => {
  for (const reference of [
    "TE1858", "TE1621", "TE1622", "BA1465", "OR1537",
    "CC1535", "CC1666", "5051BDX", "PV556"
  ]) {
    const record = find(reference);
    assert.equal(resolveGomarizGeneralDescription(record), null, reference);
    const prepared = prepareSourceProduct(record).product.description_general;
    const suffix = record.year ? ` Año de fabricación de esta unidad: ${record.year}.` : "";
    const underlying = suffix && prepared?.endsWith(suffix) ? prepared.slice(0, -suffix.length) : prepared;
    const verified = signedGenerals[`gomariz:${reference}`];
    const expected = verified?.general ?? verifiedGomarizPriorityGeneral(record) ?? resolveGomarizUnitSpecificGeneral(record) ?? record.longDescription;
    assert.equal(underlying, resolveGomarizVerifiedModelGeneral(record, expected) ?? expected, reference);
  }
});

test("Gomariz: rechaza identidades, proveedores y magnitudes incompatibles", () => {
  const record = find("TE1620");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, categoryKey: "alquiler" },
    { ...record, reference: null },
    { ...record, url: record.url.replace("gomarizrent.com", "example.com") },
    { ...record, url: record.url.replace("elevador-tijera", "brazo-articulado") },
    { ...record, brand: "Genie" },
    { ...record, model: "OTRO" },
    { ...record, title: "LGMG OTRO" },
    { ...record, longDescription: "La tijera LGMG S1413EII está descrita específicamente." },
    { ...record, longDescription: "Ficha técnica propia sin texto de familia" },
    { ...record, specs: { ...record.specs, "Altura de trabajo": "12 kg" } },
    { ...record, specs: { ...record.specs, "Altura plataforma": "16 m" } },
    { ...record, specs: { ...record.specs, Motor: "Diésel" } },
    { ...record, specs: { "Altura de trabajo": "15,8 m", Capacidad: "320 kg" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveGomarizGeneralDescription(variant), null, String(index));
  }
});

test("Gomariz: el piloto se aplica solo a la cohorte segura y preserva todas las identidades", () => {
  const affected = source.products.filter((record) => resolveGomarizGeneralDescription(record) !== null);
  assert.equal(source.products.length, 143);
  assert.equal(affected.length, 116);
  const seen = new Set<string>();
  for (const record of source.products) {
    const reference = record.reference;
    assert.ok(reference && !seen.has(reference));
    seen.add(reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.reference, reference);
    const base = verifiedGomarizPriorityGeneral(record) ?? resolveGomarizIndividualizedGeneral(record) ?? resolveGomarizCriticalBriefGeneral(record) ??
      resolveGomarizGeneralDescription(record) ?? resolveGomarizUnitSpecificGeneral(record) ?? record.longDescription;
    const general = prepared.product.description_general;
    const suffix = record.year ? ` Año de fabricación de esta unidad: ${record.year}.` : "";
    const underlying = suffix && general?.endsWith(suffix) ? general.slice(0, -suffix.length) : general;
    const verified = signedGenerals[`gomariz:${reference}`];
    const expected = verified?.general ?? removeGomarizConversationalLead(record, base) ?? base;
    assert.equal(underlying, resolveGomarizVerifiedModelGeneral(record, expected) ?? expected);
    assert.deepEqual(prepared.product.spec, { ...recoverGomarizDocumentedRenaultPremiumSpecs(record, recoverGomarizDocumentedScaniaP220Specs(record, { ...record.specs, ...(record.year ? { "Año de fabricación": record.year } : {}) })), ...reconcileGomarizVerifiedPlatformHeight(record).specs });
  }
});

test("Gomariz: incorpora alcance lateral solo cuando está publicado con unidad y valor válido", () => {
  const reference = find("BA1335");
  const general = resolveGomarizGeneralDescription(reference);
  assert.ok(general?.includes("un alcance lateral de 17,07 m"));
  assert.ok(prepareSourceProduct(reference).product.description_general?.includes("17,07 m"));
  const other = find("MT1661");
  assert.ok(resolveGomarizGeneralDescription(other)?.includes("un alcance lateral de 9,25 m"));
  const zero = find("TE1602");
  assert.equal(zero.specs?.["Alcance lateral"], "0 m");
  assert.ok(!resolveGomarizGeneralDescription(zero)?.includes("alcance lateral"));
  for (const value of ["0 m", "-1 m", "8.45 kg", "8 y 10 m", ["8 m", "10 m"]]) {
    const variant = { ...reference, specs: { ...reference.specs, "Alcance lateral": value } };
    const description = resolveGomarizGeneralDescription(variant);
    assert.ok(description);
    assert.equal(description.includes("alcance lateral"), false);
  }
  const enriched = source.products.filter((record) =>
    resolveGomarizGeneralDescription(record)?.includes("alcance lateral"));
  assert.equal(enriched.length, 37);
});

test("Gomariz: recupera usos y elementos documentados de tijeras LGMG sin generalizar otras máquinas", () => {
  const expected = new Set([
    "TE1616", "TE1617", "TE1619",
    "TE1735", "TE1736", "TE1737", "TE1738", "TE1739", "TE1740", "TE1741",
    "TE1742", "TE1743", "TE1744", "TE1745", "TE1747", "TE1748",
    "TE1585", "TE1586", "TE1588", "TE1591", "TE1594", "TE1595", "TE1596",
    "TE1597", "TE1598", "TE1599", "TE1601", "TE1602", "TE1610",
    "TE1651", "TE1652", "TE1653", "TE1654", "TE1655", "TE1656", "TE1657",
    "TE1620", "TE1614", "TE61", "TE1222", "TE961", "TE980", "TE754",
    "TE1756", "TE1603", "TE1604", "TE1754", "TE1607", "TE1606", "TE1605"
  ]);
  const feature = "El proveedor también describe las tijeras eléctricas de esta categoría como equipos para trabajar en interiores, con ruedas antihuellas y plataforma extensible.";
  const actual = source.products.filter((record) => resolveGomarizGeneralDescription(record)?.includes(feature));
  assert.deepEqual(new Set(actual.map((record) => record.reference)), expected);
  for (const record of actual) {
    const prepared = prepareSourceProduct(record);
    assert.ok(prepared.product.description_general?.endsWith(feature));
    assert.equal(prepared.status, "ready");
    assert.deepEqual(prepared.product.spec, { ...recoverGomarizDocumentedRenaultPremiumSpecs(record, recoverGomarizDocumentedScaniaP220Specs(record, { ...record.specs, ...(record.year ? { "Año de fabricación": record.year } : {}) })), ...reconcileGomarizVerifiedPlatformHeight(record).specs });
  }
  for (const reference of ["TE1746", "TE1618", "TE1621", "TE1858"]) {
    assert.equal(resolveGomarizGeneralDescription(find(reference))?.includes(feature) ?? false, false, reference);
  }
  const original = find("TE1742");
  const invalid: readonly ProductRecord[] = [
    { ...original, condition: "Nuevo" },
    { ...original, model: "S0812II" },
    { ...original, brand: "OTRA" },
    { ...original, specs: { ...original.specs, Motor: "Diésel" } },
    { ...original, longDescription: original.longDescription?.replace("ruedas anti-huellas", "ruedas estándar") ?? null },
    { ...original, url: original.url.replace("lgmg-s0607e-2-9", "lgmg-s0607e-9") },
    { ...original, url: original.url.replace("lgmg-s0607e-2-9", "lgmg-s0607e-2-brazo-articulado") }
  ];
  for (const record of invalid) {
    assert.equal(resolveGomarizGeneralDescription(record)?.includes(feature) ?? false, false);
  }
});


test("Gomariz: conserva la evidencia funcional por modelo y descarta variantes cruzadas", () => {
  const feature = "con ruedas antihuellas y plataforma extensible.";
  for (const reference of ["TE1585", "TE1610", "TE1654", "TE1651"]) {
    const record = find(reference);
    const sourceSnapshot = JSON.stringify(record);
    const resolved = resolveGomarizGeneralDescription(record);
    assert.ok(resolved, reference);
    assert.ok(resolved.endsWith(feature), reference);
    assert.ok(resolved.includes(record.model ?? ""), reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.description_general, resolved);
    assert.deepEqual(prepared.product.spec, { ...recoverGomarizDocumentedRenaultPremiumSpecs(record, recoverGomarizDocumentedScaniaP220Specs(record, { ...record.specs, ...(record.year ? { "Año de fabricación": record.year } : {}) })), ...reconcileGomarizVerifiedPlatformHeight(record).specs });
    assert.equal(JSON.stringify(record), sourceSnapshot);
    const variants: readonly ProductRecord[] = [
      { ...record, brand: "OTRA" },
      { ...record, model: "MODELO DIFERENTE" },
      { ...record, condition: "Nuevo" },
      { ...record, specs: { ...record.specs, Motor: "Diésel" } },
      { ...record, url: `${record.url}?otro-modelo=1` },
      { ...record, longDescription: "Descripción técnica no acreditada" },
      { ...record, longDescription: record.longDescription?.replace("ruedas anti-huellas", "ruedas estándar") ?? null }
    ];
    for (const variant of variants) {
      assert.equal(resolveGomarizGeneralDescription(variant)?.includes(feature) ?? false, false, reference);
    }
  }
});


test("Gomariz: mantiene identidad y evidencia al recuperar funcionalidades en otras tijeras eléctricas", () => {
  for (const reference of ["TE61", "TE1614", "TE1222", "TE754", "TE1604", "TE1607"]) {
    const record = find(reference);
    const snapshot = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    const result = resolveGomarizGeneralDescription(record);
    assert.ok(result?.includes("con ruedas antihuellas y plataforma extensible."), reference);
    assert.equal(prepared.product.description_general, result, reference);
    assert.deepEqual(prepared.product.spec, recoverGomarizDocumentedRenaultPremiumSpecs(record, recoverGomarizDocumentedScaniaP220Specs(record, { ...record.specs, ...(record.year ? { "Año de fabricación": record.year } : {}) })), reference);
    assert.equal(JSON.stringify(record), snapshot, reference);
    const invalid: readonly ProductRecord[] = [
      { ...record, model: "OTRO" },
      { ...record, specs: { ...record.specs, Motor: "Diésel" } },
      { ...record, url: `${record.url}?variacion=1` },
      { ...record, url: record.url.replace("elevador-tijera/", "brazo-articulado/") },
      { ...record, longDescription: record.longDescription?.replace("ruedas anti-huellas", "ruedas estándar") ?? null }
    ];
    for (const variant of invalid) {
      assert.equal(resolveGomarizGeneralDescription(variant)?.includes("con ruedas antihuellas y plataforma extensible.") ?? false, false, reference);
    }
  }
});

test("Gomariz: recupera elementos de la familia de tijeras diésel sin atribuirlos a cada unidad", () => {
  const expected = new Set([
    "TD1511", "TD1543", "TD815", "TD841", "TD1295", "TD1564",
    "TD1625", "TD1624", "TD1623", "TD1799", "TD1794", "TD1792",
    "TD1767", "TD1726", "TD1725", "TD1626", "TD1572", "TD1339", "TD1337"
  ]);
  const feature = "El proveedor menciona plataformas extensibles y estabilizadores en la descripción de esta familia de tijeras diésel; su presencia debe verificarse para cada unidad.";
  const enriched = source.products.filter((record) =>
    resolveGomarizGeneralDescription(record)?.includes(feature));
  assert.deepEqual(new Set(enriched.map((record) => record.reference)), expected);
  for (const record of enriched) {
    const snapshot = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    assert.ok(prepared.product.description_general?.endsWith(feature), record.reference ?? "");
    assert.equal(prepared.product.description_general, resolveGomarizGeneralDescription(record));
    assert.deepEqual(prepared.product.spec, { ...recoverGomarizDocumentedRenaultPremiumSpecs(record, recoverGomarizDocumentedScaniaP220Specs(record, { ...record.specs, ...(record.year ? { "Año de fabricación": record.year } : {}) })), ...reconcileGomarizVerifiedPlatformHeight(record).specs });
    assert.equal(JSON.stringify(record), snapshot);
  }
  const record = find("TD1625");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, condition: "Nuevo" },
    { ...record, model: "SR1623D" },
    { ...record, brand: "Genie" },
    { ...record, title: "LGMG SR1623D" },
    { ...record, specs: { ...record.specs, Motor: "Eléctrico" } },
    { ...record, url: `${record.url}?otro=1` },
    { ...record, url: record.url.replace("elevador-tijera", "brazo-articulado") },
    { ...record, url: record.url.replace("lgmg-sr1018d", "lgmg-sr1623d") },
    { ...record, longDescription: record.longDescription?.replace("estabilizadores", "apoyos") ?? null }
  ];
  for (const variant of variants) {
    assert.equal(resolveGomarizGeneralDescription(variant)?.includes(feature) ?? false, false);
  }
});
