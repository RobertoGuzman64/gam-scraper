export const buildManainListingScript = (maxPages: number, timeoutMs: number, delayMs: number): string => String.raw`
(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const canonical = (href) => {
    try {
      const url = new URL(href, document.location.href);
      if (url.protocol !== 'https:' || !['manain.com', 'www.manain.com'].includes(url.hostname.toLowerCase()) ||
        !/^\/producto\/(?:venta|venda)-[^/]+\/?$/i.test(url.pathname)) return null;
      url.hostname = 'manain.com';
      url.pathname = url.pathname.replace(/\/+$/, '') + '/';
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch { return null; }
  };
  const links = () => [...new Set([...document.querySelectorAll('a[href]')]
    .filter((anchor) => !anchor.closest('header, nav, footer, .breadcrumb, .related, .related-products, .upsells'))
    .map((anchor) => canonical(anchor.href)).filter(Boolean))];
  const label = (element) => [element.textContent, element.getAttribute('aria-label'), element.getAttribute('title')]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const isLoadMore = (element) => /\bcargar\s+m[aá]s\b|\bload\s+more\b|\bcarregar\s+m[eé]s\b/i.test(label(element));
  const controls = () => [...document.querySelectorAll('button, a, [role="button"]')]
    .filter((element) => isLoadMore(element) && !element.closest('header, nav, footer'));
  const isHidden = (element) => !!element.closest('[hidden], [aria-hidden="true"]') ||
    (typeof element.getClientRects === 'function' && element.getClientRects().length === 0);
  const isDisabled = (element) => element.disabled === true || element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true' || element.classList?.contains('disabled');
  const loadControl = () => controls().find((element) => !isHidden(element) && !isDisabled(element)) || null;
  const started = Date.now();
  let previous = '';
  let stable = 0;
  while (Date.now() - started < ${Math.max(timeoutMs, 1000)}) {
    const current = links().join('\n');
    stable = current && current === previous ? stable + 1 : 0;
    previous = current;
    if (stable >= 3) break;
    await wait(250);
  }
  const seen = new Set(links());
  if (!seen.size) throw new Error('Manain: listado sin enlaces de venta; acceso, renderizado o selectores sin verificar');
  let pagesVisited = 1;
  let observedControl = false;
  while (true) {
    const control = loadControl();
    if (!control) {
      await wait(Math.max(2000, ${Math.max(delayMs, 0)}));
      for (const url of links()) seen.add(url);
      if (loadControl()) continue;
      return {
        urls: [...seen], pagesVisited, complete: observedControl,
        endReason: observedControl ? 'control-exhausted' : 'unverified-single-page'
      };
    }
    observedControl = true;
    if (pagesVisited >= ${Math.max(maxPages, 1)}) {
      return { urls: [...seen], pagesVisited, complete: false, endReason: 'page-limit' };
    }
    control.click();
    const clickedAt = Date.now();
    let next = [];
    while (Date.now() - clickedAt < ${Math.max(timeoutMs, 1000)}) {
      await wait(250);
      next = links().filter((url) => !seen.has(url));
      if (next.length) break;
    }
    if (!next.length) throw new Error('Manain: Cargar más no incorporó fichas nuevas; paginación no confirmada');
    for (const url of next) seen.add(url);
    pagesVisited += 1;
    await wait(${Math.max(delayMs, 0)});
  }
})()`;
