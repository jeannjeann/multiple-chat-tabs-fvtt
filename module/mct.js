import { MultipleChatTabs } from "./multipleChatTabs.js";
import { registerSettings } from "./settings.js";
import { TabDetailSettings } from "./tabSettings.js";
import { MessageFilter } from "./messageFilter.js";

/**
 * Init hook
 */
Hooks.once("init", async function () {
  // API
  const MODULE_ID = "multiple-chat-tabs";
  game.modules.get(MODULE_ID).api = {
    // core version check
    isV12: () => !foundry.utils.isNewerVersion(game.version, 13),
  };

  // CSS load
  const api = game.modules.get(MODULE_ID).api;
  const useV12Css = api.isV12();

  const cssFile = useV12Css
    ? `modules/${MODULE_ID}/css/v12mct.css`
    : `modules/${MODULE_ID}/css/mct.css`;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = cssFile;
  document.head.appendChild(link);

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
  const debouncedResizeHandler = foundry.utils.debounce(() => {
    if (ui.chat && ui.chat.element) {
      // Main
      const mainChatElement = ui.chat.element[0];
      MultipleChatTabs.updateScrollButtons(mainChatElement);
      MultipleChatTabs._adjustScrollButtonPosition(mainChatElement);
      // Update oldestLoadMessage
      const mainScope = mainChatElement;
      const mainTabId = MultipleChatTabs.activeFilter;
      if (mainTabId) {
        const windowId = mainScope.id;
        if (!MultipleChatTabs.oldestLoadMessage[windowId]) {
          MultipleChatTabs.oldestLoadMessage[windowId] = {};
        }
        MultipleChatTabs.oldestLoadMessage[windowId][mainTabId] =
          MultipleChatTabs.getOldestLoadMessage(mainTabId, mainScope);
      }
      // Loadable check
      MultipleChatTabs._requestLoad(mainScope);

      // Popup
      Object.values(ui.windows)
        .filter((w) => w.id.startsWith("chat-popout") && w.element)
        .forEach((popout) => {
          const popoutScope = popout.element[0];
          const popoutTabId = MultipleChatTabs.activeFilter;
          MultipleChatTabs.updateScrollButtons(popoutScope);
          MultipleChatTabs._adjustScrollButtonPosition(popoutScope);
          // Update oldestLoadMessage
          if (popoutTabId) {
            const windowId = popoutScope.id;
            if (!MultipleChatTabs.oldestLoadMessage[windowId]) {
              MultipleChatTabs.oldestLoadMessage[windowId] = {};
            }
            MultipleChatTabs.oldestLoadMessage[windowId][popoutTabId] =
              MultipleChatTabs.getOldestLoadMessage(popoutTabId, popoutScope);
          }
          // Loadable check
          MultipleChatTabs._requestLoad(popoutScope);
        });
    }
  }, 250);
  window.addEventListener("resize", debouncedResizeHandler);

  /* Monkey Patch
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
  */

  // Initial scrollBottom
  if (ui.chat && ui.chat.element) {
    setTimeout(() => {
      ui.chat.scrollBottom();
    }, 500);
  }

  // Initial loadable check
  if (ui.chat && ui.chat.element) {
    setTimeout(() => {
      _requestCheckAllWin();
    }, 100);
  }
});

