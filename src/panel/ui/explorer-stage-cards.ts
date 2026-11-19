import type { PanelExplorerProduct, PanelProductView } from "../explorer/types.js";

type RecordStage = keyof Pick<PanelExplorerProduct, "original" | "published" | "commercial">;

const stageLabels: Readonly<Record<RecordStage, string>> = {
  original: "01 · ORIGINAL",
  published: "02 · FINISH",
  commercial: "03 · COMERCIAL"
};

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", label?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (label !== undefined) node.textContent = label;
  return node;
};

const safeImageUrl = (value: string): boolean => {
  try { return ["https:", "http:"].includes(new URL(value).protocol); }
  catch { return false; }
};

const display = (value: string | number | boolean | null): string =>
  value === null || value === "" ? "No consta" : String(value);

const imageUrls = (record: PanelProductView): readonly string[] =>
  [...new Set([record.image, ...record.images].filter((url): url is string =>
    typeof url === "string" && safeImageUrl(url)))];

const photograph = (record: PanelProductView): HTMLElement => {
  const frame = element("div", "stage-record-image");
  const url = imageUrls(record)[0];
  if (!url) {
    frame.append(element("span", "record-photo-empty", "Sin fotografía disponible"));
    return frame;
  }
  const image = element("img");
  image.src = url;
  image.alt = `Fotografía declarada de ${record.title ?? "la máquina"}`;
  image.loading = "lazy";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => {
    frame.replaceChildren(element("span", "record-photo-empty", "Imagen externa no disponible"));
  });
  frame.append(image);
  return frame;
};

const button = (label: string, className: string, onClick: () => void): HTMLButtonElement => {
  const node = element("button", className, label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
};

const stat = (label: string, value: string): HTMLElement => {
  const row = element("div", "stage-record-stat");
  row.append(element("span", "", label), element("strong", "", value));
  return row;
};

const gallery = (record: PanelProductView, stage: RecordStage): HTMLElement => {
  const root = element("section", "equipzilla-gallery stage-viewer-section");
  root.setAttribute("aria-label", `Fotografías de ${stageLabels[stage]}`);
  const sources = imageUrls(record);
  const frame = element("div", "equipzilla-gallery-frame");
  root.append(frame);
  if (!sources.length) {
    frame.append(element("div", "equipzilla-gallery-empty", "Sin fotografías disponibles en esta etapa"));
    return root;
  }
  const counter = element("span", "equipzilla-gallery-counter");
  const thumbnails = element("div", "equipzilla-gallery-thumbnails");
  const selectors: HTMLButtonElement[] = [];
  let currentIndex = 0;
  const show = (index: number): void => {
    currentIndex = (index + sources.length) % sources.length;
    const placeholder = element("div", "equipzilla-gallery-empty", "Cargando fotografía externa…");
    frame.replaceChildren(placeholder);
    const photo = element("img", "equipzilla-gallery-main-image");
    photo.alt = `Fotografía ${currentIndex + 1} de ${sources.length} · ${display(record.title)}`;
    photo.referrerPolicy = "no-referrer";
    photo.addEventListener("load", () => {
      if (frame.contains(placeholder)) frame.replaceChildren(photo);
    });
    photo.addEventListener("error", () => {
      if (frame.contains(placeholder)) placeholder.textContent = "Imagen externa no disponible";
    });
    photo.src = sources[currentIndex] ?? "";
    counter.textContent = `${currentIndex + 1} / ${sources.length}`;
    selectors.forEach((selector, position) => {
      selector.setAttribute("aria-pressed", String(position === currentIndex));
    });
  };
  if (sources.length > 1) {
    const controls = element("div", "equipzilla-gallery-controls");
    const previous = button("‹", "equipzilla-gallery-arrow", () => show(currentIndex - 1));
    const next = button("›", "equipzilla-gallery-arrow", () => show(currentIndex + 1));
    previous.setAttribute("aria-label", "Fotografía anterior");
    next.setAttribute("aria-label", "Fotografía siguiente");
    controls.append(previous, counter, next);
    root.append(controls);
    thumbnails.setAttribute("aria-label", "Seleccionar fotografía");
    for (const [index, url] of sources.entries()) {
      const selectPhoto = button("", "equipzilla-gallery-thumbnail", () => show(index));
      selectPhoto.setAttribute("aria-label", `Mostrar fotografía ${index + 1}`);
      const image = element("img");
      image.src = url;
      image.alt = "";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => {
        selectPhoto.replaceChildren(element("span", "", String(index + 1)));
      });
      selectPhoto.append(image);
      selectors.push(selectPhoto);
      thumbnails.append(selectPhoto);
    }
    root.append(thumbnails);
    root.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      show(currentIndex + (event.key === "ArrowRight" ? 1 : -1));
      selectors[currentIndex]?.focus({ preventScroll: true });
    });
  }
  show(0);
  return root;
};

const facts = (record: PanelProductView, stage: RecordStage, item: PanelExplorerProduct): HTMLElement => {
  const info = element("div", "equipzilla-facts");
  info.append(stat("Especificaciones", String(Object.keys(record.specs).length)));
  if (imageUrls(record).length) info.append(stat("Fotografías", String(imageUrls(record).length)));
  if (stage === "commercial" && item.commercial) {
    if (item.commercial.categorySellID !== null) info.append(stat("Categoría comercial (ID)", String(item.commercial.categorySellID)));
    if (item.commercial.attributes.length) info.append(stat("Atributos aceptados", String(item.commercial.attributes.length)));
  }
  return info;
};

const summary = (record: PanelProductView): HTMLElement | null => {
  const description = record.shortDescription;
  if (!description) return null;
  const container = element("div", "equipzilla-summary");
  container.append(element("h3", "", "Descripción corta"), element("p", "equipzilla-summary-text", description));
  return container;
};

