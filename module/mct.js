import { MultipleChatTabs } from "./multipleChatTabs.js";
import { registerSettings, debouncedRefreshAllTab } from "./settings.js";
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
    isV11: () => game.version.startsWith("11."),
    isV12: () => game.version.startsWith("12."),
  };

  // CSS load
  const api = game.modules.get(MODULE_ID).api;

  let cssFile;
  if (api.isV11() || api.isV12()) {
    cssFile = `modules/${MODULE_ID}/css/v12mct.css`;
  } else {
    cssFile = `modules/${MODULE_ID}/css/mct.css`;
  }

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

  // hook by core version
  if (api.isV11() || api.isV12()) {
    Hooks.on("renderChatMessage", (message, html, data) => {
      const htmlElement = html[0] || html;
      MultipleChatTabs.applyFilterToMessage(
        htmlElement,
        MultipleChatTabs.activeFilter
      );
    });
  } else {
    Hooks.on("renderChatMessageHTML", (message, html, data) => {
      MultipleChatTabs.applyFilterToMessage(
        html,
        MultipleChatTabs.activeFilter
      );
    });
  }

  // chatMessage hook for v11
  if (api.isV11()) {
    Hooks.on("chatMessage", (chatLog, messageText, chatData) => {
      const allTabs = MultipleChatTabs.getTabs();
      const activeTabId = MultipleChatTabs.activeFilter || allTabs[0]?.id;
      if (!activeTabId) return true;

      const activeTab = allTabs.find((t) => t.id === activeTabId);
      if (!activeTab) return true;

      // if you need to change something of message at v11
    });
  }
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
  const MODULE_ID = "multiple-chat-tabs";
  const api = game.modules.get(MODULE_ID).api;
  const debouncedResizeHandler = (() => {
    const resizeFn = () => {
      if (ui.chat && ui.chat.element) {
        // core version check
        let mainChatElement;
        if (api.isV11() || api.isV12()) {
          mainChatElement = ui.chat.element[0];
        } else {
          mainChatElement = ui.chat.element;
        }
        if (!mainChatElement) return;

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
            // core version check
            let popoutScope;
            if (api.isV11() || api.isV12()) {
              popoutScope = popout.element[0];
            } else {
              popoutScope = popout.element;
            }
            if (!popoutScope) return;
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
    };
    // core version check
    if (api.isV11()) {
      return debounce(resizeFn, 250);
    } else {
      return foundry.utils.debounce(resizeFn, 250);
    }
  })();
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

  // Initial ResizeObserver
  MultipleChatTabs.resizeObserver = new ResizeObserver((entries) => {
    debouncedResizeHandler();
  });

  if (ui.chat && ui.chat.element) {
    if (api.isV11() || api.isV12()) {
      MultipleChatTabs.resizeObserver.observe(ui.chat.element[0]);
    } else {
      MultipleChatTabs.resizeObserver.observe(ui.chat.element);
    }
  }

  Object.values(ui.windows)
    .filter((w) => w.id.startsWith("chat-popout") && w.element)
    .forEach((popout) => {
      if (api.isV11() || api.isV12()) {
        MultipleChatTabs.resizeObserver.observe(popout.element[0]);
      } else {
        MultipleChatTabs.resizeObserver.observe(popout.element);
      }
    });

  // Initial Tabbar
  if (ui.chat && ui.chat.element) {
    const api = game.modules.get("multiple-chat-tabs").api;
    setTimeout(() => {
      let element;
      if (api.isV11() || api.isV12()) {
        element = ui.chat.element[0];
      } else {
        element = ui.chat.element;
      }
      if (element) MultipleChatTabs.refreshTabUI(element);
    }, 100);
  }

  // Initial loadable check
  if (ui.chat && ui.chat.element) {
    setTimeout(() => {
      _requestCheckAllWin();
    }, 100);
  }
});

