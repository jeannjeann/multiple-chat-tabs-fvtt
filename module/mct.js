import { MultipleChatTabs } from "./multipleChatTabs.js";
import { registerSettings } from "./settings.js";
import { TabDetailSettings } from "./tabSettings.js";
import { MessageFilter } from "./messageFilter.js";

/**
 * Init hook
 */
Hooks.once("init", async function () {
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
      MultipleChatTabs._adjustScrollButtonPosition();
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
  const chatLog = html.find("#chat-log");
  if (chatLog.length) {
    // Chat scroll listener
    const SCROLL_THRESHOLD_PERCENT = 0.05;
    const throttledScrollHandler = foundry.utils.throttle(() => {
      const scrollThresholdPx =
        chatLog[0].clientHeight * SCROLL_THRESHOLD_PERCENT;
      if (
        MultipleChatTabs.isOverflow(html) &&
        chatLog.scrollTop() <= scrollThresholdPx
      ) {
        MultipleChatTabs._onScrollToTop(scrollThresholdPx);
      }
    }, 200);
    chatLog.on("scroll", throttledScrollHandler);

    // Load message listener
    const debouncedMutationHandler = foundry.utils.debounce(
      MultipleChatTabs._updateLoaedMessage,
      100
    );
    const observer = new MutationObserver(debouncedMutationHandler);
    observer.observe(chatLog[0], {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }

  // Message load button
  html.find(".mct-load-more-container").remove();

  if (chatLog.length) {
    const loadButtonHtml = `
        <div class="mct-load-more-container" title="${game.i18n.localize(
          "MCT.tooltips.loadButton"
        )}">
          <a><i class="fas fa-chevron-up"></i></a>
        </div>
      `;
    chatLog.before(loadButtonHtml);
  }

  await MultipleChatTabs.refreshTabUI(html);
});

Hooks.on("renderChatMessage", (message, html, data) => {
  MultipleChatTabs.applyFilterToMessage(html);
});

Hooks.on("createChatMessage", async (message) => {
  // Whisper tab check
  const autoWhisper = game.settings.get("multiple-chat-tabs", "autoWhisperTab");
  if (autoWhisper && message.whisper.length > 0 && game.user.isGM) {
    const allTabs = MultipleChatTabs.getTabs();
    const whisperGroup = new Set(
      [message.author?.id, ...message.whisper].filter(Boolean)
    );

    const matchTab = allTabs.some((tab) => {
      if (!tab.isWhisperTab || !tab.whisperTargets) return false;
      const tabTargets = new Set(tab.whisperTargets.filter(Boolean));
      return (
        tabTargets.size === whisperGroup.size &&
        [...whisperGroup].every((id) => tabTargets.has(id))
      );
    });

    if (!matchTab) {
      const whisperMember = [...whisperGroup];
      let newLabel = "";
      const isAllGMs = whisperMember.every((id) => game.users.get(id)?.isGM);
      const playerMember = whisperMember.filter(
        (id) => !game.users.get(id)?.isGM
      );

      if (isAllGMs) {
        if (whisperMember.length === 1) {
          newLabel = game.users.get(whisperMember[0])?.name || "GM";
        } else {
          newLabel = "GMs";
        }
      } else {
        const memberName = playerMember
          .map((id) => game.users.get(id)?.name || "Unknown")
          .sort();
        newLabel = memberName.join(" & ");
      }

      const newTab = {
        id: `tab-${foundry.utils.randomID(16)}`,
        label: newLabel,
        isDefault: false,
        showAllMessages: false,
        forceOOC: false,
        force: {},
        isWhisperTab: true,
        whisperTargets: whisperMember,
      };

      const newTabs = [...allTabs, newTab];
      await game.settings.set(
        "multiple-chat-tabs",
        "tabs",
        JSON.stringify(newTabs)
      );
    }
  }

  // All show, whisper, unread check
  const currentTabs = MultipleChatTabs.getTabs();
  if (currentTabs.length === 0) return;
  const targetTabIds = MessageFilter.getVisibleTabsForMessage(
    message,
    currentTabs
  );

  currentTabs.forEach((tab) => {
    if (
      tab.showAllMessages &&
      !(tab.isWhisperTab && message.whisper.length === 0)
    ) {
      targetTabIds.add(tab.id);
    }
  });

  // Set first oldestMessage
  for (const tabId of targetTabIds) {
    if (!MultipleChatTabs.oldestMessage[tabId]) {
      MultipleChatTabs.oldestMessage[tabId] = MultipleChatTabs.getOldestMessage(
        tabId,
        { newMessage: message, isFirst: true }
      );

      // Set first  oldestLoadMessage
      const windowScopes = [
        ui.chat.element,
        ...Object.values(ui.windows)
          .filter((w) => w.id.startsWith("chat-popout"))
          .map((w) => w.element),
      ];
      for (const scope of windowScopes) {
        if (!scope) continue;
        const windowId = scope.attr("id");
        if (!MultipleChatTabs.oldestLoadMessage[windowId]) {
          MultipleChatTabs.oldestLoadMessage[windowId] = {};
        }
        MultipleChatTabs.oldestLoadMessage[windowId][tabId] =
          MultipleChatTabs.getOldestLoadMessage(tabId, scope, {
            isFirst: true,
          });
      }
    }
  }

  // Refresh unread count
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

Hooks.on("updateChatMessage", (message, data, options) => {
  MultipleChatTabs.oldestMessage = {};
  MultipleChatTabs.oldestLoadMessage = {};
});

Hooks.on("deleteChatMessage", (message, options, userId) => {
  MultipleChatTabs.oldestMessage = {};
  MultipleChatTabs.oldestLoadMessage = {};
});

Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
  const allTabs = MultipleChatTabs.getTabs();
  const activeTabId = MultipleChatTabs.activeFilter || allTabs[0]?.id;

  const updateData = { "flags.multiple-chat-tabs.sourceTab": activeTabId };

  if (activeTabId) {
    const activeTab = allTabs.find((t) => t.id === activeTabId);

    if (activeTab?.isWhisperTab && activeTab.whisperTargets?.length > 0) {
      // Foece whisper check
      const targets = activeTab.whisperTargets.filter(
        (id) => id !== game.user.id
      );
      if (
        targets.length === 0 &&
        activeTab.whisperTargets.includes(game.user.id)
      ) {
        targets.push(game.user.id);
      }
      if (targets.length > 0) {
        updateData.whisper = targets;
        updateData.style = CONST.CHAT_MESSAGE_STYLES.OTHER;
        updateData.speaker = {
          scene: null,
          actor: null,
          token: null,
          alias: undefined,
        };
      }
    } else if (activeTab?.forceOOC) {
      // Force OOC check
      if (message.style === CONST.CHAT_MESSAGE_STYLES.IC) {
        updateData.style = CONST.CHAT_MESSAGE_STYLES.OOC;
        updateData.speaker = {
          scene: null,
          actor: null,
          token: null,
          alias: undefined,
        };
      }
    }
  }
  message.updateSource(updateData);
});
