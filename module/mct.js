class MultipleChatTabs {
  // Set default tab
  static activeFilter = "tab1";

  /**
   * Add tabs UI
   * @param {jQuery} html
   */
  static async addTabs(html) {
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
      {}
    );
    const tabsElement = $(tabsHtml);

    tabsElement.find(".item").removeClass("active");
    tabsElement
      .find(`.item[data-filter="${this.activeFilter}"]`)
      .addClass("active");

    tabsElement.find(".item").on("click", this._onTabClick.bind(this));
    html.find("#chat-log").before(tabsElement);
  }

  /**
   * Click event handler
   * @param {Event} event
   */
  static _onTabClick(event) {
    event.preventDefault();
    const clickedFilter = event.currentTarget.dataset.filter;

    if (this.activeFilter === clickedFilter) return;

    this.activeFilter = clickedFilter;

    const nav = $(event.currentTarget).closest(".multiple-chat-tabs-nav");
    nav.find(".item").removeClass("active");
    $(event.currentTarget).addClass("active");

    this.applyFilter();
  }

  /**
   * Separate chat log and show
   * @param {jQuery} [scope]
   */
  static applyFilter(scope) {
    const chatLog = scope ? scope.find("#chat-log") : $("#chat-log");
    if (!chatLog.length) return;

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

      if (sourceTab) {
        show = sourceTab === this.activeFilter;
      } else {
        show = this.activeFilter === "tab1";
      }

      messageElement.toggle(show);
    });

    if (ui.chat) {
      ui.chat.scrollBottom();
    }
  }
}

/**
 * Initialize module
 */
Hooks.once("init", async function () {
  const templatePaths = ["modules/multiple-chat-tabs/templates/chat-tabs.hbs"];
  await loadTemplates(templatePaths);
  console.log("Chat Filter Tabs | Templates pre-loaded.");

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
  });

  Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
    message.updateSource({
      "flags.multiple-chat-tabs.sourceTab": MultipleChatTabs.activeFilter,
    });
  });
});
