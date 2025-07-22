// MessageFilter Class
export class MessageFilter {
  /**
   * Message type helper
   * @param {ChatMessage} message
   * @returns {string}
   */
  static getMessageType(message) {
    const api = game.modules.get("multiple-chat-tabs").api;
    if (message.isRoll) return "roll";

    // core version check
    if (api.isV11()) {
      switch (message.type) {
        case CONST.CHAT_MESSAGE_TYPES.IC:
          return "ic";
        case CONST.CHAT_MESSAGE_TYPES.OOC:
          return "ooc";
        default:
          return "other";
      }
    } else {
      switch (message.style) {
        case CONST.CHAT_MESSAGE_STYLES.IC:
          return "ic";
        case CONST.CHAT_MESSAGE_STYLES.OOC:
          return "ooc";
        default:
          return "other";
      }
    }
  }

  /**
   * Show or hide rules by message type
   * @param {ChatMessage} message
   * @param {Array<object>} allTabs
   * @returns {Set<string>}
   */
  static getVisibleTabsForMessage(message, allTabs) {
    if (!message || allTabs.length === 0) return new Set();

    if (message.whisper.length > 0) {
      const whisperGroup = new Set(
        [message.author?.id, ...message.whisper].filter(Boolean)
      );

      const matchingWhisperTabs = allTabs.filter((tab) => {
        if (
          !tab.isWhisperTab ||
          !tab.whisperTargets ||
          tab.whisperTargets.length === 0
        ) {
          return false;
        }
        const tabTargets = new Set(tab.whisperTargets.filter(Boolean));

        return (
          tabTargets.size === whisperGroup.size &&
          [...whisperGroup].every((id) => tabTargets.has(id))
        );
      });
      if (matchingWhisperTabs.length > 0) {
        return new Set(matchingWhisperTabs.map((t) => t.id));
      }
    }

    // Move and duplicate logic
    const messageType = this.getMessageType(message);

    // Move logic
    const moveTarget = allTabs.find(
      (tab) => !tab.isWhisperTab && tab.force?.[messageType] === "move"
    );
    if (moveTarget) {
      return new Set([moveTarget.id]);
    }

    const visibleTabIds = new Set();
    const defaultTabId = allTabs[0]?.id;
    let sourceTabId = message.getFlag("multiple-chat-tabs", "sourceTab");

    const isValidSource =
      sourceTabId && allTabs.some((tab) => tab.id === sourceTabId);

    if (isValidSource) {
      visibleTabIds.add(sourceTabId);
    } else {
      const shouldFallback = game.settings.get(
        "multiple-chat-tabs",
        "showAloneMessageToDefaultTab"
      );
      if (shouldFallback && defaultTabId) {
        visibleTabIds.add(defaultTabId);
      }
    }

    // Duplicate logic
    const duplicateTargets = allTabs.filter(
      (tab) => !tab.isWhisperTab && tab.force?.[messageType] === "duplicate"
    );
    for (const target of duplicateTargets) {
      visibleTabIds.add(target.id);
    }

    return visibleTabIds;
  }

  /**
   * Active tab filter
   * @param {ChatMessage}
   * @param {Array<object>}
   * @param {string}
   * @returns {boolean}
   */
  static filterMessage(message, allTabs, activeFilter) {
    if (!message) return true;
    if (allTabs.length === 0) return true;

    const activeTab = allTabs.find((t) => t.id === activeFilter);
    if (
      activeTab?.showAllMessages &&
      !(activeTab.isWhisperTab && message.whisper.length === 0)
    ) {
      return true;
    }

    const visibleTabs = this.getVisibleTabsForMessage(message, allTabs);
    return visibleTabs.has(activeFilter);
  }
}
