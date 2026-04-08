import { renderClosedTabsList } from "./renderClosedTabsList.js";

const listNode = document.querySelector("[data-closed-tabs-list]");
const statusNode = document.querySelector("[data-popup-status]");

const setStatus = (message = "") => {
  statusNode.textContent = message;
};

const parseListResponse = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.records)) {
    return response.records;
  }

  return [];
};

const loadRecords = async () => {
  try {
    const response = await browser.runtime.sendMessage({ type: "closedTabs:list" });
    const records = parseListResponse(response);
    listNode.innerHTML = renderClosedTabsList(records);
    setStatus("");
  } catch {
    listNode.innerHTML = renderClosedTabsList([]);
    setStatus("Could not load recently closed tabs.");
  }
};

listNode.addEventListener("click", async (event) => {
  const row = event.target.closest("[data-record-id]");
  if (!row) {
    return;
  }

  try {
    await browser.runtime.sendMessage({
      type: "closedTabs:reopen",
      recordId: row.dataset.recordId,
    });
    await loadRecords();
  } catch {
    setStatus("Could not reopen the selected tab.");
  }
});

loadRecords();
