import { MessageFilter } from "./messageFilter.js";

// MultipleChatTabs Class
export class MultipleChatTabs {
  static _debouncedCheck = foundry.utils.debounce(this._isLoadable, 100);
  static resizeObserver = null;
  static popoutChatApps = {};

  /**
   * Requests debounce.
   * @param {HTMLElement} [scope]
   * @private
   */
  static _requestLoad(scope) {
    const activeTabId = this.activeFilter;
    const targetScope = scope || (ui.chat.element ? ui.chat.element[0] : null);
    if (activeTabId && targetScope) {
      this._debouncedCheck(activeTabId, targetScope);
    }
  }

  // Helper to get configured tabs
  static getTabs() {
    const tabString = game.settings.get("multiple-chat-tabs", "tabs");
    try {
      const tabs = JSON.parse(tabString);
      if (Array.isArray(tabs)) {
        return tabs.filter((tab) => tab.label);
      }
    } catch (e) {
      return [];
    }
    return [];
  }

  static activeFilter = null;
  static oldestMessage = {};
  static oldestLoadMessage = {}; // { [windowId]: { [tabId]: messageId } }

  /**
   * Refresh tab UI
   * @param {HTMLElement} html
   */
  static async refreshTabUI(html) {
    html.querySelector(".mct-container")?.remove();

    let tabs = this.getTabs();
    const currentUser = game.user;
    const api = game.modules.get("multiple-chat-tabs").api;

    // Whisper tabs filter
    tabs = tabs.filter((tab) => {
      if (!tab.isWhisperTab) return true;
      return tab.whisperTargets?.includes(currentUser.id);
    });

    if (tabs.length === 0) {
      const messageContainer = html.querySelector("ol.chat-log, #chat-log");
      if (messageContainer) {
        messageContainer
          .querySelectorAll(".message")
          .forEach((el) => (el.style.display = ""));
      }
      if (ui.chat) ui.chat.scrollBottom();
      return;
    }

    let activeFilter = html.dataset.activeFilter || this.activeFilter;
    if (!tabs.some((t) => t.id === activeFilter)) {
      activeFilter = tabs[0]?.id || null;
    }
    html.dataset.activeFilter = activeFilter;
    this.activeFilter = activeFilter;

    // Initialize default tab's property
    const initialActiveTabId = this.activeFilter;
    if (initialActiveTabId) {
      const windowId = html.id;
      if (!this.oldestMessage[initialActiveTabId]) {
        this.oldestMessage[initialActiveTabId] =
          this.getOldestMessage(initialActiveTabId);
      }
      if (!this.oldestLoadMessage[windowId])
        this.oldestLoadMessage[windowId] = {};
      this.oldestLoadMessage[windowId][initialActiveTabId] =
        this.getOldestLoadMessage(initialActiveTabId, html);
    }

    // Initialize unread count
    const showCount = game.settings.get(
      "multiple-chat-tabs",
      "display-unread-count"
    );
    const unreadCounts = this.getUnreadCounts();
    const processedTabs = tabs.map((tab) => ({
      ...tab,
      isWhisperTab: tab.isWhisperTab ?? false,
      unreadCount: unreadCounts[tab.id] || 0,
    }));
    const isGM = game.user.isGM;

    // core version check
    let tabsHtml;
    if (api.isV11() || api.isV12()) {
      tabsHtml = await renderTemplate(
        "modules/multiple-chat-tabs/templates/chat-tabs.hbs",
        { tabs: processedTabs, showCount: showCount, isGM: isGM }
      );
    } else {
      tabsHtml = await foundry.applications.handlebars.renderTemplate(
        "modules/multiple-chat-tabs/templates/chat-tabs.hbs",
        { tabs: processedTabs, showCount: showCount, isGM: isGM }
      );
    }

    // core version check
    if (api.isV11() || api.isV12()) {
      const chatLog = html.querySelector("#chat-log");
      chatLog?.insertAdjacentHTML("afterend", tabsHtml);
    } else {
      const chatForm = html.querySelector(".chat-form");
      if (chatForm) {
        chatForm.insertAdjacentHTML("beforebegin", tabsHtml);
      } else {
        const messageContainer = html.querySelector("ol.chat-log");
        messageContainer?.insertAdjacentHTML("beforebegin", tabsHtml);
      }
    }

    html
      .querySelector(`.item[data-filter="${activeFilter}"]`)
      ?.classList.add("active");

    // Activate listener
    this._activateTabListeners(html);
    this.applyFilter(html);
    this._adjustScrollButtonPosition(html);
    this._scrollActiveTab(html);
    this._requestLoad(html);
  }

