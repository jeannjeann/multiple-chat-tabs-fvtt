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

  game.settings.register("multiple-chat-tabs", "autoWhisperTab", {
    name: "MCT.settings.autoWhisperTab.name",
    hint: "MCT.settings.autoWhisperTab.hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Boolean,
    default: true,
  });

  game.settings.register("multiple-chat-tabs", "showAloneMessageToDefaultTab", {
    name: "MCT.settings.showAloneMessageToDefaultTab.name",
    hint: "MCT.settings.showAloneMessageToDefaultTab.hint",
    scope: "world",
    config: true,
    restricted: true,
    type: Boolean,
    default: false,
    onChange: () => {
      MultipleChatTabs.oldestMessage = {};
      MultipleChatTabs.oldestLoadMessage = {};
      if (ui.chat && ui.chat.element) {
        MultipleChatTabs.refreshTabUI(ui.chat.element);
      }
    },
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

  game.settings.register("multiple-chat-tabs", "auto-load-messages", {
    name: "MCT.settings.autoLoad.name",
    hint: "MCT.settings.autoLoad.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  });

  game.settings.register("multiple-chat-tabs", "load-batch-size", {
    name: "MCT.settings.loadBatchSize.name",
    hint: "MCT.settings.loadBatchSize.hint",
    scope: "client",
    config: true,
    type: Number,
    range: {
      min: 10,
      max: 500,
      step: 10,
    },
    default: 100,
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
        showAllMessages: false,
        forceOOC: false,
        force: {
          ic: "none",
          ooc: "none",
          roll: "none",
          other: "none",
        },
        isWhisperTab: false,
        whisperTargets: [],
      },
      {
        id: `tab-${foundry.utils.randomID(16)}`,
        label: game.i18n.localize("MCT.settings.defaults.roll"),
        isDefault: false,
        showAllMessages: false,
        forceOOC: false,
        force: {
          ic: "none",
          ooc: "none",
          roll: "move",
          other: "none",
        },
        isWhisperTab: false,
        whisperTargets: [],
      },
      {
        id: `tab-${foundry.utils.randomID(16)}`,
        label: game.i18n.localize("MCT.settings.defaults.sub"),
        isDefault: false,
        showAllMessages: false,
        forceOOC: true,
        force: {
          ic: "none",
          ooc: "none",
          roll: "none",
          other: "none",
        },
        isWhisperTab: false,
        whisperTargets: [],
      },
    ]),
    onChange: () => {
      MultipleChatTabs.oldestMessage = {};
      MultipleChatTabs.oldestLoadMessage = {};
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
