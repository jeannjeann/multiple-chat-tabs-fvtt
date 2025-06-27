import { MultipleChatTabs } from "./multipleChatTabs.js";
import { TabSettings } from "./tabSettings.js";

export function registerSettings() {
  game.settings.registerMenu("multiple-chat-tabs", "tab-settings", {
    name: "MCT.menu.name",
    label: "MCT.menu.label",
    icon: "fas fa-tasks",
    type: TabSettings,
    restricted: true,
  });

  game.settings.register("multiple-chat-tabs", "display-unread-count", {
    name: "MCT.settings.unreadCount.name",
    hint: "MCT.settings.unreadCount.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      if (ui.chat && ui.chat.element) {
        MultipleChatTabs.refreshTabUI(ui.chat.element);
      }
    },
  });

  game.settings.register("multiple-chat-tabs", "tabs", {
    scope: "world",
    config: false,
    type: String,
    default: JSON.stringify([
      {
        id: `tab-${foundry.utils.randomID(16)}`,
        label: game.i18n.localize("MCT.settings.defaults.main"),
        isDefault: true,
      },
      {
        id: `tab-${foundry.utils.randomID(16)}`,
        label: game.i18n.localize("MCT.settings.defaults.roll"),
        force: {
          roll: "move",
        },
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

  game.settings.register("multiple-chat-tabs", "unreadTabs", {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });
}
