// MultipleChatTabs Class
class MultipleChatTabs {
  // Helper to get configured tabs
  static getTabs() {
    const tabString = game.settings.get("multiple-chat-tabs", "tabs") || "Tab1";
    return tabString
      .split(",")
      .map((label, index) => ({
        id: `tab-${index}`,
        label: label.trim(),
      }))
      .filter((tab) => tab.label);
  }

  // Set default tab
  static activeFilter = "tab-0";

  /**
   * Add tabs UI
   * @param {jQuery} html
   */
  static async addTabs(html) {
    const tabs = this.getTabs();
    if (tabs.length === 0) return;

    if (!tabs.some((t) => t.id === this.activeFilter)) {
      this.activeFilter = tabs[0]?.id || "tab-0";
    }

    const existingTabs = html.find(".multiple-chat-tabs-nav");
    if (existingTabs.length > 0) {
      existingTabs.find(".item").removeClass("active");
      existingTabs
        .find(`.item[data-filter="${this.activeFilter}"]`)
        .addClass("active");
      return;
    }

    const tabsHtml = await renderTemplate(
      "modules/multiple-chat-tabs/templates/chat-tabs.hbs",
      { tabs: tabs }
    );
    const tabsElement = $(tabsHtml);

    tabsElement.find(".item").removeClass("active");
    tabsElement
      .find(`.item[data-filter="${this.activeFilter}"]`)
      .addClass("active");

    html.find("#chat-log").after(tabsElement);
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
    const validTabIds = new Set(tabs.map((t) => t.id));

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
        show = this.activeFilter === "tab-0";
      }

      messageElement.toggle(show);
    });

    if (ui.chat) {
      ui.chat.scrollBottom();
    }
  }
}

// TabSettings Class
class TabSettings extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize("MCT.Settings.WindowTitle"),
      id: "multiple-chat-tabs-settings",
      template: "modules/multiple-chat-tabs/templates/tab-settings.hbs",
      width: 400,
      height: "auto",
      resizable: true,
    });
  }

  getData(options) {
    const data = super.getData(options);
    data.tabs = game.settings.get("multiple-chat-tabs", "tabs");
    return data;
  }

  async _updateObject(event, formData) {
    await game.settings.set("multiple-chat-tabs", "tabs", formData.tabs);
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
    default: "Tab1,Tab2,Tab3,Tab4",
    onChange: () => {
      if (ui.chat) {
        ui.chat.render();
      }
    },
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
    await MultipleChatTabs.addTabs(html);
    MultipleChatTabs.applyFilter(html);

    // Click listener
    html.off("click", ".multiple-chat-tabs-nav .item");
    html.on(
      "click",
      ".multiple-chat-tabs-nav .item",
      MultipleChatTabs._onTabClick
    );
  });

  Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
    message.updateSource({
      "flags.multiple-chat-tabs.sourceTab": MultipleChatTabs.activeFilter,
    });
  });
});
