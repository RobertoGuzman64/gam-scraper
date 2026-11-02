import assert from "node:assert/strict";
import test from "node:test";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { normalizeSpecsObject } from "../../normalization/normalize-specs.js";
import { recoverGamVerifiedElectricDriveSpec } from "../evidence/providers/gam/verified-electric-drive-evidence.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const expected = [
  "6077", "6126", "6202", "6228", "6206", "6937", "6854", "6362",
  "6878", "6706", "5880", "6819", "6820", "6823", "6841", "5910",
  "6146", "6738", "6860", "6835", "6858", "6932", "6922", "5739",
  "6650", "5730", "6998", "6669", "6652", "5937", "6754", "6585",
  "6631", "6967", "6778", "6845", "6130", "6284", "6063", "6064", "6065", "6109", "6204", "6389",
  "6849", "6821", "6822", "6816", "6817", "6837", "6510", "6949", "5719", "6664", "6675", "5962", "6663", "6788",
  "6196", "6195", "6486", "6779", "6855", "6856", "6859", "6864", "5979", "5845", "6982", "6116", "6980", "6545", "5792", "6122", "5848", "6691", "6084", "6966"
];

const source = (reference: string) => {
  const record = gam.products.find((product) => product.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM: se acredita la motorización de unidades eléctricas con evidencia individual", () => {
  const changed: string[] = [];
  for (const record of gam.products) {
    const before = normalizeSpecsObject(record.specs).normalized;
    const recovered = recoverGamVerifiedElectricDriveSpec(record);
    const after = normalizeSpecsObject(recovered).normalized;
    if (record.reference && after["Motorización"] !== before["Motorización"]) {
      assert.equal(after["Motorización"], "Eléctrico", record.reference);
      assert.deepEqual(
        Object.fromEntries(Object.entries(after).filter(([key]) => key !== "Motorización")),
        before,
        record.reference
      );
      changed.push(record.reference);
    } else {
      assert.deepEqual(recovered, record.specs ?? {}, record.reference ?? "sin referencia");
    }
  }
  assert.deepEqual(changed.sort(), [...expected].sort());
});

test("GAM: los cambios de identidad y los motores ya declarados no se sobrescriben", () => {
  const record = source("5910");
  const blocked = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Nuevo" as const },
    { ...record, categoryKey: "maquinaria" },
    { ...record, brand: "YALE" },
    { ...record, model: "J1.8XNT" },
    { ...record, url: `${record.url}?variant=other` },
    { ...record, title: "Carretilla elevadora diésel HYSTER J1.8XNT MWB" },
    { ...record, shortDescription: `${record.shortDescription ?? ""} Diesel` },
    { ...record, longDescription: `${record.longDescription ?? ""} Motorización diésel` },
    { ...record, specs: { ...record.specs, Motorización: "Diésel" } },
    { ...record, specs: { ...record.specs, "Tipo motor": "Eléctrico" } }
  ];
  for (const altered of blocked) {
    assert.deepEqual(recoverGamVerifiedElectricDriveSpec(altered), altered.specs ?? {});
  }
  for (const reference of ["5895", "6436", "6852"]) {
    const unrelated = source(reference);
    assert.deepEqual(recoverGamVerifiedElectricDriveSpec(unrelated), unrelated.specs ?? {});
  }
});

test("GAM: la nueva cohorte eléctrica exige la huella exacta y conserva motores declarados", () => {
  const record = source("6650");
  for (const invalid of [
    { ...record, model: "E300AJ" },
    { ...record, title: "JLG E300AJP diésel" },
    { ...record, longDescription: `${record.longDescription ?? ""} Motor diésel.` },
    { ...record, specs: { ...record.specs, "Motorización": "Diésel" } }
  ]) {
    assert.deepEqual(recoverGamVerifiedElectricDriveSpec(invalid), invalid.specs ?? {});
  }
});


test("GAM: la fase 117 acredita 26 unidades eléctricas y bloquea cualquier cambio de origen", () => {
  const phase117 = [
    "6631", "6967", "6778", "6845", "6130", "6284", "6063", "6064", "6065", "6109", "6204", "6389",
    "6849", "6821", "6822", "6816", "6817", "6837", "6510", "6949", "5719", "6664", "6675", "5962", "6663", "6788"
  ];
  assert.equal(new Set(phase117).size, 26);
  for (const reference of phase117) {
    const record = source(reference);
    assert.equal(recoverGamVerifiedElectricDriveSpec(record)["Motorización"], "Eléctrico", reference);
    for (const altered of [
      { ...record, title: `${record.title} diésel` },
      { ...record, longDescription: `${record.longDescription ?? ""} Motor diésel.` },
      { ...record, url: `${record.url}?other=1` },
      { ...record, specs: { ...record.specs, Motorización: "Diésel" } }
    ]) {
      assert.deepEqual(recoverGamVerifiedElectricDriveSpec(altered), altered.specs ?? {}, reference);
    }
  }
});


test("GAM: la recuperación eléctrica conserva íntegramente las fichas de origen", () => {
  const recovered = [
    "6196", "6195", "6486", "6779", "6855", "6856", "6859", "6864", "5979", "5845", "6982", "6116", "6980", "6545", "5792", "6122", "5848", "6691", "6084", "6966"
  ];
  assert.equal(new Set(recovered).size, recovered.length);
  for (const reference of recovered) {
    const record = source(reference);
    assert.equal(recoverGamVerifiedElectricDriveSpec(record)["Motorización"], "Eléctrico", reference);
    for (const changed of [
      { ...record, url: `${record.url}?revision=1` },
      { ...record, model: `${record.model} X` },
      { ...record, shortDescription: `${record.shortDescription ?? ""} modificado` },
      { ...record, longDescription: `${record.longDescription ?? ""} Motor diésel.` },
      { ...record, specs: { ...record.specs, Motorización: "Diésel" } }
    ]) {
      assert.deepEqual(recoverGamVerifiedElectricDriveSpec(changed), changed.specs ?? {}, reference);
    }
  }
});
