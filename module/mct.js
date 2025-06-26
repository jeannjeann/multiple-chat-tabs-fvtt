import { MultipleChatTabs } from "./multipleChatTabs.js";
import { TabSettings } from "./tabSettings.js";
import { registerSettings } from "./settings.js";

/**
 * Initialize module
 */
Hooks.once("init", async function () {
  // Load templates
  const templatePaths = [
    "modules/multiple-chat-tabs/templates/chat-tabs.hbs",
    "modules/multiple-chat-tabs/templates/tab-settings.hbs",
  ];
  await loadTemplates(templatePaths);

  // Configure
  registerSettings();

  // Resize hook
  $(window).on("resize", () => {
    if (ui.chat && ui.chat.element) {
      MultipleChatTabs.updateScrollButtons(ui.chat.element);
    }
  });

  // Override ChatLog.scrollBottom method
  ChatLog.prototype.scrollBottom = function () {
    setTimeout(() => {
      const log = this.element.find("#chat-log");
      if (log.length) {
        // Scroll to bottom
        log.scrollTop(log[0].scrollHeight);
      }
    }, 50); // Wait a bit
  };

  Hooks.on("renderChatLog", async (app, html, data) => {
    await MultipleChatTabs.refreshTabUI(html);
  });

  Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
    message.updateSource({
      "flags.multiple-chat-tabs.sourceTab": MultipleChatTabs.activeFilter,
    });
  });
});
