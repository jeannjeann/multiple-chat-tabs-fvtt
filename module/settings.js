import { MultipleChatTabs } from "./multipleChatTabs.js";
import { TabSettings } from "./tabSettings.js";

export function registerSettings() {
  game.settings.registerMenu("multiple-chat-tabs", "tab-settings", {
    name: "MCT.menu.name",
    label: "MCT.menu.label",
    hint: "MCT.menu.hint",
    icon: "fas fa-tasks",
    type: TabSettings,
    restricted: true,
  });

  game.settings.register("multiple-chat-tabs", "tabs", {
    scope: "world",
    config: false,
    type: String,
    default: JSON.stringify([
      {
        id: `tab-${foundry.utils.randomID(16)}`,
        label: game.i18n.localize("MCT.settings.defaults.main"),
      },
      {
        id: `tab-${foundry.utils.randomID(16)}`,
        label: game.i18n.localize("MCT.settings.defaults.roll"),
      },
      {
        id: `tab-${foundry.utils.randomID(16)}`,
        label: game.i18n.localize("MCT.settings.defaults.sub"),
      },
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
