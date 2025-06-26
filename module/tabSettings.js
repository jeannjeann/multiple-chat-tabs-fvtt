import { MultipleChatTabs } from "./multipleChatTabs.js";

// TabSettings Class
export class TabSettings extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize("MCT.settings.windowTitle"),
      id: "multiple-chat-tabs-settings",
      template: "modules/multiple-chat-tabs/templates/tab-settings.hbs",
      width: 280,
      height: "auto",
      resizable: true,
      classes: ["mct-settings-sheet"],
      dragDrop: [{ dragSelector: ".drag-handle", dropSelector: ".tab-item" }],
      submitOnChange: false,
      submitOnClose: false,
      closeOnSubmit: false,
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
    html.find(".reset-settings").on("click", this._onResetSettings.bind(this));
    html.find(".delete-tab").on("click", this._onDeleteTab.bind(this));
    html.find(".edit-tab").on("click", this._onEditTab.bind(this));
  }

  async _onDragStart(event) {
    const item = event.currentTarget.closest(".tab-item");
    if (!item) return;

    const tabId = item.dataset.tabId;
    const tabData = MultipleChatTabs.getTabs().find((t) => t.id === tabId);

    // Default tab
    if (tabData?.isDefault) {
      event.preventDefault();
      ui.notifications.warn(
        game.i18n.localize("MCT.notifications.cannotDragDefault")
      );
      return;
    }

    const dragData = {
      id: tabId,
      type: "MCTTab",
    };
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  async _onDrop(event) {
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
      if (data.type !== "MCTTab") return;
    } catch (err) {
      return;
    }

    const draggedElement = this.element.find(
      `.tab-item[data-tab-id="${data.id}"]`
    );
    if (!draggedElement.length) return;

    const dropTarget = event.currentTarget;
    if (!dropTarget || dropTarget === draggedElement[0]) return;

    dropTarget.before(draggedElement[0]);

    const newTabs = [];
    this.element.find(".tab-list .tab-item").each((index, el) => {
      const element = $(el);
      const label = element.find(".tab-label").text();
      const tabId = element.data("tabId");

      if (label && tabId) {
        newTabs.push({
          id: tabId,
          label: label,
        });
      }
    });

    await game.settings.set(
      "multiple-chat-tabs",
      "tabs",
      JSON.stringify(newTabs),
      { noRefresh: true }
    );
  }

  async _onAddTab(event) {
    event.preventDefault();
    const tabs = MultipleChatTabs.getTabs();
    const newTabName =
      game.i18n.localize("MCT.settings.defaults.newTabName") || "New Tab";

    const newTab = {
      id: `tab-${foundry.utils.randomID(16)}`,
      label: newTabName,
    };

    tabs.push(newTab);

    await game.settings.set("multiple-chat-tabs", "tabs", JSON.stringify(tabs));
    this.render(true);
  }

  async _onResetSettings(event) {
    event.preventDefault();
    const dialog = new Dialog({
      title: game.i18n.localize("MCT.dialog.reset.title"),
      content: `<p>${game.i18n.localize("MCT.dialog.reset.content")}</p>`,
      buttons: {
        yes: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize("MCT.yes"),
          callback: async () => {
            const defaultSettings = game.settings.settings.get(
              "multiple-chat-tabs.tabs"
            ).default;
            await game.settings.set(
              "multiple-chat-tabs",
              "tabs",
              defaultSettings
            );
            this.render(true);
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

  async _onEditTab(event) {
    event.preventDefault();
    const tabId = $(event.currentTarget).closest(".tab-item").data("tabId");
    if (tabId) {
      new TabDetailSettings(tabId).render(true);
    }
  }

  async _onDeleteTab(event) {
    event.preventDefault();
    const tabItem = $(event.currentTarget).closest(".tab-item");
    const tabId = tabItem.data("tabId");
    MultipleChatTabs._onDeleteTabRequested(tabId);
  }

  async _updateObject(event, formData) {
    return;
  }
}

// Tab details setting
export class TabDetailSettings extends FormApplication {
  constructor(tabId, options = {}) {
    super(options);
    this.tabId = tabId;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize("MCT.detailSettings.windowTitle"),
      id: "multiple-chat-tabs-detail-settings",
      template: "modules/multiple-chat-tabs/templates/tab-detail-settings.hbs",
      width: 400,
      height: "auto",
      resizable: true,
    });
  }

  getData(options) {
    const data = super.getData(options);
    const allTabs = MultipleChatTabs.getTabs();
    data.tab = allTabs.find((t) => t.id === this.tabId);
    return data;
  }

  async _updateObject(event, formData) {
    if (!this.tabId) return;

    const allTabs = MultipleChatTabs.getTabs();
    const tabIndex = allTabs.findIndex((t) => t.id === this.tabId);
    if (tabIndex === -1) return;

    allTabs[tabIndex].label = formData.label;

    await game.settings.set(
      "multiple-chat-tabs",
      "tabs",
      JSON.stringify(allTabs)
    );
  }

  /**
   * @override
   */
  async close(options) {
    await super.close(options);

    const mainSettings = Object.values(ui.windows).find(
      (w) => w.id === "multiple-chat-tabs-settings"
    );

    if (mainSettings) {
      mainSettings.render(true);
    }
  }
}
