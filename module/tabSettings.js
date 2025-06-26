import { MultipleChatTabs } from "./multipleChatTabs.js";

// TabSettings Class
export class TabSettings extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize("MCT.Settings.WindowTitle"),
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
    html.find(".delete-tab").on("click", this._onDeleteTab.bind(this));
    html.find(".edit-tab").on("click", this._onEditTab.bind(this));
  }

  async _onDrop(event) {
    super._onDrop(event);

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
      JSON.stringify(newTabs)
    );
  }

  async _onAddTab(event) {
    event.preventDefault();
    const tabs = MultipleChatTabs.getTabs();
    const newTabName =
      game.i18n.localize("MCT.Settings.NewTabDefaultName") || "New Tab";

    const newTab = {
      id: `tab-${foundry.utils.randomID(16)}`,
      label: newTabName,
    };

    tabs.push(newTab);

    await game.settings.set("multiple-chat-tabs", "tabs", JSON.stringify(tabs));
    this.render(true);
  }

  async _onDeleteTab(event) {
    event.preventDefault();
    const tabId = $(event.currentTarget).closest(".tab-item").data("tabId");
    if (!tabId) return;

    let tabs = MultipleChatTabs.getTabs();
    tabs = tabs.filter((t) => t.id !== tabId);

    await game.settings.set("multiple-chat-tabs", "tabs", JSON.stringify(tabs));
    this.render(true);
  }

  _onEditTab(event) {
    event.preventDefault();
    const tabId = $(event.currentTarget).closest(".tab-item").data("tabId");
    if (tabId) {
      new TabDetailSettings(tabId).render(true);
    }
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
      title: game.i18n.localize("MCT.DetailSettings.WindowTitle"),
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
