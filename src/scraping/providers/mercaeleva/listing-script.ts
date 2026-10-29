export const buildMercaelevaCatalogScript = (maxPages: number, timeoutMs: number, delayMs: number): string => String.raw`
(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const deadline = async (condition, detail, timeout = ${timeoutMs}) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = condition();
      if (result) return result;
      await wait(200);
    }
    throw new Error('Mercaeleva: tiempo agotado al esperar ' + detail);
  };
  const links = () => [...new Set([...document.querySelectorAll('a[href]')]
    .map((anchor) => {
      try {
        const url = new URL(anchor.href);
        if (url.hostname !== 'sales.mercaeleva.com' || !/^\/(?:es|en|ca)\/for-sale\/machine\/[^/]+\/?$/i.test(url.pathname)) return null;
        url.search = '';
        url.hash = '';
        url.pathname = url.pathname.replace(/\/$/, '');
        return url.toString();
      } catch {
        return null;
      }
    })
    .filter(Boolean))];
  const readTotal = () => {
    const match = document.body?.innerText.match(/(?:Resultados?|Resultats?|Results?)\s*:\s*(\d[\d.,]*)/i);
    const value = match ? Number(match[1].replace(/[^\d]/g, '')) : 0;
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  };
  const settledLinks = async (detail, seen) => {
    let previous = '';
    let stable = 0;
    return deadline(() => {
      const current = links();
      if (!current.length || (seen && !current.some((href) => !seen.has(href)))) {
        stable = 0;
        previous = '';
        return null;
      }
      const fingerprint = [...current].sort().join('\n');
      stable = fingerprint === previous ? stable + 1 : 0;
      previous = fingerprint;
      return stable >= 2 ? current : null;
    }, detail);
  };
  const controlLabel = (element) => [
    element.getAttribute('aria-label'), element.getAttribute('title'),
    element.textContent,
    ...[...element.querySelectorAll('[aria-label], [title], svg title')].map((child) =>
      child.getAttribute('aria-label') || child.getAttribute('title') || child.textContent)
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const controls = () => [...document.querySelectorAll('button, [role="button"]')];
  const disabled = (element) => element.disabled || element.getAttribute('disabled') !== null ||
    element.getAttribute('aria-disabled') === 'true' ||
    !!element.closest?.('[hidden], [aria-hidden="true"]') ||
    (element.getClientRects && element.getClientRects().length === 0);
  const numberedControl = (page) => controls().find((element) =>
    (element.textContent || '').trim() === String(page) && !disabled(element)) || null;
  const nextControl = (page) => {
    const available = controls();
    const numbered = available.filter((element) => /^\d{1,3}$/.test((element.textContent || '').trim()));
    if (numbered.some((element) => element.textContent.trim() === String(page))) {
      const next = numberedControl(page + 1);
      if (next) return next;
    }
    return available.find((element) => !disabled(element) &&
      /(?:next(?:\s+\w+){0,2}\s+page|next|siguiente|següent|seguent|próxima|proxima)/i.test(controlLabel(element))) || null;
  };
  const largerPageSize = async (currentSize) => {
    const label = /(?:elementos|resultados) por p[aá]gina|items? per page|results? per page|elements? per page/i;
    const named = (element) => controlLabel(element) + ' ' +
      (element.getAttribute('placeholder') || '') + ' ' +
      (element.closest?.('label')?.textContent || '') + ' ' +
      (element.parentElement?.textContent?.slice(0, 100) || '') + ' ' +
      (element.id ? document.querySelector('label[for="' + element.id + '"]')?.textContent || '' : '');
    const candidates = [...document.querySelectorAll('select, [role="combobox"], button[aria-haspopup="listbox"]')];
    const nativeSize = (element) => element.tagName?.toLowerCase() === 'select' &&
      [...element.options].some((option) => Number((option.textContent || '').trim()) === currentSize);
    const candidate = candidates.find((element) => !disabled(element) &&
      (label.test(named(element)) || nativeSize(element)));
    if (!candidate) return false;
    const choose = (elements) => elements.map((element) => ({
      element, count: Number((element.textContent || '').trim()), value: element.value
    })).filter((option) => Number.isSafeInteger(option.count) && option.count > currentSize && option.count <= 100)
      .sort((a, b) => b.count - a.count)[0];
    if (candidate.tagName?.toLowerCase() === 'select') {
      const option = choose([...candidate.options]);
      if (!option) return false;
      candidate.value = option.value;
      candidate.dispatchEvent(new Event('input', { bubbles: true }));
      candidate.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      candidate.click();
      const option = await deadline(() => choose([...document.querySelectorAll('[role="option"]')]),
        'las opciones de elementos por página', 2000).catch(() => null);
      if (!option) {
        candidate.click();
        return false;
      }
      option.element.click();
    }
    return !!await deadline(() => links().length > currentSize && links(),
      'más referencias tras cambiar elementos por página', 3000).catch(() => null);
  };
  const nextPage = async (page, count, total) => {
    const started = Date.now();
    const timeout = Math.min(${timeoutMs}, 8000);
    while (Date.now() - started < timeout) {
      const button = nextControl(page);
      if (button) return button;
      await wait(200);
    }
    const available = controls().slice(-16).map((element) =>
      controlLabel(element).slice(0, 80) + (disabled(element) ? ' [deshabilitado]' : '')).join(' | ');
    throw new Error('Mercaeleva: no hay página siguiente tras la página ' + page +
      ' (' + count + '/' + total + '); ready=' + document.readyState +
      '; botones=' + (available || 'ninguno'));
  };
  const total = await deadline(readTotal, 'el contador total de resultados');
  const pages = [];
  const seen = new Set();
  let current = await settledLinks('los productos de la primera página', null);
  const initialSize = current.length;
  if (total > initialSize && await largerPageSize(initialSize)) {
    current = await settledLinks('el nuevo tamaño de la primera página', null);
  }
  const pageSize = current.length;
  const firstPage = [...current].sort().join('\n');
  for (let page = 1; page <= ${maxPages}; page += 1) {
    const reportedTotal = readTotal();
    if (reportedTotal !== null && reportedTotal !== total) {
      throw new Error('Mercaeleva: el contador cambió durante la extracción (' + total + ' / ' + reportedTotal + ')');
    }
    pages.push(document.documentElement.outerHTML);
    for (const href of current) seen.add(href);
    console.debug("__EQUIPZILLA_MERCA_PROGRESS__", pages.length, seen.size);
    if (seen.size >= total || page === ${maxPages}) break;
    const next = await nextPage(page, seen.size, total);
    next.click();
    try {
      current = await settledLinks('referencias nuevas después de la página ' + page + ' (' + seen.size + '/' + total + ')', seen);
    } catch (error) {
      const remaining = total - seen.size;
      const lastPage = Math.ceil(total / pageSize);
      if (remaining > pageSize || page + 1 !== lastPage || !numberedControl(1)) throw error;
      const first = numberedControl(1);
      first.click();
      try {
        await deadline(() => {
          const candidate = links();
          return [...candidate].sort().join('\n') === firstPage ? candidate : null;
        }, 'volver a la primera página para recuperar la última');
        const last = numberedControl(lastPage);
        if (!last) throw new Error('no existe un botón habilitado para la página ' + lastPage);
        last.click();
        current = await settledLinks('las ' + remaining + ' referencias pendientes en la página ' + lastPage, seen);
      } catch (recoveryError) {
        throw new Error('Mercaeleva: navegación a la página ' + (page + 1) + ' sin referencias nuevas: ' +
          String(error) + '; reintento directo desde la primera página: ' + String(recoveryError));
      }
    }
    if (${delayMs} > 0) await wait(${delayMs});
  }
  return { pages, expectedTotal: total };
})()
`;

export const buildMercaelevaReadinessScript = (): string => String.raw`(() => ({
  href: location.href,
  ready: document.readyState,
  title: document.title,
  count: (document.body?.innerText ?? '').match(/(?:Resultados?|Resultats?|Results?)\s*:\s*(\d[\d.,]*)/i)?.[1] ?? null,
  links: document.querySelectorAll('a[href*="/for-sale/machine/"]').length
}))()`;

