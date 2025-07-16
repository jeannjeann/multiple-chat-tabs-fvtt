import { MultipleChatTabs } from "./multipleChatTabs.js";
import { TabSettings } from "./tabSettings.js";

export function registerSettings() {
  // Settings Menu
  game.settings.registerMenu("multiple-chat-tabs", "tab-settings", {
    name: "MCT.menu.name",
    label: "MCT.menu.label",
    icon: "fa-solid fa-tasks",
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
      refreshAllTabUI();
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
      refreshAllTabUI();
    },
  });

  // Hidden parameter
  game.settings.register("multiple-chat-tabs", "auto-load-messages", {
    name: "MCT.settings.autoLoad.name",
    hint: "MCT.settings.autoLoad.hint",
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
    requiresReload: true,
  });

  game.settings.register("multiple-chat-tabs", "load-batch-size", {
    name: "MCT.settings.loadBatchSize.name",
    hint: "MCT.settings.loadBatchSize.hint",
    scope: "client",
    config: false,
    type: Number,
    range: {
      min: 50,
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
        refreshAllTabUI();
      }, 100);
    },
  });

  game.settings.register("multiple-chat-tabs", "unreadTabs", {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });

  // Refresh all Tab UI
  function refreshAllTabUI() {
    // core version check
    const api = game.modules.get("multiple-chat-tabs").api;
    if (ui.chat && ui.chat.element) {
      if (api.isV12()) {
        MultipleChatTabs.refreshTabUI(ui.chat.element[0]);
      } else {
        MultipleChatTabs.refreshTabUI(ui.chat.element);
      }
    }
    Object.values(ui.windows).forEach((app) => {
      if (app.id.startsWith("chat-popout") && app.element) {
        if (api.isV12()) {
          MultipleChatTabs.refreshTabUI(app.element[0]);
        } else {
          MultipleChatTabs.refreshTabUI(app.element);
        }
      }
    });
  }

  // libWrapper
  if (game.modules.get("lib-wrapper")?.active) {
    const api = game.modules.get("multiple-chat-tabs").api;

    // core version check
    const target = api.isV12()
      ? "ChatLog.prototype.scrollBottom"
      : "foundry.applications.sidebar.tabs.ChatLog.prototype.scrollBottom";

    libWrapper.register(
      "multiple-chat-tabs",
      target,
      function (wrapped, ...args) {
        // start Debug
        console.log(
          `%c[MCT-Debug] 3. libWrapper Executed | Instance ID: ${this.id}`,
          "background: #222; color: #ff00ff;"
        );
        // end Debug
        wrapped(...args);
        setTimeout(() => {
          // start Debug
          const location = this.element?.closest("#sidebar")
            ? "Sidebar"
            : "Popout or Other";
          console.log(
            `%c[MCT-Debug] libWrapper: scrollBottom patch executed.`,
            "color: #f5a623;",
            `Location: ${location}`
          );
          // end Debug
          // core version check
          if (!this.element) return;
          let nativeElement;
          if (this.element instanceof HTMLElement) {
            nativeElement = this.element;
          } else {
            nativeElement = this.element[0];
          }
          if (!nativeElement) return;
          const log = nativeElement.querySelector("#chat-log");
          if (log) {
            log.scrollTop = log.scrollHeight;
          }
        }, 50);
      },
      "WRAPPER"
    );
  }
}