Hooks.on("renderChatLog", async (app, html, data) => {
  const htmlElement = html[0];
  const chatLog = htmlElement.querySelector("#chat-log");
  if (chatLog) {
    // Chat scroll listener
    const throttledScrollHandler = foundry.utils.throttle(
      (event) => MultipleChatTabs._onScroll(event),
      200
    );
    chatLog.addEventListener("scroll", throttledScrollHandler);

    // Load message listener
    const debouncedMutationHandler = foundry.utils.debounce(
      (mutations, observer) => MultipleChatTabs._updateLoaedMessage(mutations),
      100
    );
    const observer = new MutationObserver(debouncedMutationHandler);
    observer.observe(chatLog, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }

  // Message load button
  htmlElement.querySelector(".mct-load-more-container")?.remove();

  if (chatLog) {
    const loadButtonHtml = `
        <div class="mct-load-more-container" title="${game.i18n.localize(
          "MCT.tooltips.loadButton"
        )}">
          <a><i class="fa-solid fa-chevron-up"></i></a>
        </div>
      `;
    chatLog.insertAdjacentHTML("beforebegin", loadButtonHtml);
  }

  await MultipleChatTabs.refreshTabUI(htmlElement);
});

Hooks.on("renderChatMessage", (message, html, data) => {
  MultipleChatTabs.applyFilterToMessage(html[0]);
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
        ui.chat.element?.[0],
        ...Object.values(ui.windows)
          .filter((w) => w.id.startsWith("chat-popout") && w.element)
          .map((w) => w.element[0]),
      ].filter(Boolean); // nullやundefinedを除外

      for (const scope of windowScopes) {
        if (!scope) continue;
        const windowId = scope.id;
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

  if (needsRefresh) {
    if (ui.chat && ui.chat.element) {
      await MultipleChatTabs.refreshTabUI(ui.chat.element[0]);
    }
    for (const app of Object.values(ui.windows)) {
      if (app.id.startsWith("chat-popout") && app.element) {
        await MultipleChatTabs.refreshTabUI(app.element[0]);
      }
    }
  }

  // Loadable check
  _requestCheckAllWin();
});

Hooks.on("updateChatMessage", (message, data, options) => {
  const activeTabId = MultipleChatTabs.activeFilter;
  if (activeTabId) {
    // Update oldestMessage
    MultipleChatTabs.oldestMessage[activeTabId] =
      MultipleChatTabs.getOldestMessage(activeTabId);
    // Update oldestLoadMessage
    const scopes = [
      ui.chat.element?.[0],
      ...Object.values(ui.windows)
        .filter((w) => w.id.startsWith("chat-popout") && w.element)
        .map((w) => w.element[0]),
    ].filter(Boolean);

    scopes.forEach((scope) => {
      if (!scope) return;
      const windowId = scope.id;
      if (!MultipleChatTabs.oldestLoadMessage[windowId]) {
        MultipleChatTabs.oldestLoadMessage[windowId] = {};
      }
      MultipleChatTabs.oldestLoadMessage[windowId][activeTabId] =
        MultipleChatTabs.getOldestLoadMessage(activeTabId, scope);
    });
  }
  // Loadable check
  _requestCheckAllWin();
});

Hooks.on("deleteChatMessage", (message, options, userId) => {
  const activeTabId = MultipleChatTabs.activeFilter;
  if (activeTabId) {
    // Update oldestMessage
    MultipleChatTabs.oldestMessage[activeTabId] =
      MultipleChatTabs.getOldestMessage(activeTabId);
    // Update oldestLoadMessage
    const scopes = [
      ui.chat.element?.[0],
      ...Object.values(ui.windows)
        .filter((w) => w.id.startsWith("chat-popout") && w.element)
        .map((w) => w.element[0]),
    ].filter(Boolean);

    scopes.forEach((scope) => {
      if (!scope) return;
      const windowId = scope.id;
      if (!MultipleChatTabs.oldestLoadMessage[windowId]) {
        MultipleChatTabs.oldestLoadMessage[windowId] = {};
      }
      MultipleChatTabs.oldestLoadMessage[windowId][activeTabId] =
        MultipleChatTabs.getOldestLoadMessage(activeTabId, scope);
    });
  }
  // Loadable check
  _requestCheckAllWin();
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

function _requestCheckAllWin() {
  // Sidebar
  if (ui.chat.element) MultipleChatTabs._requestLoad(ui.chat.element[0]);
  // Popup
  Object.values(ui.windows)
    .filter((w) => w.id.startsWith("chat-popout") && w.element)
    .forEach((popout) => MultipleChatTabs._requestLoad(popout.element[0]));
}
