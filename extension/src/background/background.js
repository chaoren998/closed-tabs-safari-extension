import { createClosedTabsController } from "./closedTabsController.js";
import { registerBackground } from "./registerBackground.js";

const controller = createClosedTabsController({ browserApi: browser });

registerBackground({ browserApi: browser, controller });
