import { documentedPlatformUnitDetails } from "./documented-platform-unit-details.js";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { verifiedFurtherPlatformModelDocumentation } from "../../../evidence/providers/mercaeleva/further-platform-model-documentation.js";
import { resolveMercaelevaGeneralDescription } from "./general-description.js";

const verifiedOptimumAcSource = (record: ProductRecord): boolean => {
  if (record.brand !== "Haulotte" || record.model !== "Optimum 8") return false;
  const article = record.specs?.["Artículo No."];
  const hours = record.specs?.["Horas laborales"];
  if (typeof article !== "string" || typeof hours !== "string" || !record.year ||
    !/^(?:0|[1-9]\d*) h$/.test(hours)) return false;
  return record.longDescription?.trim() ===
    `Ref. ${article} PLATAFORMA TIJERA ELECTRICA ALTURA DE TRABAJO 8 MT HAULOTTE OPTIMUM 8 AC HORAS ${hours.slice(0, -2)} AÑO DE FABRICACION ${record.year}`;
};

export const resolveMercaelevaDocumentedFurtherPlatformGeneral = (record: ProductRecord): string | null => {
  if (record.providerId !== "mercaeleva" || record.categoryKey !== "venta" ||
    !record.reference || !/^M\d+-\d+$/.test(record.reference) ||
    !record.url.replace(/\/$/, "").endsWith(`-${record.reference}`)) return null;
  const documentation = verifiedFurtherPlatformModelDocumentation.find((model) =>
    record.brand === model.brand && record.model === model.model && record.condition === model.condition);
  if (!documentation) return null;

  const technical = record.specs;
  if (!technical || technical["Estado"] !== (documentation.condition === "Nuevo" ? "Nuevo" : "Usado") ||
    (documentation.condition === "Segunda mano" && technical["Condición general"] !== "Bueno") ||
    (documentation.condition === "Nuevo" && technical["Condición general"] !== undefined) ||
    technical["Título adicional"] !== documentation.title ||
    technical["Altura de trabajo"] !== documentation.workHeight ||
    technical["Tipo de motor"] !== documentation.motor ||
    technical["Marca"] !== documentation.brand || technical["Modelo"] !== documentation.model ||
    !record.year || !/^(?:19|20)\d{2}$/.test(record.year) ||
    technical["Año de fabricación"] !== record.year ||
    !(documentation.model === "Optimum 8" ? verifiedOptimumAcSource(record) : resolveMercaelevaGeneralDescription(record))) return null;

  const verifiedUnit = documentedPlatformUnitDetails(record, technical);
  if (!verifiedUnit) return null;
  const { publishedHours, article } = verifiedUnit;

  const family = documentation.kind === "articulated" ? "articulada" : "de tijera";
  const application = documentation.kind === "articulated"
    ? "alcanzar posiciones elevadas por encima de obstáculos, con desplazamiento horizontal de la cesta para mantenimiento y montaje"
    : documentation.motor === "Diesel"
      ? "elevar equipos de trabajo y herramientas en operaciones de construcción y mantenimiento sobre superficies exteriores adecuadas"
      : "elevar personal y herramientas en instalaciones y mantenimiento, donde importan las dimensiones de acceso y la superficie de apoyo";
  const unit = documentation.condition === "Nuevo"
    ? `Mercaeleva anuncia la unidad como nueva, con año de fabricación ${record.year}${publishedHours ? ` y ${publishedHours} indicadas en su ficha` : ""}.`
    : `Mercaeleva identifica esta unidad como usada, fabricada en ${record.year}${publishedHours ? ` y con ${publishedHours} declaradas` : ""}; su condición general figura como buena según el vendedor.`;
  const height = `El anuncio indica ${documentation.workHeight} de altura de trabajo; la documentación del modelo recoge ${documentation.manufacturerWorkHeight} como referencia.`;

  return `La plataforma ${family} ${documentation.motor === "Diesel" ? "diésel" : "eléctrica"} ${documentation.brand} ${documentation.model} permite ${application}. ` +
    `${unit} ${height} La documentación del fabricante distingue ${documentation.platformHeight} de altura de plataforma y ${documentation.nominalCapacity} de capacidad nominal, además de ${documentation.dimension}. ` +
    `Son datos técnicos del modelo, no una certificación de la versión, los accesorios ni el estado de la unidad concreta. ` +
    `Referencia del vendedor: ${article}.`;
};
