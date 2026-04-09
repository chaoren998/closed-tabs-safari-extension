import {
  insertClosedTabRecord,
  isRecordableUrl,
  removeClosedTabRecord,
} from "../shared/closedTabsStore.js";

const STORAGE_KEY = "closedTabs";

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const defaultCreateId = () => {
  const cryptoObj = globalThis?.crypto;
  if (typeof cryptoObj?.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }

  // Small, robust fallback for environments without crypto.randomUUID().
  // Prefer getRandomValues when available, otherwise fall back to Math.random().
  if (typeof cryptoObj?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `ct_${hex}`;
  }

  return `ct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const sanitizeClosedTabRecords = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const sanitized = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const { id, url, closedAt } = item;
    if (typeof id !== "string") {
      continue;
    }
    if (typeof url !== "string" || !isRecordableUrl(url)) {
      continue;
    }
    if (!isFiniteNumber(closedAt)) {
      continue;
    }

    const next = { id, url, closedAt };
    if (typeof item.title === "string") {
      next.title = item.title;
    }
    if (typeof item.favIconUrl === "string") {
      next.favIconUrl = item.favIconUrl;
    }
    if (isFiniteNumber(item.sourceTabId)) {
      next.sourceTabId = item.sourceTabId;
    }
    if (isFiniteNumber(item.sourceWindowId)) {
      next.sourceWindowId = item.sourceWindowId;
    }

    sanitized.push(next);
  }

  return sanitized;
};

export const createClosedTabsController = ({
  browserApi,
  now = () => Date.now(),
  createId = defaultCreateId,
}) => {
  const snapshots = new Map();
  let storageMutationQueue = Promise.resolve();

  const upsertTabSnapshot = (tab) => {
    const tabId = tab?.id;
    if (tabId === undefined || tabId === null) {
      return;
    }

    if (tab?.incognito || !isRecordableUrl(tab?.url)) {
      snapshots.delete(tabId);
      return;
    }

    const parsedUrl = new URL(tab.url);
    snapshots.set(tabId, {
      tabId,
      windowId: tab.windowId,
      url: tab.url,
      title: tab.title || parsedUrl.hostname,
      favIconUrl: tab.favIconUrl || "",
      incognito: Boolean(tab.incognito),
    });
  };

  const seedSnapshots = async () => {
    const tabs = await browserApi.tabs.query({});
    for (const tab of tabs) {
      upsertTabSnapshot(tab);
    }
  };

  const readClosedTabs = async () => {
    const stored = await browserApi.storage.local.get(STORAGE_KEY);
    return sanitizeClosedTabRecords(stored[STORAGE_KEY]);
  };

  const listClosedTabs = async () => {
    await storageMutationQueue.catch(() => {});
    return readClosedTabs();
  };

  const writeClosedTabs = async (records) => {
    await browserApi.storage.local.set({ [STORAGE_KEY]: records });
  };

  const runStorageMutation = async (operation) => {
    const task = storageMutationQueue.then(async () => operation(await readClosedTabs()));
    storageMutationQueue = task.catch(() => {});
    return task;
  };

  const recordClosedTab = async (tabId) => {
    const snapshot = snapshots.get(tabId);
    snapshots.delete(tabId);

    if (!snapshot || snapshot.incognito || !isRecordableUrl(snapshot.url)) {
      return;
    }

    await runStorageMutation(async (records) => {
      const nextRecord = {
        id: createId(),
        sourceTabId: snapshot.tabId,
        sourceWindowId: snapshot.windowId,
        url: snapshot.url,
        title: snapshot.title,
        favIconUrl: snapshot.favIconUrl,
        closedAt: now(),
      };

      await writeClosedTabs(insertClosedTabRecord(records, nextRecord));
    });
  };

  const reopenClosedTab = async (recordId) => {
    await runStorageMutation(async (records) => {
      const record = records.find((item) => item.id === recordId);

      if (!record) {
        throw new Error(`Closed-tab record not found: ${recordId}`);
      }

      await browserApi.tabs.create({ url: record.url, active: true });
      await writeClosedTabs(removeClosedTabRecord(records, recordId));
    });
  };

  return {
    seedSnapshots,
    listClosedTabs,
    upsertTabSnapshot,
    recordClosedTab,
    reopenClosedTab,
  };
};