const technicalDetails = (record: PanelProductView): HTMLElement => {
  const section = element("section", "equipzilla-technical stage-viewer-section");
  section.append(element("h3", "equipzilla-section-title", "Ficha técnica"));
  const entries = Object.entries(record.specs);
  if (!entries.length) {
    section.append(element("p", "equipzilla-empty-text", "No constan especificaciones técnicas en esta etapa"));
    return section;
  }
  const list = element("dl", "equipzilla-spec-grid");
  for (const [key, value] of entries) {
    const item = element("div", "equipzilla-spec-item");
    item.append(element("dt", "", key), element("dd", "", Array.isArray(value) ? value.join(" · ") : String(value)));
    list.append(item);
  }
  section.append(list);
  return section;
};

const additionalDetails = (record: PanelProductView, stage: RecordStage, item: PanelExplorerProduct): HTMLElement | null => {
  if (!record.generalDescription && !(stage === "commercial" && item.commercial?.attributes.length)) return null;
  const section = element("section", "equipzilla-additional stage-viewer-section");
  if (record.generalDescription) {
    const description = element("section", "equipzilla-general-description");
    description.append(element("h3", "equipzilla-section-title", "Descripción general"),
      element("p", "equipzilla-general-text", record.generalDescription));
    section.append(description);
  }
  if (stage === "commercial" && item.commercial && item.commercial.attributes.length) {
    const attributes = element("section", "equipzilla-commercial-attributes");
    attributes.append(element("h3", "equipzilla-section-title", "Atributos comerciales"));
    const list = element("dl", "equipzilla-spec-grid equipzilla-attributes-grid");
    for (const attribute of item.commercial.attributes) {
      const entry = element("div", "equipzilla-spec-item");
      entry.append(element("dt", "", `ID de atributo ${attribute.attributeID}`), element("dd", "", String(attribute.value)));
      list.append(entry);
    }
    attributes.append(list);
    section.append(attributes);
  }
  return section;
};

const recordDetails = (record: PanelProductView, stage: RecordStage, item: PanelExplorerProduct): HTMLElement => {
  const content = element("div", "stage-viewer-content equipzilla-product-view");
  const header = element("section", "equipzilla-product-info stage-viewer-section");
  header.append(element("span", "equipzilla-product-eyebrow", "FICHA DEL CORTE · " + stageLabels[stage]));
  header.append(element("h2", "equipzilla-product-title", display(record.title)));
  if (record.category) header.append(element("p", "equipzilla-product-category", record.category));
  if (record.price !== null) header.append(element("div", "equipzilla-product-price", display(record.price)));
  const description = summary(record);
  if (description) header.append(description);
  header.append(facts(record, stage, item));
  const main = element("div", "equipzilla-product-top");
  main.append(header, gallery(record, stage));
  content.append(main, technicalDetails(record));
  const additional = additionalDetails(record, stage, item);
  if (additional) content.append(additional);
  return content;
};

const openStage = (item: PanelExplorerProduct, stage: RecordStage, trigger: HTMLButtonElement, host: HTMLElement): void => {
  const record = item[stage];
  if (!record) return;
  const dialog = element("dialog", "stage-record-viewer equipzilla-stage-dialog");
  dialog.setAttribute("aria-labelledby", "equipzilla-stage-heading");
  const header = element("header", "stage-viewer-top");
  const heading = element("strong", "", stageLabels[stage]);
  heading.id = "equipzilla-stage-heading";
  const close = button("Cerrar ×", "stage-viewer-close", () => dialog.close());
  header.append(heading, close);
  dialog.append(header, recordDetails(record, stage, item));
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (trigger.isConnected) trigger.focus({ preventScroll: true });
  }, { once: true });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  host.append(dialog);
  dialog.showModal();
  dialog.scrollTop = 0;
  close.focus();
};

export const renderStageCards = (item: PanelExplorerProduct): HTMLElement => {
  const section = element("section", "stage-record-section");
  const grid = element("div", "stage-record-grid");
  for (const stage of ["original", "published", "commercial"] as const) {
    const record = item[stage];
    const card = element("article", `stage-record-card stage-record-${stage}${record ? "" : " stage-record-absent"}`);
    card.append(element("span", "stage-record-label", stageLabels[stage]));
    if (!record) {
      card.append(element("div", "stage-record-placeholder", stage === "original" ?
        "Original no disponible" : stage === "published" ? "No publicada en FINISH" : "Sin salida comercial"));
      card.append(element("p", "stage-record-unavailable", "Etapa no disponible en este expediente"));
    } else {
      card.append(photograph(record));
      const title = element("h4", "stage-record-title", display(record.title));
      title.title = display(record.title);
      card.append(title);
      const stats = element("div", "stage-record-stats");
      stats.append(stat("Especificaciones", String(Object.keys(record.specs).length)));
      if (stage === "commercial" && item.commercial) {
        stats.append(stat("Atributos", String(item.commercial.attributes.length)));
        if (item.commercial.categorySellID !== null) stats.append(stat("Categoría comercial", String(item.commercial.categorySellID)));
      } else if (record.price !== null) {
        stats.append(stat("Precio", String(record.price)));
      } else if (record.category) {
        stats.append(stat("Categoría", record.category));
      }
      card.append(stats);
      const expand = button("Ampliar ficha", "stage-record-expand", () => openStage(item, stage, expand, section));
      expand.setAttribute("aria-label", `Ampliar ${stageLabels[stage]}`);
      card.append(expand);
    }
    grid.append(card);
  }
  section.append(grid);
  return section;
};
