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

  // Set default tab
  static activeFilter = null;

  /**
   * Refresh tab UI
   * @param {jQuery} html
   */
  static async refreshTabUI(html) {
    html.find(".mct-container").remove();

    const tabs = this.getTabs();
    if (tabs.length === 0) {
      html.find("#chat-log .message").show();
      if (ui.chat) ui.chat.scrollBottom();
      return;
    }
    if (!tabs.some((t) => t.id === this.activeFilter)) {
      this.activeFilter = tabs[0]?.id || null;
    }

    const tabsHtml = await renderTemplate(
      "modules/multiple-chat-tabs/templates/chat-tabs.hbs",
      { tabs: tabs }
    );
    const tabsElement = $(tabsHtml);

    tabsElement
      .find(`.item[data-filter="${this.activeFilter}"]`)
      .addClass("active");

    html.find("#chat-log").after(tabsElement);

    this._activateTabListeners(html);
    this.applyFilter(html);
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

    const scroller = html.find(".mct-scroller");
    if (!scroller.length) return;

    this.updateScrollButtons(html);

    // Scroll button click listeners
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
  }

  /**
   * Click event handler
   * @param {Event} event
   */
  static _onTabClick(event) {
    event.preventDefault();
    const clickedFilter = event.currentTarget.dataset.filter;

    if (MultipleChatTabs.activeFilter === clickedFilter) return;

    MultipleChatTabs.activeFilter = clickedFilter;

    const nav = $(event.currentTarget).closest(".multiple-chat-tabs-nav");
    nav.find(".item").removeClass("active");
    $(event.currentTarget).addClass("active");

    const appElement = $(event.currentTarget).closest(".app");
    MultipleChatTabs.applyFilter(appElement);
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
    };

    tabs.push(newTab);
    this.activeFilter = newTab.id;
    await game.settings.set("multiple-chat-tabs", "tabs", JSON.stringify(tabs));
  }

  /**
   * Separate chat log and show
   * @param {jQuery} [scope]
   */
  static applyFilter(scope) {
    const chatLog = scope ? scope.find("#chat-log") : $("#chat-log");
    if (!chatLog.length) return;

    // Get tabID
    const tabs = this.getTabs();
    if (tabs.length === 0) {
      chatLog.find(".message").show();
      if (ui.chat) ui.chat.scrollBottom();
      return;
    }
    const validTabIds = new Set(tabs.map((t) => t.id));
    const firstTabId = tabs[0]?.id;

    const messages = chatLog.find(".message");

    messages.each((i, el) => {
      const messageElement = $(el);
      const message = game.messages.get(messageElement.data("messageId"));

      if (!message) {
        messageElement.show();
        return;
      }

      let show = false;
      const sourceTab = message.getFlag("multiple-chat-tabs", "sourceTab");

      // Check tab existing
      if (sourceTab && validTabIds.has(sourceTab)) {
        show = sourceTab === this.activeFilter;
      } else {
        // No Filter message to show default tab
        show = this.activeFilter === firstTabId;
      }

      messageElement.toggle(show);
    });

    if (ui.chat) {
      ui.chat.scrollBottom();
    }
  }
}
