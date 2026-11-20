import type { PanelProviderId } from "../evidence/types.js";
import { explorerCategoryCounts, explorerStageCounts, normalizeExplorerText } from "../explorer/explorer-selection.js";
import type { ExplorerIndexEntry, ExplorerSelection, ExplorerSort } from "../explorer/explorer-selection.js";
import type { PanelExplorerProduct, PanelSpecAddition } from "../explorer/types.js";

type Stage = PanelExplorerProduct["stage"] | "todos";
type Scope = PanelProviderId | "todos";
type Refinement = "missingOriginalShortDescription" | "missingOriginalGeneralDescription" | "withoutOriginalSpecs" |
  "withTechnicalAdditions" | "withTechnicalChanges" | "withTitleChanges" | "withEditorialChanges";

const stageNames: Readonly<Record<Stage, string>> = {
  todos: "Todas las fichas",
  commercial: "Salida comercial",
  "commercial-excluded": "Excluidas de comercial",
  "editorial-excluded": "Excluidas de FINISH"
};
const refinements: readonly { readonly id: string; readonly key: Refinement; readonly label: string }[] = [
  { id: "explorer-missing-short", key: "missingOriginalShortDescription", label: "Descripción corta ausente" },
  { id: "explorer-missing-general", key: "missingOriginalGeneralDescription", label: "Descripción general ausente" },
  { id: "explorer-without-specs", key: "withoutOriginalSpecs", label: "Sin especificaciones originales" },
  { id: "explorer-with-additions", key: "withTechnicalAdditions", label: "Especificaciones incorporadas" },
  { id: "explorer-with-changes", key: "withTechnicalChanges", label: "Valores técnicos modificados" },
  { id: "explorer-with-title-changes", key: "withTitleChanges", label: "Títulos modificados" },
  { id: "explorer-editorial-changes", key: "withEditorialChanges", label: "Descripciones cambiadas" }
];