Hooks.on("renderChatLog", async (app, html, data) => {
  const MODULE_ID = "multiple-chat-tabs";
  const api = game.modules.get(MODULE_ID).api;
  const htmlElement = html?.jquery ? html[0] : html;
  if (!htmlElement) return;

  if (app.id.startsWith("chat-popout")) {
    MultipleChatTabs.popoutChatApps[htmlElement.id] = app;
  }

  const chatLog = htmlElement.querySelector("#chat-log");
  if (chatLog) {
    // Chat scroll listener
    const scrollHandlerFn = (event) => MultipleChatTabs._onScroll(event);
    const throttledScrollHandler = (() => {
      // core version check
      if (api.isV11()) {
        return throttle(scrollHandlerFn, 200);
      } else {
        return foundry.utils.throttle(scrollHandlerFn, 200);
      }
    })();
    chatLog.addEventListener("scroll", throttledScrollHandler);

    // Load message listener
    const debouncedMutationHandler = (() => {
      const mutationFn = (mutations, observer) =>
        MultipleChatTabs._updateLoaedMessage(mutations);
      // core version check
      if (api.isV11()) {
        return debounce(mutationFn, 100);
      } else {
        return foundry.utils.debounce(mutationFn, 100);
      }
    })();
    const observer = new MutationObserver(debouncedMutationHandler);
    observer.observe(chatLog, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }

  // Observe popout
  if (MultipleChatTabs.resizeObserver) {
    if (api.isV11() || api.isV12()) {
      MultipleChatTabs.resizeObserver.observe(html[0]);
    } else {
      MultipleChatTabs.resizeObserver.observe(html);
    }
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

Hooks.on("createChatMessage", async (message) => {
  const api = game.modules.get("multiple-chat-tabs").api;
  // Whisper tab check
  const autoWhisper = game.settings.get("multiple-chat-tabs", "autoWhisperTab");
  if (autoWhisper && message.whisper.length > 0 && game.user.isGM) {
    const allTabs = MultipleChatTabs.getTabs();
    let authorId;
    // core version check
    if (api.isV11() || !message.author) {
      authorId = message.user?.id;
    } else {
      authorId = message.author.id;
    }
    const whisperGroup = new Set(
      [authorId, ...message.whisper].filter(Boolean)
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
        id: (() => {
          const api = game.modules.get("multiple-chat-tabs").api;
          // core version check
          if (api.isV11()) {
            return `tab-${randomID(16)}`;
          } else {
            return `tab-${foundry.utils.randomID(16)}`;
          }
        })(),
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

      // Set first oldestLoadMessage
      const api = game.modules.get("multiple-chat-tabs").api;
      const windowScopes = [];
      if (ui.chat.element) {
        // core version check
        if (api.isV11() || api.isV12()) {
          windowScopes.push(ui.chat.element[0]);
        } else {
          windowScopes.push(ui.chat.element);
        }
      }
      Object.values(ui.windows)
        .filter((w) => w.id.startsWith("chat-popout") && w.element)
        .forEach((w) => {
          // core version check
          if (api.isV11() || api.isV12()) {
            windowScopes.push(w.element[0]);
          } else {
            windowScopes.push(w.element);
          }
        });

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
    debouncedRefreshAllTab();
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
    const api = game.modules.get("multiple-chat-tabs").api;
    const scopes = [];
    if (ui.chat.element) {
      // core version check
      if (api.isV11() || api.isV12()) {
        scopes.push(ui.chat.element[0]);
      } else {
        scopes.push(ui.chat.element);
      }
    }
    Object.values(ui.windows)
      .filter((w) => w.id.startsWith("chat-popout") && w.element)
      .forEach((w) => {
        // core version check
        if (api.isV11() || api.isV12()) {
          scopes.push(w.element[0]);
        } else {
          scopes.push(w.element);
        }
      });

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
    const api = game.modules.get("multiple-chat-tabs").api;
    const scopes = [];
    if (ui.chat.element) {
      // core version check
      if (api.isV11() || api.isV12()) {
        scopes.push(ui.chat.element[0]);
      } else {
        scopes.push(ui.chat.element);
      }
    }
    Object.values(ui.windows)
      .filter((w) => w.id.startsWith("chat-popout") && w.element)
      .forEach((w) => {
        // core version check
        if (api.isV11() || api.isV12()) {
          scopes.push(w.element[0]);
        } else {
          scopes.push(w.element);
        }
      });

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
  const api = game.modules.get("multiple-chat-tabs").api;
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
        // core version check
        if (api.isV11()) {
          updateData.whisper = targets;
          updateData.type = CONST.CHAT_MESSAGE_TYPES.WHISPER;
          updateData.speaker = {
            scene: null,
            actor: null,
            token: null,
            alias: null,
          };
        } else {
          updateData.whisper = targets;
          updateData.style = CONST.CHAT_MESSAGE_STYLES.OTHER;
          updateData.speaker = {
            scene: null,
            actor: null,
            token: null,
            alias: undefined,
          };
        }
      }
    } else if (activeTab?.forceOOC) {
      // Force OOC check
      // core version check
      if (api.isV11()) {
        if (message.type === CONST.CHAT_MESSAGE_TYPES.IC) {
          updateData.type = CONST.CHAT_MESSAGE_TYPES.OOC;
          updateData.speaker = {
            scene: null,
            actor: null,
            token: null,
            alias: null,
          };
        }
      } else {
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
  }
  message.updateSource(updateData);
});

Hooks.on("closeChatPopout", (app) => {
  const api = game.modules.get("multiple-chat-tabs").api;
  if (MultipleChatTabs.resizeObserver && (api.isV11() || api.isV12())) {
    if (app.element && app.element[0]) {
      MultipleChatTabs.resizeObserver.unobserve(app.element[0]);
    }
  }
  if (
    app.element &&
    app.element[0] &&
    MultipleChatTabs.popoutChatApps[app.element[0].id]
  ) {
    delete MultipleChatTabs.popoutChatApps[app.element[0].id];
  }
});

Hooks.on("closeApplication", (app) => {
  const api = game.modules.get("multiple-chat-tabs").api;
  if (MultipleChatTabs.resizeObserver && !(api.isV11() || api.isV12())) {
    if (app.id.startsWith("chat-popout") && app.element) {
      MultipleChatTabs.resizeObserver.unobserve(app.element);
    }
  }
  if (
    app.id.startsWith("chat-popout") &&
    app.element &&
    MultipleChatTabs.popoutChatApps[app.element.id]
  ) {
    delete MultipleChatTabs.popoutChatApps[app.element.id];
  }
});

function _requestCheckAllWin() {
  const api = game.modules.get("multiple-chat-tabs").api;
  // Sidebar
  if (ui.chat.element) {
    // core version check
    let element;
    if (api.isV11() || api.isV12()) {
      element = ui.chat.element[0];
    } else {
      element = ui.chat.element;
    }
    if (element) MultipleChatTabs._requestLoad(element);
  }
  // Popup
  Object.values(ui.windows)
    .filter((w) => w.id.startsWith("chat-popout") && w.element)
    .forEach((popout) => {
      // core version check
      let element;
      if (api.isV11() || api.isV12()) {
        element = popout.element[0];
      } else {
        element = popout.element;
      }
      if (element) MultipleChatTabs._requestLoad(element);
    });
}

/**
 * Debounce for v11
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle for v11
 * @param {Function} func
 * @param {number}   limit
 * @returns {Function}
 */
function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
