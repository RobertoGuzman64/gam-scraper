export type InventoryState = "correcto" | "parcial" | "ausente" | "error";

export type InventoryItem = {
  readonly state: InventoryState;
  readonly detail: string;
};

