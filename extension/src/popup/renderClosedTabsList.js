import { formatRelativeTime } from "../shared/relativeTime.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getHostname = (value) => {
  try {
    return new URL(value).hostname || "site";
  } catch {
    return "site";
  }
};

const getFallbackLetter = (hostname) => (hostname[0] ?? "S").toUpperCase();

export const renderClosedTabsList = (records, { now = Date.now() } = {}) => {
  if (!records?.length) {
    return `<p class="closed-tabs-empty">No recently closed tabs yet</p>`;
  }

  return records.map((record) => {
    const hostname = getHostname(record?.url);
    const title = record?.title?.trim() || hostname;
    const metaText = record?.url?.trim() || hostname;
    const faviconUrl = typeof record?.favIconUrl === "string" ? record.favIconUrl : "";
    const relativeTime = formatRelativeTime(now, record?.closedAt ?? now);
    const faviconMarkup = faviconUrl
      ? `<img class="closed-tabs-row__favicon" src="${escapeHtml(faviconUrl)}" alt="">`
      : `<span class="closed-tabs-row__favicon-fallback">${escapeHtml(getFallbackLetter(hostname))}</span>`;

    return `
      <button class="closed-tabs-row" data-record-id="${escapeHtml(record?.id)}" type="button">
        <span class="closed-tabs-row__icon">${faviconMarkup}</span>
        <span class="closed-tabs-row__content">
          <span class="closed-tabs-row__title">${escapeHtml(title)}</span>
          <span class="closed-tabs-row__meta">${escapeHtml(metaText)}</span>
        </span>
        <span class="closed-tabs-row__time">${escapeHtml(relativeTime)}</span>
      </button>
    `;
  }).join("");
};