  /**
   * Tab UI helper
   * @param {HTMLElement} html
   * @private
   */
  static _activateTabListeners(html) {
    const container = html.querySelector(".mct-container");
    if (!container) return;

    container.addEventListener("click", (event) => {
      const target = event.target;
      const tabItem = target.closest(".multiple-chat-tabs-nav .item");
      const addTabBtn = target.closest(".add-tab-btn");
      const scrollBtn = target.closest(".scroll-btn");
      const loadMoreLink = target.closest(".mct-load-more-container a");

      if (tabItem) {
        event.preventDefault();
        this._onTabClick(event);
      } else if (addTabBtn) {
        this._onAddTabClick(event);
      } else if (scrollBtn) {
        const scroller = container.querySelector(".mct-scroller");
        if (!scroller) return;
        const direction = scrollBtn.classList.contains("left") ? -1 : 1;
        const scrollAmount = scroller.clientWidth * 0.7;
        scroller.scrollLeft += scrollAmount * direction;
      } else if (loadMoreLink) {
      }
    });

    container.addEventListener("contextmenu", (event) => {
      const target = event.target;
      const tabItem = target.closest(".multiple-chat-tabs-nav .item");
      const addTabBtn = target.closest(".add-tab-btn");

      if (tabItem) {
        this._onTabContextMenu(event);
      } else if (addTabBtn) {
        this._onAddTabContextMenu(event);
      }
    });

    // Tabbar scroll listener
    const scroller = container.querySelector(".mct-scroller");
    if (scroller) {
      this.updateScrollButtons(container);
      scroller.addEventListener("scroll", () =>
        this.updateScrollButtons(container)
      );
      scroller.addEventListener("wheel", (event) => {
        event.preventDefault();
        const delta = event.deltaX || event.deltaY;
        scroller.scrollLeft += delta;
      });
    }
  }

  /**
   * Tab context menu event handler
   * @param {MouseEvent} event
   * @private
   */
  static _onTabContextMenu(event) {
    if (!game.user.isGM) return;
    event.preventDefault();
    event.stopPropagation();

    document.querySelector(".mct-context-menu")?.remove();

    const tabElement = event.target.closest(".multiple-chat-tabs-nav .item");
    if (!tabElement) return;

    const tabId = tabElement.dataset.filter;
    if (!tabId) return;

    const allTabs = this.getTabs();
    const tab = allTabs.find((t) => t.id === tabId);
    if (!tab) return;
    const isDefaultTab = allTabs.findIndex((t) => t.id === tabId) === 0;

    const menuItems = [
      `<li data-action="edit"><i class="fa-solid fa-cog"></i> ${game.i18n.localize(
        "MCT.context.settings"
      )}</li>`,
    ];
    if (!isDefaultTab) {
      menuItems.push(
        `<li data-action="delete"><i class="fa-solid fa-trash"></i> ${game.i18n.localize(
          "MCT.context.delete"
        )}</li>`
      );
    }

    const menu = document.createElement("ul");
    menu.className = "mct-context-menu";
    menu.innerHTML = menuItems.join("");
    document.body.appendChild(menu);

    this._positionContextMenu(menu, event);

    menu.addEventListener("click", (e) => {
      const clickedLi = e.target.closest("li");
      if (!clickedLi) return;
      const action = clickedLi.dataset.action;
      if (action === "edit") {
        Hooks.call("mct:requestTabEdit", tabId);
      } else if (action === "delete") {
        this._onDeleteTabRequested(tabId);
      }
      menu.remove();
    });

    const closeMenu = () => menu.remove();
    window.addEventListener("click", closeMenu, { once: true });
    window.addEventListener("contextmenu", closeMenu, { once: true });
  }

