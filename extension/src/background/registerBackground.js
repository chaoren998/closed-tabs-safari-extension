export const registerBackground = ({ browserApi, controller }) => {
  Promise.resolve(controller.seedSnapshots()).catch((error) => {
    console.error("Failed to seed tab snapshots", error);
  });

  browserApi.tabs.onCreated.addListener((tab) => {
    controller.upsertTabSnapshot(tab);
  });

  browserApi.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
    controller.upsertTabSnapshot({ ...tab, id: tabId });
  });

  browserApi.tabs.onRemoved.addListener(async (tabId) => {
    await controller.recordClosedTab(tabId);
  });

  browserApi.runtime.onMessage.addListener((message) => {
    if (message?.type === "closedTabs:list") {
      return controller.listClosedTabs().then((records) => ({ records }));
    }

    if (message?.type === "closedTabs:reopen") {
      return controller.reopenClosedTab(message.recordId).then(() => ({ ok: true }));
    }

    return undefined;
  });
};
