import assert from "node:assert/strict";
import test from "node:test";
import type { ImportCatalog } from "../../legacy-export/contracts.js";
import type { CommercialCategoryTreeProvider } from "../commercial-category-tree.js";
import { renderCommercialCategoryTree } from "../commercial-category-tree.js";

const categories: ImportCatalog["categories"] = [
  { id: 1, parentId: null, name: "Maquinaria", slug: "maquinaria" },
  { id: 24, parentId: 1, name: "Maquinaria Nueva", slug: "nuevo" },
  { id: 4, parentId: 24, name: "Plataformas Elevadoras", slug: "plataforma-elevadora" },
  { id: 100, parentId: 4, name: "Tijeras Eléctricas", slug: "plataforma-tijera-electrica" },
  { id: 101, parentId: 4, name: "Otra Familia", slug: "otra-familia" }
];

const decision = (
  reference: string, title: string, categorySellID: number | null,
  status: "proposed" | "pending" | "excluded"
): CommercialCategoryTreeProvider["decisions"][number] => ({
  reference, sourceUrl: `https://example.com/products/${reference}`, categorySellID, status, title,
  shortPreview: null, generalPreview: null, images: 0, specifications: 0, metadata: null,
  titleChanged: false, descriptionTitleChanged: false, signals: []
});

test("el árbol agrupa por la jerarquía original e incluye cada máquina una sola vez", () => {
  const providers: readonly CommercialCategoryTreeProvider[] = [
    { providerId: "gam", decisions: [
      decision("31", "Plataforma eléctrica GENIE GS-1932", 100, "proposed"),
      decision("2", "Plataforma eléctrica JLG 1930ES", 100, "proposed"),
      decision("5", "Equipo sin categoría", null, "pending"),
      decision("9", "Lote de maquinaria", null, "excluded")
    ] },
    { providerId: "gomariz", decisions: [decision("BA1", "Tijera eléctrica LGMG", 100, "proposed")] }
  ];
  const lines = renderCommercialCategoryTree(categories, providers);
  assert.deepEqual(lines, [
    "ÁRBOL COMERCIAL | 3 categorizadas | 1 pendientes | 1 excluidas",
    "└─ Maquinaria [1] · 3",
    "   └─ Maquinaria Nueva [24] · 3",
    "      └─ Plataformas Elevadoras [4] · 3",
    "         └─ Tijeras Eléctricas [100] · 3",
    "            ├─ GAM 2 — Plataforma eléctrica JLG 1930ES",
    "            ├─ GAM 31 — Plataforma eléctrica GENIE GS-1932",
    "            └─ GOMARIZ BA1 — Tijera eléctrica LGMG",
    "SIN CATEGORÍA · 1",
    "  GAM 5 — Equipo sin categoría"
  ]);
  assert.deepEqual(lines, renderCommercialCategoryTree(categories, providers));
  assert.equal(lines.filter((line) => line.includes("GAM 31")).length, 1);
  assert.equal(lines.some((line) => line.includes("Otra Familia")), false);
});

test("el árbol conserva títulos identificativos sin convertirlos en avisos", () => {
  const providers: readonly CommercialCategoryTreeProvider[] = [{ providerId: "gam", decisions: [
    decision("1", `Equipo ${"largo ".repeat(40)}`, 100, "proposed"),
    decision("2", "Otra unidad", 4, "proposed")
  ] }];
  const lines = renderCommercialCategoryTree(categories, providers);
  assert.ok(lines.some((line) => line.includes("GAM 1 — Equipo") && line.endsWith("…")));
  assert.ok(lines.some((line) => line.includes("GAM 2 — Otra unidad")));
  assert.ok(lines.some((line) => line.includes("Plataformas Elevadoras [4] · 2")));
  assert.equal(lines.some((line) => line.includes("BLOQUEANTE") || line.includes("REVISAR")), false);
});

test("rechaza categorías inexistentes y jerarquías circulares", () => {
  const providers: readonly CommercialCategoryTreeProvider[] = [
    { providerId: "gam", decisions: [decision("1", "Máquina", 500, "proposed")] }
  ];
  assert.throws(() => renderCommercialCategoryTree(categories, providers), /inexistente/);
  const cycle: ImportCatalog["categories"] = [
    { id: 1, parentId: 2, name: "Uno", slug: "uno" },
    { id: 2, parentId: 1, name: "Dos", slug: "dos" }
  ];
  assert.throws(() => renderCommercialCategoryTree(cycle, [
    { providerId: "gam", decisions: [decision("1", "Máquina", 1, "proposed")] }
  ]), /Ciclo/);
});
