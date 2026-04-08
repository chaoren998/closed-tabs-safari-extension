export const CLOSED_TABS_LIMIT = 20;

const recordableProtocols = new Set(["http:", "https:"]);

export const isRecordableUrl = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const parsed = new URL(value);
    return recordableProtocols.has(parsed.protocol);
  } catch {
    return false;
  }
};

const ensureRecordableUrl = (record) => {
  if (!isRecordableUrl(record?.url)) {
    throw new TypeError("Closed-tab records require a recordable URL");
  }
};

export const insertClosedTabRecord = (existingRecords, nextRecord) => {
  ensureRecordableUrl(nextRecord);

  const normalizedRecords = [nextRecord, ...(existingRecords ?? [])];
  normalizedRecords.sort((a, b) => b.closedAt - a.closedAt);

  return normalizedRecords.slice(0, CLOSED_TABS_LIMIT);
};

export const removeClosedTabRecord = (existingRecords, recordId) =>
  existingRecords.filter((record) => record.id !== recordId);
