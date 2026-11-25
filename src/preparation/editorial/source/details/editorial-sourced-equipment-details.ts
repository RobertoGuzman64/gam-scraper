import type { ProductRecord } from "../../../../contracts/catalog.js";
import { editorialFamilyOf } from "../../core/editorial-families.js";
import { resolvedEditorialUnitFamilies } from "../../identity/editorial-unit-provenance.js";
import { equipmentDetails, hammerCompatibility } from "./equipment-table-details.js";

export { resolvePlatformOperationalDetails } from "./platform-operational-details.js";
export { resolveHandlingOperationalDetails } from "./handling-operational-details.js";
export { resolveTransportOperationalDetails } from "./transport-operational-details.js";
export { resolveEquipmentConfigurationDetails } from "./equipment-configuration-details.js";

export const resolveSourcedEquipmentDetails = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  if (!authenticatedOrigin || !general?.trim() || source.longDescription?.trim() || source.shortDescription?.trim() ||
    /La tabla técnica de esta misma referencia especifica|La tabla del proveedor relaciona este implemento/iu.test(general)) return null;
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (!families || !families[0] || families[0] !== families[1]) return null;
  const family = editorialFamilyOf(general) ??
    (families[0] === "plataforma-unipersonal" && /\bplataforma unipersonal\b/iu.test(general) ?
      "plataforma-unipersonal" : null);
  if (family !== families[0]) return null;
  if (family === "martillo-miniexcavadora") {
    const compatibility = hammerCompatibility(source, prepared);
    return compatibility;
  }
  const details = equipmentDetails(source, prepared, family).filter((detail) =>
    !(/^altura exterior\b/u.test(detail) && /\baltura exterior declarada\b/iu.test(general)) &&
    !(/^altura total\b/u.test(detail) && /\baltura total declarada\b/iu.test(general)) &&
    !(/^tracción declarada\b/u.test(detail) && /\btracci[oó]n declarada\b/iu.test(general)));
  if (details.length === 0) return null;
  const listed = details.length === 1 ? details[0] :
    `${details.slice(0, -1).join(", ")} y ${details[details.length - 1]}`;
  return `La tabla técnica de esta misma referencia especifica ${listed}. ` +
    "Son valores declarados por el proveedor que deben contrastarse con la unidad anunciada.";
};
