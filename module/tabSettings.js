import { MultipleChatTabs } from "./multipleChatTabs.js";

// Include TabSettings Class, TabDetailSettings Class

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

  /**
   * Show all tab ID
   * @param {MouseEvent} event
   * @private
   */
  async _onScanTabId(event) {
    event.preventDefault();

    const currentTabs = MultipleChatTabs.getTabs();
    const allUsedIds = MultipleChatTabs.scanAllTabId();

    const existingIdItems = currentTabs.map((tab) => {
      return `<li><strong>${tab.label}</strong>: <code>${tab.id}</code></li>`;
    });

    const currentTabIds = new Set(currentTabs.map((t) => t.id));
    const orphanedIdItems = [...allUsedIds]
      .filter((id) => !currentTabIds.has(id))
      .map((id) => `<li><code>${id}</code></li>`);

    let content = "";
    if (existingIdItems.length > 0) {
      content += `<h3>${game.i18n.localize(
        "MCT.dialog.allTabID.currentTab"
      )}</h3><ul>${existingIdItems.join("")}</ul>`;
    }

    if (orphanedIdItems.length > 0) {
      if (content) content += "<hr>";
      content += `<h3>${game.i18n.localize(
        "MCT.dialog.allTabID.orphanedTab"
      )}</h3><p class="notes">${game.i18n.localize(
        "MCT.dialog.allTabID.orphanedTabHint"
      )}</p><ul>${orphanedIdItems.join("")}</ul>`;
    }

    if (!content && existingIdItems.length === 0) {
      content = `<p>${game.i18n.localize(
        "MCT.dialog.allTabID.noneConfigured"
      )}</p>`;
    }

    new Dialog({
      title: game.i18n.localize("MCT.dialog.allTabID.title"),
      content: `<div class="mct-tabscan-results">${content}</div>`,
      buttons: {
        close: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("Close"),
        },
      },
      default: "close",
      render: (html) => {
        // copy ID to clipboard
        html.find("code").on("click", (ev) => {
          const target = ev.currentTarget;
          const text = target.innerText;
          navigator.clipboard.writeText(text).then(() => {
            target.style.transition = "background-color 0.1s ease-in-out";
            target.style.backgroundColor = "var(--color-bg-success)";
            setTimeout(() => {
              target.style.backgroundColor = "";
            }, 300);
          });
          ui.notifications.info(
            game.i18n.format("MCT.notifications.idCopied", { id: text })
          );
        });
      },
    }).render(true);
  }

  /**
   * @override
   */
  async _render(force, options) {
    await super._render(force, options);
    const windowTitle = this.element.find(".window-title");
    if (windowTitle.length) {
      windowTitle.find(".mct-scan-tabid").remove();
      const scanButton = $(
        `<a class="mct-scan-tabid" title="${game.i18n.localize(
          "MCT.settings.tooltips.tabIdList"
        )}">
           <i class="fas fa-passport"></i>
         </a>`
      );
      windowTitle.append(scanButton);
      scanButton.on("click", this._onScanTabId.bind(this));
    }
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
      width: 550,
      height: 550,
      resizable: true,
    });
  }

  getData(options) {
    const data = super.getData(options);
    const allTabs = MultipleChatTabs.getTabs();
    const tab = allTabs.find((t) => t.id === this.tabId);
    if (!tab) return data;
    data.tab = tab;

    // Whisper Setting
    tab.isWhisperTab = tab.isWhisperTab ?? false;
    tab.whisperTargets = tab.whisperTargets || [];
    const whisperTargetSet = new Set(tab.whisperTargets);

    data.users = game.users.map((user) => ({
      id: user.id,
      name: user.name,
      isTarget:
        whisperTargetSet.has(user.id) ||
        (user.isGM && tab.isWhisperTab && tab.whisperTargets.length === 0),
    }));

    const defaultTabId = allTabs[0]?.id;
    tab.isDefault = tab.id === defaultTabId;

    // Force setting
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

    // Save tab setting
    allTabs[tabIndex].label = expandedData.label;
    allTabs[tabIndex].isWhisperTab = expandedData.isWhisperTab ?? false;
    allTabs[tabIndex].showAllMessages = expandedData.showAllMessages ?? false;
    allTabs[tabIndex].forceOOC = expandedData.forceOOC ?? false;

    if (allTabs[tabIndex].isWhisperTab) {
      let targets = expandedData.whisperTargets;
      if (targets && !Array.isArray(targets)) targets = [targets];
      allTabs[tabIndex].whisperTargets = (targets || []).filter(Boolean);
    } else {
      allTabs[tabIndex].whisperTargets = [];
    }

    // Save force settings
    const forceSettings = expandedData.force || {};
    for (const key in forceSettings) {
      if (forceSettings[key] === "none") {
        delete forceSettings[key];
      }
    }
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
   * Edit ID button handler.
   * @param {MouseEvent} event
   * @private
   */
  async _onEditTabId(event) {
    event.preventDefault();

    new Dialog({
      title: game.i18n.localize("MCT.dialog.editTabId.title"),
      content: `<div class="form-group"><label>${game.i18n.localize(
        "MCT.dialog.editTabId.label"
      )}</label><input type="text" name="newId" value="${
        this.tabId
      }" style="flex-basis: 70%;"></div>`,
      buttons: {
        ok: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize("OK"),
          callback: async (html) => {
            const newId = html.find('input[name="newId"]').val().trim();

            if (!newId) {
              return ui.notifications.warn(
                game.i18n.localize("MCT.notifications.cannotBeEmpty")
              );
            }
            if (newId === this.tabId) return; // No change

            const allTabs = MultipleChatTabs.getTabs();
            if (allTabs.some((t) => t.id === newId)) {
              return ui.notifications.warn(
                game.i18n.format("MCT.notifications.alreadyExists", {
                  id: newId,
                })
              );
            }

            const tabIndex = allTabs.findIndex((t) => t.id === this.tabId);
            if (tabIndex === -1) return;

            allTabs[tabIndex].id = newId;

            if (MultipleChatTabs.activeFilter === this.tabId) {
              MultipleChatTabs.activeFilter = newId;
            }

            await game.settings.set(
              "multiple-chat-tabs",
              "tabs",
              JSON.stringify(allTabs)
            );

            this.tabId = newId;
            this.render(true);

            const mainSettings = Object.values(ui.windows).find(
              (w) => w.id === "multiple-chat-tabs-settings"
            );
            if (mainSettings) {
              mainSettings.render(true);
            }
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("Cancel"),
        },
      },
      default: "cancel",
    }).render(true);
  }

  /**
   * @override
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Whisper listener
    const whisperCheckbox = html.find("#isWhisperTab");
    const whisperOptions = html.find(".mct-whisper-options");
    const genericOptions = html.find(".mct-generic-options");

    whisperCheckbox.on("change", (event) => {
      const isChecked = $(event.currentTarget).is(":checked");
      whisperOptions.toggleClass("mct-hidden", !isChecked);
      genericOptions.toggleClass("mct-disabled", isChecked);
    });

    // Tab ID listener
    html
      .closest(".app")
      .find(".mct-edit-tabid")
      .attr(
        "title",
        game.i18n.format("MCT.detailSettings.tooltips.tabId", {
          tabId: this.tabId,
        })
      );
  }

  /**
   * @override
   */
  async _render(force, options) {
    await super._render(force, options);
    const windowTitle = this.element.find(".window-title");
    if (windowTitle.length) {
      windowTitle.find(".mct-edit-tabid").remove();
      const idButton = $(
        `<a class="mct-edit-tabid" title="${game.i18n.format(
          "MCT.detailSettings.tooltips.tabId",
          { tabId: this.tabId }
        )}">
            <i class="fas fa-passport"></i>
          </a>`
      );
      windowTitle.append(idButton);
      idButton.on("click", this._onEditTabId.bind(this));
    }
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