  /**
   * Add tab button context menu event handler
   * @param {MouseEvent} event
   * @private
   */
  static _onAddTabContextMenu(event) {
    if (!game.user.isGM) return;
    event.preventDefault();
    event.stopPropagation();

    document.querySelector(".mct-context-menu")?.remove();

    const menuItems = [
      `<li data-action="settings"><i class="fa-solid fa-tasks"></i> ${game.i18n.localize(
        "MCT.context.tabSettings"
      )}</li>`,
    ];

    const menu = document.createElement("ul");
    menu.className = "mct-context-menu";
    menu.innerHTML = menuItems.join("");
    document.body.appendChild(menu);

    this._positionContextMenu(menu, event);

    menu.addEventListener("click", (e) => {
      const clickedLi = e.target.closest("li");
      if (!clickedLi || clickedLi.dataset.action !== "settings") return;

      const menuSetting = game.settings.menus.get(
        "multiple-chat-tabs.tab-settings"
      );
      if (menuSetting) {
        new menuSetting.type().render(true);
      }
      menu.remove();
    });

    const closeMenu = () => menu.remove();
    window.addEventListener("click", closeMenu, { once: true });
    window.addEventListener("contextmenu", closeMenu, { once: true });
  }

  /**
   * Position the context menu.
   * @param {HTMLElement} menu
   * @param {MouseEvent} event
   * @private
   */
  static _positionContextMenu(menu, event) {
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    let top = event.clientY;
    let left = event.clientX;

    if (left + menuWidth > windowWidth) {
      left = windowWidth - menuWidth - 5;
    }
    if (top + menuHeight > windowHeight) {
      top = windowHeight - menuHeight - 5;
    }
    menu.style.position = "fixed";
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  /**
   * Unread count helpers
   */
  static getUnreadTabs() {
    return game.settings.get("multiple-chat-tabs", "unreadTabs") || {};
  }
  static async setUnreadStatus(tabId, status) {
    const unread = foundry.utils.deepClone(this.getUnreadTabs());
    if (!!unread[tabId] === status) return;

    if (status) {
      unread[tabId] = true;
    } else {
      delete unread[tabId];
    }
    await game.settings.set("multiple-chat-tabs", "unreadTabs", unread);
  }
  static getUnreadCounts() {
    return game.settings.get("multiple-chat-tabs", "unreadTabs") || {};
  }
  static async increaseUnreadCount(tabId) {
    const counts = foundry.utils.deepClone(this.getUnreadCounts());
    counts[tabId] = (counts[tabId] || 0) + 1;
    await game.settings.set("multiple-chat-tabs", "unreadTabs", counts);
  }
  static async resetUnreadCount(tabId) {
    const counts = foundry.utils.deepClone(this.getUnreadCounts());
    if (!counts[tabId]) return;
    delete counts[tabId];
    await game.settings.set("multiple-chat-tabs", "unreadTabs", counts);
  }

  /**
   * Tab click event handler
   * @param {Event} event
   */
  static async _onTabClick(event) {
    const clickedTab = event.target.closest(".item");
    if (!clickedTab) return;

    const appElement = clickedTab.closest(".window-app, #chat, #chat-popout");
    if (!appElement) return;

    const nativeAppElement = appElement.jquery ? appElement[0] : appElement;
    const clickedFilter = clickedTab.dataset.filter;

    if (nativeAppElement.dataset.activeFilter === clickedFilter) return;

    nativeAppElement
      .querySelector(".multiple-chat-tabs-nav .item.active")
      ?.classList.remove("active");
    clickedTab.classList.add("active");

    nativeAppElement.dataset.activeFilter = clickedFilter;
    MultipleChatTabs.activeFilter = clickedFilter;

    this.applyFilter(nativeAppElement);
    this._scrollActiveTab(nativeAppElement);

    // Update oldestMessage
    const windowId = nativeAppElement.id;
    if (!this.oldestMessage[clickedFilter]) {
      this.oldestMessage[clickedFilter] = this.getOldestMessage(clickedFilter);
    }
    if (!this.oldestLoadMessage[windowId]) {
      this.oldestLoadMessage[windowId] = {};
    }

    // Update oldestLoadMessage
    this.oldestLoadMessage[windowId][clickedFilter] = this.getOldestLoadMessage(
      clickedFilter,
      nativeAppElement
    );

    // Reset unread count
    if (this.getUnreadCounts()[clickedFilter]) {
      await this.resetUnreadCount(clickedFilter);
      clickedTab.querySelector(".unread-indicator")?.remove();
    }

    // Loadable check
    this._requestLoad(nativeAppElement);

    // Scroll bottom
    let chatApp = null;

    if (nativeAppElement.id.startsWith("chat-popout")) {
      chatApp = MultipleChatTabs.popoutChatApps[nativeAppElement.id];
    } else if (nativeAppElement.id === "chat") {
      chatApp = ui.chat;
    }

    if (chatApp && typeof chatApp.scrollBottom === "function") {
      chatApp.scrollBottom();
    }
  }

  /**
   * Tab scroll
   * @param {HTMLElement} container
   */
  static updateScrollButtons(container) {
    if (!container) return;
    const scroller = container.querySelector(".mct-scroller");
    if (!scroller) return;

    const scrollLeft = scroller.scrollLeft;
    const scrollWidth = scroller.scrollWidth;
    const clientWidth = scroller.clientWidth;

    const leftBtn = container.querySelector(".scroll-btn.left");
    if (leftBtn) leftBtn.style.display = scrollLeft > 0 ? "" : "none";

    const rightBtn = container.querySelector(".scroll-btn.right");
    if (rightBtn)
      rightBtn.style.display =
        scrollWidth - clientWidth - scrollLeft > 1 ? "" : "none";
  }

  /**
   * Ajust active tab position
   * @param {HTMLElement} [scope]
   * @private
   */
  static _scrollActiveTab(scope) {
    const container = scope || (ui.chat.element ? ui.chat.element[0] : null);
    if (!container) return;

    const mctContainer = container.querySelector(".mct-container");
    if (!mctContainer) return;

    const scrollerEl = mctContainer.querySelector(".mct-scroller");
    const activeTabEl = mctContainer.querySelector(
      ".multiple-chat-tabs-nav .item.active"
    );
    if (!scrollerEl || !activeTabEl) return;

    const scrollerRect = scrollerEl.getBoundingClientRect();
    const activeTabRect = activeTabEl.getBoundingClientRect();
    const leftBtn = mctContainer.querySelector(".scroll-btn.left");
    const rightBtn = mctContainer.querySelector(".scroll-btn.right");
    const leftButtonWidth =
      leftBtn && leftBtn.style.display !== "none" ? leftBtn.offsetWidth : 0;
    const rightButtonWidth =
      rightBtn && rightBtn.style.display !== "none" ? rightBtn.offsetWidth : 0;
    const visibleAreaStart = scrollerRect.left + leftButtonWidth;
    const visibleAreaEnd = scrollerRect.right - rightButtonWidth;

    let targetScrollLeft;

    if (activeTabRect.width > visibleAreaEnd - visibleAreaStart) {
      const shiftAmount = activeTabRect.left - visibleAreaStart;
      targetScrollLeft = scrollerEl.scrollLeft + shiftAmount - 5;
    }
    if (targetScrollLeft === undefined) {
      if (activeTabRect.right > visibleAreaEnd) {
        const overflowAmount = activeTabRect.right - visibleAreaEnd;
        targetScrollLeft = scrollerEl.scrollLeft + overflowAmount + 5;
      }
      if (activeTabRect.left < visibleAreaStart) {
        const underflowAmount = visibleAreaStart - activeTabRect.left;
        targetScrollLeft = scrollerEl.scrollLeft - underflowAmount - 5;
      }
    }

    if (targetScrollLeft !== undefined) {
      const maxScrollLeft = scrollerEl.scrollWidth - scrollerEl.clientWidth;
      const finalScrollLeft = Math.max(
        0,
        Math.min(targetScrollLeft, maxScrollLeft)
      );

      scrollerEl.scrollLeft = finalScrollLeft;
    }
  }

  /**
   * Add Tab button event handler
   * @param {Event} event
   * @private
   */
  static async _onAddTabClick(event) {
    event.preventDefault();

    const tabs = this.getTabs();
    const defaultName =
      game.i18n.localize("MCT.settings.defaults.newTabName") || "New Tab";

    let newLabel = defaultName;
    let counter = 2;
    const existingLabels = new Set(tabs.map((t) => t.label));
    while (existingLabels.has(newLabel)) {
      newLabel = `${defaultName} ${counter}`;
      counter++;
    }

    const newTab = {
      id: `tab-${foundry.utils.randomID(16)}`,
      label: newLabel,
      isDefault: false,
      showAllMessages: false,
      forceOOC: false,
      force: {},
      isWhisperTab: false,
      whisperTargets: [],
    };

    tabs.push(newTab);

    await game.settings.set("multiple-chat-tabs", "tabs", JSON.stringify(tabs));

    // Refresh the TabSetting Window
    const settingsWindow = Object.values(ui.windows).find(
      (w) => w.id === "multiple-chat-tabs-settings"
    );
    if (settingsWindow) {
      settingsWindow.render(true);
    }
  }

  /**
   * Delete tab from context menu
   * @param {string} tabId
   * @private
   */
  static _onDeleteTabRequested(tabId) {
    if (!tabId) return;
    const tabs = this.getTabs();
    const tabData = tabs.find((t) => t.id === tabId);

    if (!tabData) return;
    if (tabData.isDefault) {
      ui.notifications.warn(
        game.i18n.localize("MCT.notifications.cannotDeleteDefault")
      );
      return;
    }

    const dialog = new Dialog({
      title: game.i18n.format("MCT.dialog.delete.title", { tabId: tabId }),
      content: game.i18n.format("MCT.dialog.delete.content", {
        name: tabData.label,
      }),
      buttons: {
        delete: {
          icon: '<i class="fa-solid fa-trash"></i>',
          label: game.i18n.localize("Delete"),
          callback: async () => {
            const newTabs = tabs.filter((t) => t.id !== tabId);
            if (this.activeFilter === tabId) {
              this.activeFilter = newTabs[0]?.id || null;
            }
            await game.settings.set(
              "multiple-chat-tabs",
              "tabs",
              JSON.stringify(newTabs)
            );
            const settingsWindow = Object.values(ui.windows).find(
              (w) => w.id === "multiple-chat-tabs-settings"
            );
            if (settingsWindow) {
              settingsWindow.render(true);
            }
          },
        },
        cancel: {
          icon: '<i class="fa-solid fa-times"></i>',
          label: game.i18n.localize("Cancel"),
        },
      },
      default: "cancel",
    });
    dialog.render(true);
  }

  /**
   * Separate message
   * @param {HTMLElement} [scope]
   * @param {object} [options={}]
   * @param {boolean} [options.scroll=true]
   */
  static applyFilter(scope, { scroll = true } = {}) {
    // core version check
    const api = game.modules.get("multiple-chat-tabs").api;
    let messageContainer;
    if (api.isV11() || api.isV12()) {
      messageContainer = scope.querySelector("#chat-log");
    } else {
      messageContainer = scope.querySelector("ol.chat-log");
    }
    if (!messageContainer) return;

    const activeFilter = scope.dataset.activeFilter;
    const messages = messageContainer.querySelectorAll(".message");
    messages.forEach((el) => {
      this.applyFilterToMessage(el, activeFilter);
    });

    // Scroll bottom button refresh
    const nativeScope = scope.jquery ? scope[0] : scope;
    const chat =
      Object.values(ui.windows).find(
        (w) => (w.element.jquery ? w.element[0] : w.element) === nativeScope
      ) || (ui.chat.element[0] === nativeScope ? ui.chat : null);
    if (chat && typeof chat._onScrollLog === "function") {
      const fakeEvent = {
        currentTarget: messageContainer,
        target: messageContainer,
      };
      chat._onScrollLog(fakeEvent);
    }
  }

  /**
   * Filtering message
   * @param {HTMLElement} messageElement
   * @param {string} activeFilter
   *   */
  static applyFilterToMessage(messageElement, activeFilter) {
    const allTabs = this.getTabs();
    const message = game.messages.get(messageElement.dataset.messageId);

    const show = MessageFilter.filterMessage(message, allTabs, activeFilter);

    messageElement.style.display = show ? "" : "none";
  }

  /**
   * Scroll to bottom button shift
   * @param {HTMLElement} html
   * @private
   */
  static _adjustScrollButtonPosition(scope) {
    if (!scope) {
      const chatApp = document.getElementById("chat");
      if (!chatApp) return;
      scope = chatApp;
    }

    const jumpToBottomContainer = scope.querySelector(".jump-to-bottom");
    if (!jumpToBottomContainer) return;

    const mctContainer = scope.querySelector(".mct-container");

    if (mctContainer) {
      const style = getComputedStyle(mctContainer);
      const marginTop = parseFloat(style.marginTop) || 0;
      const marginBottom = parseFloat(style.marginBottom) || 0;
      const tabBarHeight = mctContainer.offsetHeight + marginTop + marginBottom;

      jumpToBottomContainer.style.transform = `translateY(-${tabBarHeight}px)`;
      jumpToBottomContainer.style.transition = "transform 0.2s ease-in-out";
    } else {
      jumpToBottomContainer.style.transform = "";
    }
  }

  /**
   * Get Oldest Message ID
   * @param {string} tabId
   * @param {object} [options={}]
   * @param {ChatMessage} [options.newMessage=null]
   * @param {boolean} [options.isFirst=false]
   * @returns {string|null}
   */
  static getOldestMessage(tabId, { newMessage = null, isFirst = false } = {}) {
    if (!tabId) return null;
    const allTabs = this.getTabs();
    if (allTabs.length === 0) return null;

    // Check first message
    if (newMessage && isFirst) {
      if (MessageFilter.filterMessage(newMessage, allTabs, tabId)) {
        return newMessage.id;
      }
    }

    // Full search
    const sortedMessages = [...game.messages].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    for (const message of sortedMessages) {
      if (MessageFilter.filterMessage(message, allTabs, tabId)) {
        return message.id;
      }
    }
    return null;
  }

  /**
   * Get Oldest Load Message ID
   * @param {string} tabId
   * @param {HTMLElement} [scope=ui.chat.element[0]]
   * @param {object} [options={}]
   * @param {boolean} [options.isFirst=false]
   * @returns {string|null}
   */
  static getOldestLoadMessage(tabId, scope, { isFirst = false } = {}) {
    if (!tabId) return null;
    const targetElement =
      scope || (ui.chat.element ? ui.chat.element[0] : null);
    if (!targetElement) return null;
    const windowId = targetElement.id || "unknown-window";
    const allTabs = this.getTabs();
    const tab = allTabs.find((t) => t.id === tabId);

    // Check first message
    if (isFirst) {
      const oldestMessageId = this.oldestMessage[tabId];
      return oldestMessageId;
    }

    // Full DOM search
    const chatLog = targetElement.querySelector("#chat-log");
    if (!chatLog) return null;
    const messageElements = chatLog.querySelectorAll(".message");
    for (let i = 0; i < messageElements.length; i++) {
      const el = messageElements[i];
      const messageId = el.dataset.messageId;
      const message = game.messages.get(messageId);
      if (message && MessageFilter.filterMessage(message, allTabs, tabId)) {
        return message.id;
      }
    }
    return null;
  }

  /**
   * Load past message
   * @param {object} [options]
   * @param {number} [options.batchSize]
   * @param {HTMLElement} [options.scope=null]
   */
  static async loadMessage({ scope = null } = {}) {
    const chat = scope
      ? Object.values(ui.windows).find(
          (w) => w.element && w.element[0] === scope
        ) ?? ui.chat
      : ui.chat;
    if (!chat) return;

    const chatLog = chat.element[0].querySelector("#chat-log");
    if (!chatLog) return;

    const oldScrollHeight = chatLog.scrollHeight;
    const oldScrollTop = chatLog.scrollTop;

    const batchSize = game.settings.get(
      "multiple-chat-tabs",
      "load-batch-size"
    );
    await chat._renderBatch(chat.element, batchSize, chatLog.scrollTop === 0);

    this.applyFilter(chat.element[0], { scroll: false });

    setTimeout(() => {
      // Scroll position
      const newScrollHeight = chatLog.scrollHeight;
      const heightDifference = newScrollHeight - oldScrollHeight;
      const newScrollTop = oldScrollTop + heightDifference;

      chatLog.scrollTop = Math.max(0, newScrollTop);
    }, 50);
  }

  /**
   * Message overflow check
   * @param {HTMLElement} [scope=ui.chat.element]
   * @returns {boolean}
   */
  static isOverflow(scope) {
    const targetElement =
      scope || (ui.chat.element ? ui.chat.element[0] : null);
    const chatLog = targetElement?.querySelector("#chat-log");
    if (!chatLog) {
      return false;
    }

    const containerHeight = chatLog.clientHeight;

    let totalMessagesHeight = 0;
    chatLog
      .querySelectorAll(".message:not([style*='display: none'])")
      .forEach((element) => {
        totalMessagesHeight += element.offsetHeight;
      });

    return totalMessagesHeight > containerHeight;
  }

  /**
   * Chat scroll event handler
   * @param {Event} event
   * @private
   */
  static _onScroll(event) {
    const chatLog = event.currentTarget;
    if (!chatLog || typeof chatLog.closest !== "function") return;

    const scope =
      chatLog.closest(".chat-popout") || document.getElementById("chat");
    if (!scope) return;

    if (MultipleChatTabs.isOverflow(scope) && this._isScrollTop(chatLog)) {
      this._onScrollTop(scope);
    }
  }

  /**
   * Check scroll position
   * @param {HTMLElement} chatLog
   * @returns {boolean}
   * @private
   */
  static _isScrollTop(chatLog) {
    if (!chatLog) return false;

    const SCROLL_THRESHOLD_PERCENT = 0.05;
    const thresholdPx = chatLog.clientHeight * SCROLL_THRESHOLD_PERCENT;

    return chatLog.scrollTop <= thresholdPx;
  }

  /**
   * Scroll top event handler
   * @param {HTMLElement} scope
   * @private
   */
  static _onScrollTop(scope) {
    // Loadable check
    this._requestLoad(scope);
  }

  /**
   * check load message
   * @private
   */
  static _updateLoaedMessage(mutations) {
    let isLoadMessage = false;
    let targetElement = null;

    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        const addedMessages = Array.from(mutation.addedNodes).filter(
          (node) =>
            node.nodeType === Node.ELEMENT_NODE &&
            node.tagName === "LI" &&
            node.classList.contains("message")
        );
        if (addedMessages.length > 0) {
          if (
            !mutation.previousSibling ||
            mutation.target.firstElementChild === addedMessages[0]
          ) {
            isLoadMessage = true;
            targetElement = mutation.target;
            break;
          }
        }
      }
    }

