import type { ProductRecord } from "../../../contracts/catalog.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import type { AttributeResolution } from "../mapping/attribute-types.js";
import type { ImportCatalog } from "../../legacy-export/contracts.js";
import type { Attribute } from "../mapping/attribute-types.js";
import { SOURCE_TECHNICAL_FIELDS } from "./technical-fields.js";

const issuePrefix: Readonly<Partial<Record<AttributeResolution["status"], string>>> = {
  contradiction: "Atributo contradictorio: ",
  invalid: "Atributo no normalizable: ",
  rejected: "Atributo rechazado por seguridad: "
};

const checkAttributeQuality = (record: ProductRecord, attributes: readonly Attribute[]): readonly string[] => {
  const byName = new Map<string, Set<AttributeResolution["status"]>>();
  const seenDefinitions = new Set<string>();
  for (const attribute of attributes) {
    const definition = JSON.stringify([attribute.name, attribute.type, attribute.unit_option]);
    if (seenDefinitions.has(definition)) continue;
    seenDefinitions.add(definition);
    const status = resolveAttribute(record, attribute).status;
    const statuses = byName.get(attribute.name) ?? new Set<AttributeResolution["status"]>();
    statuses.add(status);
    byName.set(attribute.name, statuses);
  }
  const issues: string[] = [];
  for (const [name, statuses] of byName) {
    if (statuses.has("resolved") || statuses.has("not_observed")) continue;
    const status = statuses.has("contradiction") ? "contradiction" :
      statuses.has("invalid") ? "invalid" : statuses.has("rejected") ? "rejected" : null;
    if (status) issues.push(`${issuePrefix[status]}${name}`);
  }
  return issues;
};

export const sourceAttributeQualityIssues = (record: ProductRecord, catalog: ImportCatalog): readonly string[] =>
  checkAttributeQuality(record, catalog.attributes);

export const sourceTechnicalQualityIssues = (record: ProductRecord): readonly string[] =>
  checkAttributeQuality(record, SOURCE_TECHNICAL_FIELDS);
