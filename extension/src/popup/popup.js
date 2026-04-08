import { renderClosedTabsList } from "./renderClosedTabsList.js";

const listNode = document.querySelector("[data-closed-tabs-list]");
const statusNode = document.querySelector("[data-popup-status]");

const loadClosedTabs = async () => {
  try {
    const response = await browser.runtime.sendMessage({ type: "closedTabs:list" });
    listNode.innerHTML = renderClosedTabsList(response.records);
    statusNode.hidden = true;
  } catch (error) {
    listNode.innerHTML = renderClosedTabsList([]);
    statusNode.hidden = false;
    statusNode.textContent = error.message;
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
    statusNode.hidden = true;
    await loadClosedTabs();
  } catch (error) {
    statusNode.hidden = false;
    statusNode.textContent = error.message;
  }
});

document.addEventListener("DOMContentLoaded", loadClosedTabs);
