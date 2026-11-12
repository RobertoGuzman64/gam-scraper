import assert from "node:assert/strict";
import test from "node:test";
import { createCommercialExceptionAccreditation, validCommercialExceptionAccreditation } from "../commercial-exception-accreditation.js";

test("una evidencia solo ampara la incidencia, origen y producto exactos", () => {
  const issue = {
    identity: "gam:ref:123", reference: "123", sourceUrl: "https://example.com/123",
    reason: "ano-url-atributo-discordante",
  };
  const product = { reference: "123", title: "Máquina", attributes: [{ attributeID: 7, value: 2017 }] };
  const recognition = { fingerprint: "a".repeat(64), evidenceSha256: "b".repeat(64), field: "year" };
  const accreditation = createCommercialExceptionAccreditation("gam", issue, product, recognition);
  const original = { ...issue, accreditation };
  assert.equal(validCommercialExceptionAccreditation("gam", original, product), true);
  assert.equal(validCommercialExceptionAccreditation("gam", original, { ...product, title: "Otra máquina" }), false);
  assert.equal(validCommercialExceptionAccreditation("gomariz", original, product), false);
  assert.equal(validCommercialExceptionAccreditation("gam", { ...original, identity: "gam:ref:456" }, product), false);
  assert.equal(validCommercialExceptionAccreditation("gam", { ...original, reason: "incidencia-nueva" }, product), false);
  assert.equal(validCommercialExceptionAccreditation("gam", { ...original, accreditation: {
    ...accreditation, fingerprint: "c".repeat(64)
  } }, product), false);
  assert.equal(validCommercialExceptionAccreditation("gam", { ...issue }, product), false);
});
