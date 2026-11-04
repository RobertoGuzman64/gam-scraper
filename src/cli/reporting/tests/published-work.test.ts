import assert from "node:assert/strict";
import test from "node:test";
import { aggregatePublishedWork } from "../../../catalog/diagnostics/published-work.js";
import type { PublishedWorkProvider } from "../../../catalog/diagnostics/published-work.js";
import { formatPublishedWorkTerminal, renderPublishedWorkMarkdown } from "../published-work.js";

const provider = (providerId: string): PublishedWorkProvider => ({
  providerId, sourceSha256: "a".repeat(64), approvalSha256: "b".repeat(64),
  publicationSha256: "c".repeat(64),
  work: {
    processedProducts: 2, originalProducts: 3, publishedProducts: 2, excludedProducts: 1,
    transformedProducts: 1, specificationsAdded: 4, specificationsRenamed: 2,
    specificationValuesFormatted: 1, specificationValuesChanged: 2,
    descriptionsGenerated: 1, descriptionsTransformed: 2, titlesTransformed: 1,
    pricesChanged: 0, categoriesChanged: 0, conditionsChanged: 0, galleriesChanged: 0
  }
});

test("terminal y Markdown comparten el mismo resultado, con cifras agregadas y trazabilidad", () => {
  const report = aggregatePublishedWork([provider("gam"), provider("gomariz")]);
  assert.equal(report.total.specificationsAdded, 8);
  assert.equal(report.total.transformedProducts, 2);
  const terminal = formatPublishedWorkTerminal(report).join("\n");
  const markdown = renderPublishedWorkMarkdown(report);
  assert.match(terminal, /GAM.*specs \+4/);
  assert.match(terminal, /TOTAL.*specs \+8/);
  assert.match(markdown, /\| TOTAL \| 6 \| 4 \| 2 \| 2 \|/);
  assert.match(markdown, /\| TOTAL \| 8 \| 4 \| 2 \| 4 \|/);
  assert.match(markdown, /Huellas SHA-256 abreviadas/);
  assert.ok(markdown.split("\n").length < 70);
});

test("el informe rechaza conjuntos duplicados o vacíos", () => {
  assert.throws(() => aggregatePublishedWork([]), /ausentes/);
  assert.throws(() => aggregatePublishedWork([provider("gam"), provider("gam")]), /duplicados/);
});
