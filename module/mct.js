import { MultipleChatTabs } from "./multipleChatTabs.js";
import { registerSettings } from "./settings.js";

/**
 * Init hook
 */
Hooks.once("init", async function () {
  // Load templates early.
  const templatePaths = [
    "modules/multiple-chat-tabs/templates/chat-tabs.hbs",
    "modules/multiple-chat-tabs/templates/tab-settings.hbs",
    "modules/multiple-chat-tabs/templates/tab-detail-settings.hbs",
  ];
  await loadTemplates(templatePaths);
});

/**
 * Setup hook
 */
Hooks.once("setup", function () {
  registerSettings();
});

/**
 * Ready hook
 */
Hooks.once("ready", function () {
  $(window).on("resize", () => {
    if (ui.chat && ui.chat.element) {
      MultipleChatTabs.updateScrollButtons(ui.chat.element);
    }
  });

  // Override scrollBottom
  if (!ChatLog.prototype._originalScrollBottom) {
    ChatLog.prototype._originalScrollBottom = ChatLog.prototype.scrollBottom;
    ChatLog.prototype.scrollBottom = function () {
      setTimeout(() => {
        const log = this.element.find("#chat-log");
        if (log.length) {
          log.scrollTop(log[0].scrollHeight);
        }
      }, 50);
    };
  }
});

Hooks.on("renderChatLog", async (app, html, data) => {
  await MultipleChatTabs.refreshTabUI(html);
});

Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
  message.updateSource({
    "flags.multiple-chat-tabs.sourceTab": MultipleChatTabs.activeFilter,
  });
});
