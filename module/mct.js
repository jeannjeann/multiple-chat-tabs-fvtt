// MultipleChatTabs Class
class MultipleChatTabs {
  // Helper to get configured tabs
  static getTabs() {
    const tabString = game.settings.get("multiple-chat-tabs", "tabs");
    try {
      const tabs = JSON.parse(tabString);
      if (Array.isArray(tabs)) {
        return tabs.filter((tab) => tab.label);
      }
    } catch (e) {
      console.error("MCT error", e);
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
}

// TabSettings Class
class TabSettings extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize("MCT.Settings.WindowTitle"),
      id: "multiple-chat-tabs-settings",
      template: "modules/multiple-chat-tabs/templates/tab-settings.hbs",
      width: 450,
      height: "auto",
      resizable: true,
      classes: ["mct-settings-sheet"],
      dragDrop: [{ dragSelector: ".drag-handle", dropSelector: ".tab-item" }],
    });
  }

  getData(options) {
    const data = super.getData(options);
    data.tabs = MultipleChatTabs.getTabs();
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".add-tab").on("click", this._onAddTab.bind(this));
    html.find(".delete-tab").on("click", this._onDeleteTab.bind(this));
  }

  _onDrop(event) {
    const dragData = TextEditor.getDragEventData(event);
    const targetElement = $(event.target).closest(".tab-item");
    if (!targetElement.length) return;

    const draggedElement = this.element.find(`[data-tab-id="${dragData.id}"]`);
    if (draggedElement.length === 0) return;

    targetElement.before(draggedElement);
  }

  async _onAddTab(event) {
    event.preventDefault();
    const newTabId = `tab-${foundry.utils.randomID(16)}`;
    const newTabHtml = `
      <li class="form-group tab-item" data-tab-id="${newTabId}">
        <i class="fas fa-bars drag-handle"></i>
        <input type="text" name="label" value="New Tab" placeholder="${game.i18n.localize(
          "MCT.Settings.TabNamePlaceholder"
        )}"/>
        <a class="delete-tab"><i class="fas fa-trash"></i></a>
      </li>
    `;
    this.element.find(".tab-list").append(newTabHtml);
    this.setPosition(); // Recalculate form height
  }

  _onDeleteTab(event) {
    event.preventDefault();
    $(event.currentTarget).closest(".tab-item").remove();
    this.setPosition(); // Recalculate form height
  }

  async _updateObject(event, formData) {
    const newTabs = [];
    this.element.find(".tab-list .tab-item").each((index, el) => {
      const element = $(el);
      const label = element.find('input[name="label"]').val();
      if (label) {
        newTabs.push({
          id: element.data("tabId"),
          label: label,
        });
      }
    });

    await game.settings.set(
      "multiple-chat-tabs",
      "tabs",
      JSON.stringify(newTabs)
    );
  }
}

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
  game.settings.registerMenu("multiple-chat-tabs", "tab-settings", {
    name: "MCT.Settings.Menu.Name",
    label: "MCT.Settings.Menu.Label",
    hint: "MCT.Settings.Menu.Hint",
    icon: "fas fa-tasks",
    type: TabSettings,
    restricted: true,
  });
  game.settings.register("multiple-chat-tabs", "tabs", {
    scope: "world",
    config: false,
    type: String,
    default: JSON.stringify([
      { id: `tab-${foundry.utils.randomID(16)}`, label: "Tab1" },
      { id: `tab-${foundry.utils.randomID(16)}`, label: "Tab2" },
      { id: `tab-${foundry.utils.randomID(16)}`, label: "Tab3" },
      { id: `tab-${foundry.utils.randomID(16)}`, label: "Tab4" },
    ]),
    onChange: () => {
      setTimeout(() => {
        if (ui.chat && ui.chat.element) {
          MultipleChatTabs.refreshTabUI(ui.chat.element);
        }
      }, 100);
    },
  });

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
