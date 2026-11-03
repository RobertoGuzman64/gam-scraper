import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { documentedLegacyPlatformModels } from "../../../evidence/providers/mercaeleva/documented-legacy-platform-models.js";
import { validMercaelevaTechnicalSource } from "./technical.js";

const identity = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "").replaceAll("dabricacion", "fabricacion");

export const resolveMercaelevaLegacyPlatformGeneral = (record: ProductRecord): string | null => {
  if (record.providerId !== "mercaeleva" || record.categoryKey !== "venta" ||
    !validMercaelevaTechnicalSource(record) || !record.reference || !/^M\d+-\d+$/.test(record.reference) ||
    !record.url.replace(/\/$/, "").endsWith(`-${record.reference}`)) return null;

  const model = documentedLegacyPlatformModels.find((entry) =>
    entry.brand === record.brand && entry.model === record.model && entry.condition === record.condition);
  if (!model || !record.year || !/^(?:19|20)\d{2}$/.test(record.year)) return null;

  const specs = record.specs;
  if (!specs || specs["Estado"] !== (model.condition === "Nuevo" ? "Nuevo" : "Usado") ||
    (model.condition === "Segunda mano" && specs["Condición general"] !== "Bueno") ||
    (model.condition === "Nuevo" && specs["Condición general"] !== undefined &&
      specs["Condición general"] !== "Realmente bueno") ||
    specs["Marca"] !== model.brand || specs["Modelo"] !== model.model ||
    specs["Año de fabricación"] !== record.year || specs["Tipo de motor"] !== model.motor ||
    specs["Título adicional"] !== (model.title ?? undefined) ||
    !record.title || !record.title.startsWith(`${model.brand} ${model.model} `)) return null;

  const advertisedHeight = Number(model.advertisedHeight.replace(" m", "").replace(",", "."));
  const structuredHeight = specs["Altura de trabajo"];
  if (typeof structuredHeight !== "string" ||
    Number(structuredHeight.replace(" m", "").replace(",", ".")) !== advertisedHeight) return null;

  const additionalTitle = model.title ?? `NUEVA!!! PLATAFORMA TIJERA ELECTRICA ${advertisedHeight} MT`;
  if (identity(record.title) !== identity(`${model.brand} ${model.model} ${additionalTitle}`)) return null;

  const article = specs["Artículo No."];
  if ((article !== undefined && (typeof article !== "string" || !/^[\p{L}\d/-]+$/u.test(article))) ||
    (article === undefined && model.condition !== "Nuevo")) return null;
  const hours = specs["Horas laborales"];
  const structuredHours = typeof hours === "string" && /^(?:0|[1-9]\d*) h$/.test(hours)
    ? hours.slice(0, -2) : null;
  if ((hours !== undefined && !structuredHours) || record.horometer !== structuredHours) return null;

  const original = record.longDescription?.trim();
  if (!original) return null;
  const advertisedHours = /\bHORAS\s*:?\s*(\d{1,6})\b/i.exec(original)?.[1] ?? null;
  const suffix = /\bSECOND LIFE$/i.test(original) ? " SECOND LIFE" :
    /\bPINTADA$/i.test(original) ? " PINTADA" : "";
  const sourceKind = model.kind === "articulated" ? "ARTICULADA" :
    model.kind === "telescopic" ? "TELESCOPICA" : "TIJERA";
  const sourceMotor = model.motor === "Diesel" ? "DIESEL" : "ELECTRICA";
  const heightSource = model.advertisedHeight.replace(" m", "").replace(",", ".");
  const expectedSource = `${article ? `Ref. ${article}` : "NUEVA!!"} PLATAFORMA ${sourceKind} ${sourceMotor} ` +
    `ALTURA DE TRABAJO ${heightSource} MT ${model.brand} ${model.model}` +
    `${advertisedHours ? ` HORAS ${advertisedHours}` : ""} AÑO DE FABRICACION ${record.year}${suffix}`;
  if (identity(original) !== identity(expectedSource)) return null;

  const family = model.kind === "articulated" ? "articulada" :
    model.kind === "telescopic" ? "telescópica" : "de tijera";
  const application = model.kind === "articulated"
    ? "situar la cesta en zonas elevadas con obstáculos intermedios, mediante el brazo articulado y su alcance lateral"
    : model.kind === "telescopic"
      ? "realizar inspecciones, montajes y mantenimiento a distancia del punto de apoyo con su brazo telescópico"
      : "elevar verticalmente operarios y herramientas, aprovechando la superficie de plataforma en tareas de montaje y mantenimiento";
  const unit = model.condition === "Nuevo" ? "anunciada como nueva" : "anunciada como usada";
  const unitHours = structuredHours === advertisedHours && structuredHours !== null
    ? ` El vendedor consigna ${structuredHours} horas de uso en el anuncio y en la ficha.`
    : structuredHours && advertisedHours
      ? ` Hay una discrepancia que debe verificarse: el anuncio original indica ${advertisedHours} horas, mientras la ficha técnica consigna ${structuredHours} h; no se consideran lecturas equivalentes.`
      : structuredHours
        ? ` La ficha estructurada consigna ${structuredHours} h, aunque el anuncio original no indica horas.`
        : advertisedHours
          ? ` El anuncio menciona ${advertisedHours} horas, sin una lectura de horómetro estructurada que las confirme.`
          : " El origen no aporta una lectura de horómetro acreditada.";
  const sellerLabels = suffix === " SECOND LIFE"
    ? " El anuncio utiliza la etiqueta comercial «SECOND LIFE», sin acreditar por sí sola una rehabilitación concreta."
    : suffix === " PINTADA"
      ? " El vendedor añade la indicación «PINTADA», sin que ello acredite una revisión mecánica."
      : "";
  const manufacturerHeight = model.manufacturerHeight === model.advertisedHeight
    ? `La documentación del modelo también indica ${model.manufacturerHeight} de altura de trabajo.`
    : `La altura de trabajo anunciada es ${model.advertisedHeight}; la ficha técnica del modelo documenta ${model.manufacturerHeight}.`;

  return `La plataforma ${family} ${model.motor === "Diesel" ? "diésel" : "eléctrica"} ${model.brand} ${model.model} está concebida para ${application}. ` +
    `Mercaeleva ofrece esta unidad ${unit}, con año de fabricación ${record.year}.${unitHours} ` +
    `${manufacturerHeight} Su altura de plataforma documentada es ${model.platformHeight} y su capacidad nominal es ${model.capacity}; ` +
    `destaca ${model.distinctive}. ` +
    `La capacidad y el alcance son referencias del modelo sujetas a las limitaciones de la versión y configuración; no sustituyen la comprobación técnica de la unidad.${sellerLabels}` +
    `${article ? ` Referencia comercial del vendedor: ${article}.` : ""}`;
};