const find = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Filtro de Explorador no disponible: ${id}`);
  return element;
};
const input = (id: string): HTMLInputElement => {
  const element = find(id);
  if (!(element instanceof HTMLInputElement)) throw new Error(`Entrada no válida: ${id}`);
  return element;
};
const select = (id: string): HTMLSelectElement => {
  const element = find(id);
  if (!(element instanceof HTMLSelectElement)) throw new Error(`Selector no válido: ${id}`);
  return element;
};
const create = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", value?: string): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
};
const number = new Intl.NumberFormat("es-ES");

export type ExplorerFilterControls = {
  readonly selection: () => ExplorerSelection;
  readonly updateScope: (scope: Scope) => void;
  readonly resetForCase: () => void;
  readonly render: () => void;
};

export const createExplorerFilterControls = (
  index: readonly ExplorerIndexEntry[], names: Readonly<Record<PanelProviderId, string>>,
  onChange: () => void
): ExplorerFilterControls => {
  let scope: Scope = "todos";
  let stage: Stage = "todos";
  let category = "todos";
  let query = "";
  let sort: ExplorerSort = "reference";
  let additionKind: PanelSpecAddition["kind"] | "todos" = "todos";
  const enabled: Record<Refinement, boolean> = {
    missingOriginalShortDescription: false,
    missingOriginalGeneralDescription: false,
    withoutOriginalSpecs: false,
    withTechnicalAdditions: false,
    withTechnicalChanges: false,
    withTitleChanges: false,
    withEditorialChanges: false
  };
  const selection = (): ExplorerSelection => ({
    providerId: scope, stage, category, query, sort, additionKind,
    missingOriginalDescription: false,
    missingOriginalShortDescription: enabled.missingOriginalShortDescription,
    missingOriginalGeneralDescription: enabled.missingOriginalGeneralDescription,
    withoutOriginalSpecs: enabled.withoutOriginalSpecs,
    withTechnicalAdditions: enabled.withTechnicalAdditions,
    withTechnicalChanges: enabled.withTechnicalChanges,
    withTitleChanges: enabled.withTitleChanges,
    withEditorialChanges: enabled.withEditorialChanges
  });
  const update = (): void => { onChange(); };
  const categoryPicker = find("explorer-category-picker");
  const categorySearch = input("explorer-category-search");
  const categoryChoices = find("explorer-category-options");
  const availableCategories = [...new Set(index.map(({ item }) => item.category)
    .filter((value): value is string => value !== null))].sort((a, b) => a.localeCompare(b, "es"));
  const renderCategories = (): void => {
    const categoryCounts = explorerCategoryCounts(index, selection());
    const counts = categoryCounts.counts;
    const term = normalizeExplorerText(categorySearch.value.trim());
    const options = availableCategories.filter((name) => !term || normalizeExplorerText(name).includes(term));
    categoryChoices.replaceChildren();
    const add = (name: string, label: string, count: number): void => {
      const button = create("button", `explorer-category-option${category === name ? " is-selected" : ""}`);
      button.type = "button";
      button.disabled = count === 0 && category !== name;
      button.setAttribute("aria-pressed", String(category === name));
      button.append(create("span", "", label), create("span", "explorer-option-count", number.format(count)));
      button.addEventListener("click", () => {
        category = name;
        categoryPicker.removeAttribute("open");
        categorySearch.value = "";
        update();
        find("explorer-category-summary").focus();
      });
      categoryChoices.append(button);
    };
    if (!term) add("todos", "Todas las categorías", categoryCounts.total);
    for (const name of options) add(name, name, counts.get(name) ?? 0);
    if (!categoryChoices.childElementCount) categoryChoices.append(create("p", "explorer-no-categories", "Sin categorías coincidentes"));
    find("explorer-category-current").textContent = category === "todos" ? "Todas las categorías" : category;
  };
  const render = (): void => {
    const counts = explorerStageCounts(index, selection());
    for (const current of ["todos", "commercial", "commercial-excluded", "editorial-excluded"] as const) {
      find(`explorer-stage-count-${current}`).textContent = `${stageNames[current]} · ${number.format(counts[current])}`;
    }
    renderCategories();
    const active: { readonly label: string; readonly clear: () => void }[] = [];
    if (scope !== "todos") active.push({ label: `Proveedor: ${names[scope]}`, clear: () => {
      const provider = select("provider-filter");
      provider.value = "todos";
      provider.dispatchEvent(new Event("change", { bubbles: true }));
    } });
    if (query) active.push({ label: `Búsqueda: ${query}`, clear: () => {
      query = "";
      input("explorer-search").value = "";
    } });
    if (category !== "todos") active.push({ label: `Categoría: ${category}`, clear: () => { category = "todos"; } });
    if (stage !== "todos") active.push({ label: stageNames[stage], clear: () => { stage = "todos"; } });
    const additionLabels: Readonly<Record<PanelSpecAddition["kind"], string>> = {
      own: "Propia ficha", reused: "Reutilizada", pending: "Por investigar"
    };
    if (additionKind !== "todos") active.push({ label: `Specs: ${additionLabels[additionKind]}`,
      clear: () => { additionKind = "todos"; } });
    for (const refinement of refinements) {
      if (!enabled[refinement.key]) continue;
      active.push({ label: refinement.label, clear: () => {
        enabled[refinement.key] = false;
        input(refinement.id).checked = false;
      } });
    }
    const target = find("explorer-active-filters");
    target.replaceChildren();
    target.hidden = !active.length;
    if (active.length) {
      const chips = create("div", "explorer-filter-chips");
      for (const filter of active) {
        const chip = create("button", "explorer-filter-chip", `${filter.label} ×`);
        chip.type = "button";
        chip.setAttribute("aria-label", `Quitar filtro ${filter.label}`);
        chip.addEventListener("click", () => { filter.clear(); update(); });
        chips.append(chip);
      }
      const clearAll = create("button", "explorer-clear-filters", "Limpiar");
      clearAll.type = "button";
      clearAll.setAttribute("aria-label", "Limpiar todos los filtros");
      clearAll.addEventListener("click", () => {
        resetFilters();
        if (scope !== "todos") {
          const provider = select("provider-filter");
          provider.value = "todos";
          provider.dispatchEvent(new Event("change", { bubbles: true }));
        } else update();
      });
      target.append(chips, clearAll);
    }
    select("explorer-stage").value = stage;
    select("explorer-spec-kind").value = additionKind;
    select("explorer-sort").value = sort;
  };
  const resetFilters = (): void => {
    query = "";
    category = "todos";
    stage = "todos";
    additionKind = "todos";
    input("explorer-search").value = "";
    categorySearch.value = "";
    categoryPicker.removeAttribute("open");
    for (const refinement of refinements) {
      enabled[refinement.key] = false;
      input(refinement.id).checked = false;
    }
  };
  const resetForCase = (): void => {
    resetFilters();
    sort = "reference";
  };
  input("explorer-search").addEventListener("input", () => {
    query = input("explorer-search").value.trim();
    update();
  });
  select("explorer-sort").addEventListener("change", () => {
    const value = select("explorer-sort").value;
    if (value === "reference" || value === "most-differences" || value === "fewest-original-specs" ||
      value === "most-technical-additions" || value === "most-technical-changes") {
      sort = value;
      update();
    }
  });
  select("explorer-spec-kind").addEventListener("change", () => {
    const value = select("explorer-spec-kind").value;
    if (value === "todos" || value === "own" || value === "reused" || value === "pending") {
      additionKind = value;
      update();
    }
  });
  select("explorer-stage").addEventListener("change", () => {
    const value = select("explorer-stage").value;
    if (value === "todos" || value === "commercial" || value === "commercial-excluded" || value === "editorial-excluded") {
      stage = value;
      update();
    }
  });
  for (const refinement of refinements) {
    input(refinement.id).addEventListener("change", () => {
      enabled[refinement.key] = input(refinement.id).checked;
      update();
    });
  }
  categorySearch.addEventListener("input", renderCategories);
  categoryPicker.addEventListener("toggle", () => {
    if (categoryPicker.hasAttribute("open")) {
      renderCategories();
      categorySearch.focus();
    }
  });
  categoryPicker.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && categoryPicker.hasAttribute("open")) {
      event.preventDefault();
      categoryPicker.removeAttribute("open");
      find("explorer-category-summary").focus();
    }
  });
  return { selection, render, resetForCase, updateScope: (next) => {
    scope = next;
    update();
  } };
};
