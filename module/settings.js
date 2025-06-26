import { MultipleChatTabs } from "./multipleChatTabs.js";
import { TabSettings } from "./tabSettings.js";

export function registerSettings() {
  game.settings.registerMenu("multiple-chat-tabs", "tab-settings", {
    name: "MCT.Settings.Menu.Name",
    label: "MCT.Settings.Menu.Label",
    hint: "MCT.Settings.Menu.Hint",
    icon: "fas fa-tasks",
    type: TabSettings,
    restricted: true,
  });

  game.settings.register("multiple-chat-tabs", "tabs", {
    scope: "world",
    config: false,
    type: String,
    default: JSON.stringify([
      { id: `tab-${foundry.utils.randomID(16)}`, label: "Tab1" },
      { id: `tab-${foundry.utils.randomID(16)}`, label: "Tab2" },
      { id: `tab-${foundry.utils.randomID(16)}`, label: "Tab3" },
      { id: `tab-${foundry.utils.randomID(16)}`, label: "Tab4" },
    ]),
    onChange: () => {
      setTimeout(() => {
        if (ui.chat && ui.chat.element) {
          MultipleChatTabs.refreshTabUI(ui.chat.element);
        }
      }, 100);
    },
  });
}
