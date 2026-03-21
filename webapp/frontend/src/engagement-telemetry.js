export function classifyScanSource({
  agentInvoked = false,
  autoPath = false,
  autoQuery = false,
  hasPriorScan = false,
} = {}) {
  if (agentInvoked) {
    return 'webmcp_form';
  }

  if (autoPath) {
    return 'path_autoscan';
  }

  if (autoQuery) {
    return 'query_autoscan';
  }

  if (hasPriorScan) {
    return 'rescan_form';
  }

  return 'landing_form';
}

export function normalizeTelemetryText(value = '') {
  return String(value).trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function getTrackedLinkTelemetry(link, { origin, pathname } = {}) {
  if (!link?.href) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(link.href, origin);
  } catch {
    return null;
  }

  if (!origin || parsed.origin === origin) {
    return null;
  }

  const source = link.dataset.ctaSource || link.dataset.docLinkSource || '';
  const ctaName = link.dataset.ctaName || '';
  const docKind = link.dataset.docLinkKind || '';

  if (!source && !ctaName && !docKind) {
    return null;
  }

  return {
    href: parsed.href,
    host: parsed.hostname,
    source,
    ctaName,
    ctaType: link.dataset.ctaType || '',
    docKind,
    assistantName: link.dataset.assistantName || '',
    primitiveName: link.dataset.primitiveName || '',
    pagePath: pathname || '/',
    linkText: normalizeTelemetryText(link.textContent),
  };
}