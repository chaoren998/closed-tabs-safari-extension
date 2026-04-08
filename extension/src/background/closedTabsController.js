import {
  insertClosedTabRecord,
  isRecordableUrl,
  removeClosedTabRecord,
} from "../shared/closedTabsStore.js";

const STORAGE_KEY = "closedTabs";

export const createClosedTabsController = ({
  browserApi,
  now = () => Date.now(),
  createId = () => crypto.randomUUID(),
}) => {
  const snapshots = new Map();

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

  const listClosedTabs = async () => {
    const stored = await browserApi.storage.local.get(STORAGE_KEY);
    return stored[STORAGE_KEY] ?? [];
  };

  const writeClosedTabs = async (records) => {
    await browserApi.storage.local.set({ [STORAGE_KEY]: records });
  };

  const recordClosedTab = async (tabId) => {
    const snapshot = snapshots.get(tabId);
    snapshots.delete(tabId);

    if (!snapshot || snapshot.incognito || !isRecordableUrl(snapshot.url)) {
      return;
    }

    const nextRecord = {
      id: createId(),
      sourceTabId: snapshot.tabId,
      sourceWindowId: snapshot.windowId,
      url: snapshot.url,
      title: snapshot.title,
      favIconUrl: snapshot.favIconUrl,
      closedAt: now(),
    };
    const records = await listClosedTabs();
    await writeClosedTabs(insertClosedTabRecord(records, nextRecord));
  };

  const reopenClosedTab = async (recordId) => {
    const records = await listClosedTabs();
    const record = records.find((item) => item.id === recordId);

    if (!record) {
      throw new Error(`Closed-tab record not found: ${recordId}`);
    }

    await browserApi.tabs.create({ url: record.url, active: true });
    await writeClosedTabs(removeClosedTabRecord(records, recordId));
  };

  return {
    seedSnapshots,
    listClosedTabs,
    upsertTabSnapshot,
    recordClosedTab,
    reopenClosedTab,
  };
};
