export type CategoryProgress = {
  readonly categoryName: string;
  readonly position: number;
  readonly count: number;
  readonly phase: "listing" | "products";
  readonly pagesScanned: number;
  readonly listingStage?: string;
  readonly found: number;
  readonly processed: number;
  readonly totalProducts: number;
  readonly elapsedSeconds: number;
  readonly idleSeconds: number;
};

export type ScrapeEvent =
  | { readonly type: "stage"; readonly stage: string; readonly resource?: string }
  | { readonly type: "progress"; readonly progress: CategoryProgress }
  | { readonly type: "failure"; readonly stage: string; readonly resource: string; readonly reason: string };

export type ScrapeMessage = { readonly channel: "equipzilla:scrape"; readonly event: ScrapeEvent };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const isScrapeMessage = (value: unknown): value is ScrapeMessage => {
  if (!isRecord(value) || value.channel !== "equipzilla:scrape" || !isRecord(value.event)) return false;
  const event = value.event;
  if (event.type === "stage") return typeof event.stage === "string" &&
    (event.resource === undefined || typeof event.resource === "string");
  if (event.type === "failure") return typeof event.stage === "string" &&
    typeof event.resource === "string" && typeof event.reason === "string";
  if (event.type !== "progress" || !isRecord(event.progress)) return false;
  const p = event.progress;
  return typeof p.categoryName === "string" && typeof p.position === "number" &&
    typeof p.count === "number" && (p.phase === "listing" || p.phase === "products") &&
    typeof p.pagesScanned === "number" &&
    (p.listingStage === undefined || typeof p.listingStage === "string") &&
    typeof p.found === "number" && typeof p.processed === "number" &&
    typeof p.totalProducts === "number" && typeof p.elapsedSeconds === "number" &&
    typeof p.idleSeconds === "number";
};
