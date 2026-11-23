import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildProductIdentity } from "../../../../catalog/identity.js";
import { accreditedGamGallerySource, accreditedGamRegressionSource, accreditedSourceDatasets, accreditedSourceSamples } from "../../../../testing/domain-cases/accredited-source-samples.js";
import type { AccreditedSourceDataset } from "../../../../testing/domain-cases/accredited-source-samples.js";

const fingerprints: Readonly<Record<AccreditedSourceDataset, string>> = {
  "gam-original": "33ea0228c828d5ae9708a2c29575267e576c5ccaf94da80198c7e8c2401dad4a",
  "gam-regression-supplement": "4500ddc2afbc069e8fbb079dcdcce682b8461a7e336df715c98cbdfef1fefabe",
  "gam-gallery-supplement": "0bc91adbfbdfc699b7248b1f6c432f4fe4c1923d00cab6034088cfd2f0d05ea1",
  "gam-source-cases": "59ec46cced87e1f92f1da7e0bfeb08287f17b7c9b938ac3ea6313d68c1f4499e",
  "gam-editorial-cases": "8f7f2e54ca9ea12753b4b9ea85c42a59854320c3a3e43aa74ee31ba13af69602",
  "gam-short-discrepancy-source": "1c3c357ff00a3bec8d53ee3c4ce39b8462762b42a05030d3d9a5c466a41c7fdd",
  "gam-verified-fuel-cases": "980ecdd9184bc636778f740185bbdb78eb4ecca4d8cb297fa471386657154ce9",
  "gam-technical-units-cases": "1be3c561a6d46a50b375bdcbd94ba6c67c84da727f6396f4a37e6207f9f583fb",
  "manain-editorial-source": "25c616c6a18a2c3f4afde493d4cbf98875ae0818e163ec7e7b0356762beff9b4",
  "editorial-load-original": "b56bccc32be378258ab492a1fd409816367be63bd5c03cb884729df8e56b64c0",
  "mercaeleva-original": "6275107c64bf6e232d273338ae9ac32c63d4285bc711c6577d199f13baf63a51",
  "mercaeleva-source-cases": "f266674c1e611142bab26f67613d88ce731b48011380220ae21af0aafc57548d",
  "gomariz-original": "5495a569318cb9c64c5202b701fe611e99e02c22ef776adfb091d616d226fc4e",
  "gomariz-regression": "4d47ec00ba427c97adfac8e7494fcf64670f323a975a87449b161162ff4d5af7",
  "gomariz-documented-weight": "6036e986b5b69f07ffc8716d15111d486d3df69c929a95475f88c4f14d930c5e",
  "gomariz-special-original": "e5e7b85016b513d19831db0b81f3b01cbb660463f525ec299c517d317283e6f3",
};

for (const dataset of accreditedSourceDatasets) {
  test(`las muestras históricas ${dataset} conservan huella, identidad y contrato`, () => {
    const bytes = readFileSync(`src/testing/domain-cases/data/${dataset}.json`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), fingerprints[dataset]);
    const samples = accreditedSourceSamples(dataset);
    assert.ok(samples.length > 0);
    const providerId = samples[0]?.providerId;
    assert.ok(providerId);
    assert.ok(samples.every((sample) => sample.providerId === providerId && sample.reference && sample.url));
    assert.equal(new Set(samples.map((sample) => buildProductIdentity(sample).key)).size, samples.length);
  });
}

test("las evidencias GAM complementarias no duplican identidades históricas", () => {
  const samples = accreditedGamRegressionSource();
  assert.equal(new Set(samples.map((sample) => buildProductIdentity(sample).key)).size, samples.length);
});

test("las evidencias de galerías GAM forman un corte histórico sin duplicar identidades", () => {
  const samples = accreditedGamGallerySource();
  assert.equal(new Set(samples.map((sample) => buildProductIdentity(sample).key)).size, samples.length);
  assert.ok(samples.every((sample) => sample.providerId === "gam"));
});
