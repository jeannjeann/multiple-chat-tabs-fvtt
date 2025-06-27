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
    const tabs = MultipleChatTabs.getTabs();
    const defaultTabId =
      tabs.find((t) => t.isDefault)?.id ||
      (tabs.length > 0 ? tabs[0].id : null);

    data.tabs = tabs.map((tab) => ({
      ...tab,
      isDefault: tab.id === defaultTabId,
    }));
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

    // Prevent dragging the default tab
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

    const dropTarget = event.currentTarget.closest(".tab-item");
    if (!dropTarget || dropTarget === draggedElement[0]) return;

    if (dropTarget.dataset.isDefault === "true") {
      ui.notifications.warn(
        game.i18n.localize("MCT.notifications.cannotDragDefault")
      );
      return;
    }

    dropTarget.before(draggedElement[0]);

    let tabs = MultipleChatTabs.getTabs();
    const defaultTab = tabs.find((t) => t.isDefault) || tabs[0];
    const otherTabs = tabs.filter((t) => t.id !== defaultTab.id);

    const newOrder = [];
    this.element
      .find(".tab-item:not([data-is-default='true'])")
      .each((i, el) => {
        const tabId = $(el).data("tab-id");
        const foundTab = otherTabs.find((t) => t.id === tabId);
        if (foundTab) newOrder.push(foundTab);
      });

    const finalTabs = [defaultTab, ...newOrder];

    finalTabs.forEach((tab, index) => {
      tab.isDefault = index === 0;
      if (!tab.isDefault) delete tab.isDefault;
    });

    await game.settings.set(
      "multiple-chat-tabs",
      "tabs",
      JSON.stringify(finalTabs)
    );
    this.render(true);
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
        ok: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize("OK"),
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
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("Cancel"),
        },
      },
      default: "cancel",
    });
    dialog.render(true);
  }

  _onEditTab(event) {
    event.preventDefault();
    const tabId = $(event.currentTarget).closest(".tab-item").data("tabId");
    if (tabId) {
      new TabDetailSettings(tabId).render(true);
    }
  }

  _onDeleteTab(event) {
    event.preventDefault();
    const tabItem = $(event.currentTarget).closest(".tab-item");
    const tabId = tabItem.data("tabId");
    MultipleChatTabs._onDeleteTabRequested(tabId);
  }

  async _updateObject(event, formData) {
    return;
  }
}

// TabDetailSetting Class
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
      width: 480,
      height: "auto",
      resizable: true,
    });
  }

  getData(options) {
    const data = super.getData(options);
    const allTabs = MultipleChatTabs.getTabs();
    const tab = allTabs.find((t) => t.id === this.tabId);
    if (!tab) return data;
    data.tab = tab;

    const messageTypes = {
      ic: "IC",
      ooc: "OOC",
      roll: "Roll",
      other: "Other",
    };
    const baseOptions = [
      { key: "none", label: "MCT.forceOptions.none" },
      { key: "duplicate", label: "MCT.forceOptions.duplicate" },
      { key: "move", label: "MCT.forceOptions.move" },
    ];
    const otherTabs = allTabs.filter((t) => t.id !== this.tabId);
    data.forceSettings = {};
    const currentForceSettings = tab.force || {};

    for (const type in messageTypes) {
      const movingTab = otherTabs.find((t) => t.force?.[type] === "move");
      const dynamicOptions = baseOptions.map((opt) => {
        const isDisabled =
          (opt.key === "move" || opt.key === "duplicate") && movingTab;
        let tooltip = null;
        if (isDisabled) {
          tooltip = game.i18n.format(
            "MCT.detailSettings.tooltips.moveDisabled",
            {
              tabName: movingTab.label,
            }
          );
        }
        return {
          ...opt,
          selected: (currentForceSettings[type] || "none") === opt.key,
          disabled: isDisabled,
          tooltip: tooltip,
        };
      });
      data.forceSettings[type] = {
        options: dynamicOptions,
        typeLabel: `MCT.messageTypes.${type}`,
      };
    }
    return data;
  }

  async _updateObject(event, formData) {
    if (!this.tabId) return;

    const allTabs = MultipleChatTabs.getTabs();
    const tabIndex = allTabs.findIndex((t) => t.id === this.tabId);
    if (tabIndex === -1) return;

    const expandedData = foundry.utils.expandObject(formData);

    const forceSettings = expandedData.force || {};
    for (const key in forceSettings) {
      if (forceSettings[key] === "none") {
        delete forceSettings[key];
      }
    }

    allTabs[tabIndex].label = expandedData.label;

    if (Object.keys(forceSettings).length > 0) {
      allTabs[tabIndex].force = forceSettings;
    } else {
      delete allTabs[tabIndex].force;
    }

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