    if (isLoadMessage) {
      // Update oldestLoadMessage
      const scope =
        targetElement.closest(".app") || document.getElementById("chat");
      if (!scope) return;

      const windowId = scope.id;
      const activeTabId = this.activeFilter;

      if (windowId && activeTabId) {
        if (!this.oldestLoadMessage[windowId]) {
          this.oldestLoadMessage[windowId] = {};
        }
        this.oldestLoadMessage[windowId][activeTabId] =
          this.getOldestLoadMessage(activeTabId, scope);
      }

      // Loadable check
      this._requestLoad(scope);
    }
  }

  /**
   * Scans alltab ID
   * @returns {Set<string>}
   */
  static scanAllTabId() {
    const allTabId = new Set();

    for (const message of game.messages) {
      const tabId = message.getFlag("multiple-chat-tabs", "sourceTab");
      if (tabId) {
        allTabId.add(tabId);
      }
    }
    return allTabId;
  }

  /**
   * Loadable check helper
   * @param {string} tabId
   * @param {HTMLElement} scope
   * @private
   */
  static _isLoadable(tabId, scope) {
    if (!tabId || !scope) return;

    const allTabs = this.getTabs();
    const tab = allTabs.find((t) => t.id === tabId);
    const tabLabel = tab ? tab.label : null;
    const oldestMessage = this.oldestMessage[tabId] || null;
    const windowId = scope.id;
    const oldestLoadMessage = this.oldestLoadMessage[windowId]?.[tabId] || null;
    const isOverflow = this.isOverflow(scope);
    const chatLog = scope.querySelector("#chat-log");
    const isScrollTop = this._isScrollTop(chatLog);
    const autoLoad = game.settings.get(
      "multiple-chat-tabs",
      "auto-load-messages"
    );

    // Check message loadable
    let isLoadable = false;
    if (oldestMessage && oldestMessage !== oldestLoadMessage && isScrollTop)
      isLoadable = true;

    // Show button or Auto load message
    const loadButton = scope.querySelector(".mct-load-more-container");
    if (loadButton) {
      if (isLoadable) {
        if (autoLoad) {
          this.loadMessage({ scope });
        } else {
          loadButton.style.display = "block";
        }
      } else {
        loadButton.style.display = "none";
      }
    }
  }
}
