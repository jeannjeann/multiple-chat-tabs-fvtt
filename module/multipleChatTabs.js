import { MessageFilter } from "./messageFilter.js";

// MultipleChatTabs Class
export class MultipleChatTabs {
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
   * @param {jQuery} html
   */
  static async refreshTabUI(html) {
    html.find(".mct-container").remove();

    let tabs = this.getTabs();
    const currentUser = game.user;

    // Whisper tab filter
    tabs = tabs.filter((tab) => {
      if (!tab.isWhisperTab) {
        return true;
      }
      return tab.whisperTargets?.includes(currentUser.id);
    });

    if (tabs.length === 0) {
      html.find("#chat-log .message").show();
      if (ui.chat) ui.chat.scrollBottom();
      return;
    }
    if (!tabs.some((t) => t.id === this.activeFilter)) {
      this.activeFilter = tabs[0]?.id || null;
    }

    // Initialize default tab's property
    const initialActiveTabId = this.activeFilter;
    if (initialActiveTabId) {
      const windowId = html.attr("id");
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

    const tabsHtml = await renderTemplate(
      "modules/multiple-chat-tabs/templates/chat-tabs.hbs",
      { tabs: processedTabs, showCount: showCount, isGM: isGM }
    );
    const tabsElement = $(tabsHtml);
    tabsElement
      .find(`.item[data-filter="${this.activeFilter}"]`)
      .addClass("active");
    html.find("#chat-log").after(tabsElement);

    // Activate listener
    this._activateTabListeners(html);
    this.applyFilter(html);
    this._adjustScrollButtonPosition();
    this._scrollActiveTab(html);
  }

  /**
   * Tab UI helper
   * @param {jQuery} html
   * @private
   */
  static _activateTabListeners(html) {
    // Tab click listener
    html
      .off("click", ".multiple-chat-tabs-nav .item")
      .on(
        "click",
        ".multiple-chat-tabs-nav .item",
        this._onTabClick.bind(this)
      );

    // Context menu listener
    $(".mct-context-menu").remove();

    html
      .off("contextmenu", ".multiple-chat-tabs-nav .item")
      .on("contextmenu", ".multiple-chat-tabs-nav .item", (event) => {
        if (!game.user.isGM) return;
        event.preventDefault();
        event.stopPropagation();

        $(".mct-context-menu").remove();

        const tabElement = $(event.currentTarget);
        const tabId = tabElement.data("filter");
        if (!tabId) return;

        const allTabs = this.getTabs();
        const tab = allTabs.find((t) => t.id === tabId);
        if (!tab) return;

        const isDefaultTab = allTabs.findIndex((t) => t.id === tabId) === 0;

        // Menu items
        const menuItems = [];
        menuItems.push(
          `<li data-action="edit"><i class="fas fa-cog"></i> ${game.i18n.localize(
            "MCT.context.settings"
          )}</li>`
        );
        if (!isDefaultTab) {
          menuItems.push(
            `<li data-action="delete"><i class="fas fa-trash"></i> ${game.i18n.localize(
              "MCT.context.delete"
            )}</li>`
          );
        }

        const menu = $(`<ul class="mct-context-menu"></ul>`).html(
          menuItems.join("")
        );
        $("body").append(menu);

        // Position Adjust
        const menuWidth = menu.outerWidth();
        const menuHeight = menu.outerHeight();
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        let top = event.clientY;
        let left = event.clientX;

        if (left + menuWidth > windowWidth) {
          left = windowWidth - menuWidth - 5;
        }
        if (top + menuHeight > windowHeight) {
          top = windowHeight - menuHeight - 5;
        }
        menu.css({
          position: "fixed",
          top: `${top}px`,
          left: `${left}px`,
        });

        // Menu click listeners
        menu.find("li").on("click", (e) => {
          const action = $(e.currentTarget).data("action");
          if (action === "edit") {
            Hooks.call("mct:requestTabEdit", tabId);
          } else if (action === "delete") {
            this._onDeleteTabRequested(tabId);
          }
          menu.remove();
        });

        const closeMenu = () => menu.remove();
        $(window).one("click", closeMenu);
        $(window).one("contextmenu", closeMenu);
      });

    // Message Scroll listeners
    const scroller = html.find(".mct-scroller");
    if (!scroller.length) return;
    this.updateScrollButtons(html);

    html.off("click", ".scroll-btn").on("click", ".scroll-btn", (event) => {
      const direction = $(event.currentTarget).hasClass("left") ? -1 : 1;
      const scrollAmount = scroller.width() * 0.7;
      scroller.scrollLeft(scroller.scrollLeft() + scrollAmount * direction);
    });

    // Tabbar scroll listeners
    scroller.off("scroll").on("scroll", () => this.updateScrollButtons(html));
    scroller.off("wheel").on("wheel", (event) => {
      event.preventDefault();
      const delta = event.originalEvent.deltaX || event.originalEvent.deltaY;
      scroller.scrollLeft(scroller.scrollLeft() + delta);
    });

    // Add tab button listeners
    html
      .off("click", ".add-tab-btn")
      .on("click", ".add-tab-btn", this._onAddTabClick.bind(this));

    // Add tab button context menu listener
    html
      .off("contextmenu", ".add-tab-btn")
      .on("contextmenu", ".add-tab-btn", (event) => {
        if (!game.user.isGM) return;
        event.preventDefault();
        event.stopPropagation();

        $(".mct-context-menu").remove();

        const menuItems = [
          `<li data-action="settings"><i class="fas fa-tasks"></i> ${game.i18n.localize(
            "MCT.context.tabSettings"
          )}</li>`,
        ];

        const menu = $(`<ul class="mct-context-menu"></ul>`).html(
          menuItems.join("")
        );
        $("body").append(menu);

        const menuWidth = menu.outerWidth();
        const menuHeight = menu.outerHeight();
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        let top = event.clientY;
        let left = event.clientX;

        if (left + menuWidth > windowWidth) {
          left = windowWidth - menuWidth - 5;
        }
        if (top + menuHeight > windowHeight) {
          top = windowHeight - menuHeight - 5;
        }
        menu.css({ position: "fixed", top: `${top}px`, left: `${left}px` });

        menu.find("li[data-action='settings']").on("click", (e) => {
          const menuSetting = game.settings.menus.get(
            "multiple-chat-tabs.tab-settings"
          );
          if (menuSetting) {
            const app = new menuSetting.type();
            app.render(true);
          }
          menu.remove();
        });

        const closeMenu = () => menu.remove();
        $(window).one("click", closeMenu);
        $(window).one("contextmenu", closeMenu);
      });

    // Message load button listener
    html
      .off("click", ".mct-load-more-container a")
      .on("click", ".mct-load-more-container a", (event) => {
        event.preventDefault();
        this.loadMessage({ scope: html });
      });
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
    event.preventDefault();
    const appElement = $(event.currentTarget).closest(".app");
    const clickedTab = $(event.currentTarget);
    const clickedFilter = clickedTab.data("filter");

    if (MultipleChatTabs.activeFilter === clickedFilter) return;

    // Update oldestMessage and oldestLoadMessage
    const windowId = appElement.attr("id");
    if (!this.oldestMessage[clickedFilter]) {
      this.oldestMessage[clickedFilter] = this.getOldestMessage(clickedFilter);
    }
    if (!this.oldestLoadMessage[windowId]) {
      this.oldestLoadMessage[windowId] = {};
      this.oldestLoadMessage[windowId][clickedFilter] =
        this.getOldestLoadMessage(clickedFilter, appElement);
    }

    appElement
      .find(".multiple-chat-tabs-nav .item.active")
      .removeClass("active");
    clickedTab.addClass("active");

    MultipleChatTabs.activeFilter = clickedFilter;

    if (this.getUnreadCounts()[clickedFilter]) {
      await this.resetUnreadCount(clickedFilter);
      clickedTab.find(".unread-indicator").remove();
    }

    this.applyFilter(appElement);
    this._scrollActiveTab(appElement);
  }

  /**
   * Tab scroll
   * @param {jQuery} html
   */
  static updateScrollButtons(html) {
    const scroller = html.find(".mct-scroller");
    if (!scroller.length) return;

    const scrollLeft = scroller.scrollLeft();
    const scrollWidth = scroller[0].scrollWidth;
    const clientWidth = scroller[0].clientWidth;

    html.find(".scroll-btn.left").toggle(scrollLeft > 0);
    html
      .find(".scroll-btn.right")
      .toggle(scrollWidth - clientWidth - scrollLeft > 1);
  }

  /**
   * Ajust active tab position
   * @param {jQuery} [scope]
   * @private
   */
  static _scrollActiveTab(scope) {
    const container = scope || ui.chat.element;
    if (!container) return;

    const scrollerEl = container.find(".mct-scroller")[0];
    const activeTabEl = container.find(
      ".multiple-chat-tabs-nav .item.active"
    )[0];
    if (!scrollerEl || !activeTabEl) return;

    const scrollerRect = scrollerEl.getBoundingClientRect();
    const activeTabRect = activeTabEl.getBoundingClientRect();
    const leftButtonWidth =
      container.find(".scroll-btn.left:visible").outerWidth(true) || 0;
    const rightButtonWidth =
      container.find(".scroll-btn.right:visible").outerWidth(true) || 0;
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
          icon: '<i class="fas fa-trash"></i>',
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
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("Cancel"),
        },
      },
      default: "cancel",
    });
    dialog.render(true);
  }

  /**
   * Separate message
   * @param {jQuery} [scope]
   * @param {object} [options={}]
   * @param {boolean} [options.scroll=true]
   */
  static applyFilter(scope, { scroll = true } = {}) {
    const chatLog = scope ? scope.find("#chat-log") : $("#chat-log");
    if (!chatLog.length) return;

    const messages = chatLog.find(".message");
    messages.each((i, el) => {
      this.applyFilterToMessage($(el));
    });

    if (scroll && ui.chat) {
      ui.chat.scrollBottom();
    }
  }

  /**
   * Filtering message
   * @param {jQuery} messageElement
   */
  static applyFilterToMessage(messageElement) {
    const allTabs = this.getTabs();
    const message = game.messages.get(messageElement.data("messageId"));

    const show = MessageFilter.filterMessage(
      message,
      allTabs,
      this.activeFilter
    );

    messageElement.toggle(show);
  }
  /**
   * Scroll to bottom button shift
   * @param {jQuery} html
   * @private
   */
  static _adjustScrollButtonPosition() {
    const jumpToBottomContainer = $(".jump-to-bottom");
    if (!jumpToBottomContainer.length) return;

    const mctContainer = $("#chat .mct-container");

    if (mctContainer.length > 0) {
      const tabBarHeight = mctContainer.outerHeight(true);

      jumpToBottomContainer.css({
        transform: `translateY(-${tabBarHeight}px)`,
        transition: "transform 0.2s ease-in-out",
      });
    } else {
      jumpToBottomContainer.css("transform", "");
    }
  }

  /**
   * Get Oldest Message ID
   * @param {string} tabId
   * @returns {string|null}
   */
  static getOldestMessage(tabId) {
    if (!tabId) return null;
    const allTabs = this.getTabs();
    if (allTabs.length === 0) return null;

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
   * @param {jQuery} [scope=ui.chat.element]
   * @returns {string|null}
   */
  static getOldestLoadMessage(tabId, scope) {
    if (!tabId) return null;
    const targetElement = scope || ui.chat.element;
    const chatLog = targetElement.find("#chat-log");
    if (!chatLog || !chatLog.length) return null;
    const allTabs = this.getTabs();
    if (allTabs.length === 0) return null;

    const messageElements = chatLog.find(".message");
    for (let i = 0; i < messageElements.length; i++) {
      const el = messageElements[i];
      const messageId = $(el).data("messageId");
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
   * @param {jQuery} [options.scope=null]
   */
  static async loadMessage({ scope = null } = {}) {
    const chat = scope
      ? Object.values(ui.windows).find((w) => w.element[0] === scope[0]) ??
        ui.chat
      : ui.chat;
    if (!chat) return;

    const chatLog = chat.element.find("#chat-log");
    if (!chatLog.length) return;

    const oldScrollHeight = chatLog[0].scrollHeight;
    const oldScrollTop = chatLog.scrollTop();

    const batchSize = game.settings.get(
      "multiple-chat-tabs",
      "load-batch-size"
    );
    await chat._renderBatch(chat.element, batchSize);

    this.applyFilter(chat.element, { scroll: false });

    setTimeout(() => {
      const newScrollHeight = chatLog[0].scrollHeight;
      const heightDifference = newScrollHeight - oldScrollHeight;
      const newScrollTop = oldScrollTop + heightDifference;

      chatLog.scrollTop(Math.max(0, newScrollTop));
    }, 50);
  }

  /**
   * Message overflow check
   * @param {jQuery} [scope=ui.chat.element]
   * @returns {boolean}
   */
  static isOverflow(scope) {
    const targetElement = scope || ui.chat.element;
    const chatLog = targetElement.find("#chat-log");
    if (!chatLog || !chatLog.length) {
      return false;
    }

    const containerHeight = chatLog[0].clientHeight;

    let totalMessagesHeight = 0;
    chatLog.find(".message:visible").each((index, element) => {
      totalMessagesHeight += element.offsetHeight;
    });

    return totalMessagesHeight > containerHeight;
  }

  /**
   * Check scroll position
   * @param {number} thresholdPx
   * @private
   */
  static _onScrollToTop(thresholdPx) {
    console.log(
      `[MCT-Debug] Scrolled near the top (within ${Math.round(thresholdPx)}px)!`
    );
  }

  /**
   * check load message
   * @private
   */
  static _updateLoaedMessage() {
    console.log(`[MCT-Debug] Chat log DOM changed.`);
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
}
