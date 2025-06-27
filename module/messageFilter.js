// MessageFilter Class
export class MessageFilter {
  /**
   * Filtering logic
   * @param {ChatMessage} message
   * @param {Array<object>} allTabs
   * @param {string} activeFilter
   * @returns {boolean}
   */
  static filterMessage(message, allTabs, activeFilter) {
    if (!message) {
      return true;
    }
    if (allTabs.length === 0) {
      return true;
    }

    const sourceTabId = message.getFlag("multiple-chat-tabs", "sourceTab");
    const validTabIds = new Set(allTabs.map((t) => t.id));
    const defaultTabId = allTabs[0]?.id;

    // --- Core Filtering Logic ---
    if (sourceTabId && validTabIds.has(sourceTabId)) {
      return sourceTabId === activeFilter;
    } else {
      return activeFilter === defaultTabId;
    }

    // --- Future filtering point ---
  }
}
