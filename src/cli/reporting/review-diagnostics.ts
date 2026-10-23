import type { PreparedProduct } from "../../catalog/import/preparation/contracts.js";

const MAX_EXAMPLES = 3;

const diagnosticKind = (reason: string): string => {
  if (reason.startsWith("Atributo contradictorio: ")) return "contradicción entre valores publicados";
  if (reason.startsWith("Atributo rechazado por seguridad: ")) return "dato descartado por regla de seguridad";
  if (reason.startsWith("Atributo no normalizable: ")) return "valor observado sin normalización fiable";
  if (/^(?:Referencia ausente|Título ausente|Precio no disponible o inválido|Precio ausente o inválido|Descripción (?:corta ausente|ausente)|Imágenes válidas ausentes|Atributo obligatorio ausente:)/.test(reason)) {
    return "requisito Excel; origen por contrastar";
  }
  if (reason === "Descripción comercial contradictoria: altura de trabajo") return "alturas comerciales explícitas incompatibles";
  if (reason === "Precio publicado inválido") return "valor numérico publicado no interpretable";
  if (/^(?:Tipo de máquina de origen|Categoría Equipzilla|Condición comercial)/.test(reason)) return "equivalencia o condición por verificar";
  if (/^(?:Número de serie |Referencia duplicada en la extracción)/.test(reason)) return "integridad de identidad";
  return "sin causa clasificada";
};

export const formatReviewDiagnostics = (products: readonly PreparedProduct[]): readonly string[] => {
  const groups = new Map<string, { count: number; only: number; references: string[] }>();
  let reviewed = 0;
  let single = 0;
  let multiple = 0;
  let withoutReasons = 0;
  let incidences = 0;
  const conditions = new Map<string, { ready: number; review: number }>([
    ["Nuevo", { ready: 0, review: 0 }],
    ["Segunda_Mano", { ready: 0, review: 0 }],
    ["Sin confirmar", { ready: 0, review: 0 }]
  ]);

  for (const entry of products) {
    const key = entry.product.condition ?? "Sin confirmar";
    const cohort = conditions.get(key);
    if (cohort) cohort[entry.status] += 1;
    if (entry.status !== "review") continue;
    reviewed += 1;
    const reasons = [...new Set(entry.issues)];
    incidences += reasons.length;
    if (reasons.length === 0) withoutReasons += 1;
    else if (reasons.length === 1) single += 1;
    else multiple += 1;

    for (const reason of reasons) {
      const group = groups.get(reason) ?? { count: 0, only: 0, references: [] };
      group.count += 1;
      if (reasons.length === 1) group.only += 1;
      if (group.references.length < MAX_EXAMPLES) {
        group.references.push(entry.product.reference?.trim() || entry.product.sourceUrl);
      }
      groups.set(reason, group);
    }
  }

  if (reviewed === 0) return [];

  const lines = [
    `  Diagnóstico review: ${reviewed} fichas | 1 motivo: ${single} | 2+ motivos: ${multiple} | sin motivo: ${withoutReasons} | incidencias: ${incidences}`,
    "  Cohortes por condición (estado declarado; sin atribuir causas):",
    ...[...conditions].map(([condition, counts]) => `    ${condition}: ${counts.ready + counts.review} ${counts.ready + counts.review === 1 ? "ficha" : "fichas"} | ready: ${counts.ready} | review: ${counts.review}`),
    "  Motivos (fichas únicas por motivo; solo = único bloqueo; con otros = bloqueo simultáneo):"
  ];
  const sorted = [...groups].sort(([leftReason, left], [rightReason, right]) =>
    right.count - left.count || leftReason.localeCompare(rightReason, "es"));
  for (const [reason, group] of sorted) {
    lines.push(`    ${reason || "(motivo sin texto)"} | ${group.count} ${group.count === 1 ? "ficha" : "fichas"} | solo: ${group.only} | con otros: ${group.count - group.only} | refs: ${group.references.join(", ")} | diagnóstico: ${diagnosticKind(reason)}`);
  }
  lines.push("  Causa de los bloqueos: no determinada por estos motivos; las etiquetas indican requisitos o áreas de contraste, no fallos de extracción demostrados.");
  return lines;
};

export const formatPriceAvailability = (products: readonly PreparedProduct[]): string => {
  const withoutPrice = products.filter((entry) => entry.product.price === null).length;
  return `  Precio no normalizado: ${withoutPrice} fichas | informativo para create/many; excluyente para Excel`;
};
