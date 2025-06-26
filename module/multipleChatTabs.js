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

    // Context menu listener
    // --- Start of Custom Context Menu ---
    // Remove any existing custom context menus before adding new ones
    $(".mct-context-menu").remove();

    html
      .off("contextmenu", ".multiple-chat-tabs-nav .item")
      .on("contextmenu", ".multiple-chat-tabs-nav .item", (event) => {
        event.preventDefault();
        event.stopPropagation();

        // Close any existing menus
        $(".mct-context-menu").remove();

        const tabElement = $(event.currentTarget);
        const tabId = tabElement.data("filter");
        if (!tabId) return;

        const tab = this.getTabs().find((t) => t.id === tabId);
        if (!tab) return;

        // Build menu items
        const menuItems = [];
        menuItems.push(
          `<li data-action="edit"><i class="fas fa-cog"></i> ${game.i18n.localize(
            "MCT.context.settings"
          )}</li>`
        );
        if (!tab.isDefault) {
          menuItems.push(
            `<li data-action="delete"><i class="fas fa-trash"></i> ${game.i18n.localize(
              "MCT.context.delete"
            )}</li>`
          );
        }

        // Create menu element, add to body and position it
        const menu = $(`<ul class="mct-context-menu"></ul>`).html(
          menuItems.join("")
        );
        $("body").append(menu);

        // --- Start of Position Adjustment Logic ---
        const menuWidth = menu.outerWidth();
        const menuHeight = menu.outerHeight();
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();

        let top = event.clientY;
        let left = event.clientX;

        // Adjust horizontal position if the menu goes off-screen to the right
        if (left + menuWidth > windowWidth) {
          left = windowWidth - menuWidth - 5; // 5px buffer
        }

        // Adjust vertical position if the menu goes off-screen to the bottom
        if (top + menuHeight > windowHeight) {
          top = windowHeight - menuHeight - 5; // 5px buffer
        }

        menu.css({
          position: "fixed",
          top: `${top}px`,
          left: `${left}px`,
        });
        // --- End of Position Adjustment Logic ---

        // Add click listeners for menu items
        menu.find("li").on("click", (e) => {
          const action = $(e.currentTarget).data("action");
          if (action === "edit") {
            Hooks.call("mct:requestTabEdit", tabId);
          } else if (action === "delete") {
            this._onDeleteTabRequested(tabId);
          }
          menu.remove(); // Close menu after action
        });

        // Add a one-time click listener to the window to close the menu
        const closeMenu = () => menu.remove();
        $(window).one("click", closeMenu);
        $(window).one("contextmenu", closeMenu); // Also close on another right click
      });
    // --- End of Custom Context Menu ---

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
   * Delete tab from context menu
   * @param {string} tabId The ID of the tab to delete.
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
      title: game.i18n.localize("MCT.dialog.delete.title"),
      content: game.i18n.format("MCT.dialog.delete.content", {
        name: tabData.label,
      }),
      buttons: {
        yes: {
          icon: '<i class="fas fa-trash"></i>',
          label: game.i18n.localize("MCT.yes"),
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
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("MCT.no"),
        },
      },
      default: "no",
    });
    dialog.render(true);
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
