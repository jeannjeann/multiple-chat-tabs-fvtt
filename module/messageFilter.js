// MessageFilter Class
export class MessageFilter {
  /**
   * Message type helper
   * @param {ChatMessage} message
   * @returns {string}
   */
  static getMessageType(message) {
    if (message.isRoll) return "roll";
    switch (message.style) {
      case CONST.CHAT_MESSAGE_STYLES.IC:
        return "ic";
      case CONST.CHAT_MESSAGE_STYLES.OOC:
        return "ooc";
      default:
        // OTHER include EMOTE, WHISPER, etc.
        return "other";
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

    const messageType = this.getMessageType(message);

    const moveTarget = allTabs.find(
      (tab) => tab.force?.[messageType] === "move"
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
    } else if (defaultTabId) {
      visibleTabIds.add(defaultTabId);
    }

    const duplicateTargets = allTabs.filter(
      (tab) => tab.force?.[messageType] === "duplicate"
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
    if (activeTab?.showAllMessages) {
      return true;
    }

    const visibleTabs = this.getVisibleTabsForMessage(message, allTabs);
    return visibleTabs.has(activeFilter);
  }
}
