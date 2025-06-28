import { MultipleChatTabs } from "./multipleChatTabs.js";
import { registerSettings } from "./settings.js";
import { TabDetailSettings } from "./tabSettings.js";
import { MessageFilter } from "./messageFilter.js";

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

  // Open detail from context menu
  Hooks.on("mct:requestTabEdit", (tabId) => {
    if (tabId) {
      new TabDetailSettings(tabId).render(true);
    }
  });
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
      MultipleChatTabs._adjustScrollButtonPosition(ui.chat.element);
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

  // Initial scrollBottom
  if (ui.chat && ui.chat.element) {
    setTimeout(() => {
      ui.chat.scrollBottom();
    }, 500);
  }
});

Hooks.on("renderChatLog", async (app, html, data) => {
  await MultipleChatTabs.refreshTabUI(html);
});

Hooks.on("renderChatMessage", (message, html, data) => {
  MultipleChatTabs.applyFilterToMessage(html);
});

Hooks.on("createChatMessage", async (message) => {
  const allTabs = MultipleChatTabs.getTabs();
  if (allTabs.length === 0) return;
  const targetTabIds = MessageFilter.getVisibleTabsForMessage(message, allTabs);

  allTabs.forEach((tab) => {
    if (tab.showAllMessages) {
      targetTabIds.add(tab.id);
    }
  });

  let needsRefresh = false;
  for (const tabId of targetTabIds) {
    if (tabId !== MultipleChatTabs.activeFilter) {
      await MultipleChatTabs.increaseUnreadCount(tabId);
      needsRefresh = true;
    }
  }

  if (needsRefresh && ui.chat && ui.chat.element) {
    await MultipleChatTabs.refreshTabUI(ui.chat.element);
  }
});

Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
  const allTabs = MultipleChatTabs.getTabs();
  const activeTabId = MultipleChatTabs.activeFilter || allTabs[0]?.id;

  const updateData = { "flags.multiple-chat-tabs.sourceTab": activeTabId };

  if (activeTabId) {
    const activeTab = allTabs.find((t) => t.id === activeTabId);

    // Force OOC check
    if (activeTab?.forceOOC) {
      updateData.style = CONST.CHAT_MESSAGE_STYLES.OOC;
      updateData.speaker = {
        scene: null,
        actor: null,
        token: null,
        alias: undefined,
      };
    }
  }
  message.updateSource(updateData);
});
