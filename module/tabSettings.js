// TabSettings Class
export class TabSettings extends FormApplication {
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
    const newTabName =
      game.i18n.localize("MCT.Settings.NewTabDefaultName") || "New Tab";
    const newTabHtml = `
      <li class="form-group tab-item" data-tab-id="${newTabId}">
        <i class="fas fa-bars drag-handle"></i>
        <input type="text" name="label" value="${newTabName}" placeholder="${game.i18n.localize(
      "MCT.Settings.TabNamePlaceholder"
    )}"/>
        <a class="delete-tab"><i class="fas fa-trash"></i></a>
      </li>
    `;
    this.element.find(".tab-list").append(newTabHtml);
    this.setPosition();
  }

  _onDeleteTab(event) {
    event.preventDefault();
    $(event.currentTarget).closest(".tab-item").remove();
    this.setPosition();
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
