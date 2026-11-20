export const find = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Falta control del panel: ${id}`);
  return node;
};
export const create = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", value?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
};
export const append = (parent: HTMLElement, ...nodes: (Node | string)[]): void => parent.append(...nodes);
export const text = (value: string | number | boolean | null): string => value === null || value === "" ? "No consta" : String(value);
export const verifiedUrl = (value: string): boolean => {
  try { return ["https:", "http:"].includes(new URL(value).protocol); }
  catch { return false; }
};
export const linkTo = (href: string, label: string): HTMLAnchorElement => {
  const anchor = create("a", "explorer-link", label);
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
};
export const newButton = (label: string, fn: () => void, className = ""): HTMLButtonElement => {
  const node = create("button", className, label);
  node.type = "button";
  node.addEventListener("click", fn);
  return node;
};
