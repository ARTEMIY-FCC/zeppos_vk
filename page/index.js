import * as hmUI from "@zos/ui";
import { log as Logger } from "@zos/utils";
import { BasePage } from "@zeppos/zml/base-page";
import { createKeyboard, deleteKeyboard, inputType } from "@zos/ui";
import { setScrollLock } from "@zos/page";

const logger = Logger.getLogger("vk_watch_fixed");

const SCREEN_W = 480;
const SCREEN_H = 480;
const HEADER_H = 64;
const PADDING = 14;
const LINE_HEIGHT = 20;
const MAX_CHARS_PER_LINE = 40;
const BUBBLE_PAD_V = 14;
const BUBBLE_TIME_H = 18;
const DRAFT_ROW_H = 56;
const DRAFT_MARGIN = 10;
const DRAFT_Y = SCREEN_H - DRAFT_ROW_H - DRAFT_MARGIN - 2;
const DRAFT_SAFE_X = 44;
const DRAFT_SAFE_W = SCREEN_W - DRAFT_SAFE_X * 2;
const REQUEST_TIMEOUT = 30000;
const SEND_RETRY = 2;

let conversations = [];
let profiles = [];
let groups = [];
let createdWidgets = [];
let draftText = "";
let currentChatId = null;
let currentChatTitle = "";
let currentMessages = [];
let currentChatProfiles = [];
let currentChatGroups = [];

let currentPage = 0;
let chatsPerPage = 4;

let messagesContainer = null;

function logDebug(...args) {
  try { logger.log.apply(logger, args); } catch (e) {}
}

function safeClearScreen() {
  while (createdWidgets.length > 0) {
    try { const w = createdWidgets.pop(); hmUI.deleteWidget(w); } catch (e) {}
  }
  messagesContainer = null;
  try { deleteKeyboard(); } catch (e) {}
}

function createWidget(type, props) {
  const w = hmUI.createWidget(type, props);
  createdWidgets.push(w);
  return w;
}

function wrapTextByWords(text, maxChars = MAX_CHARS_PER_LINE) {
  if (!text) return [""];
  const words = String(text).split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + (cur ? " " : "") + w).length <= maxChars) {
      cur = (cur ? cur + " " : "") + w;
    } else {
      if (cur) lines.push(cur);
      if (w.length > maxChars) {
        let s = 0;
        while (s < w.length) {
          lines.push(w.substring(s, s + maxChars));
          s += maxChars;
        }
        cur = "";
      } else {
        cur = w;
      }
    }
  }
  if (cur) lines.push(cur);
  if (lines.length === 0) lines.push("");
  return lines;
}

function measureBubble(text, isGroup = false, isOut = false) {
  const lines = wrapTextByWords(text || "");
  const senderNameHeight = (isGroup && !isOut) ? LINE_HEIGHT : 0;
  const height = lines.length * LINE_HEIGHT + BUBBLE_PAD_V + BUBBLE_TIME_H + senderNameHeight;
  const longest = lines.reduce((acc, l) => Math.max(acc, l.length), 0);
  const widthApprox = Math.min(SCREEN_W - PADDING * 4, Math.max(100, Math.floor(longest * 9) + 28));
  return { width: widthApprox, height, lines, senderNameHeight };
}

function formatTime(ts) {
  try {
    const d = new Date(Number(ts) * 1000);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch (e) {
    return "";
  }
}

function getRealChatTitle(conv) {
  try {
    if (!conv || !conv.conversation) return "Чат";

    const peer = conv.conversation.peer;
    if (!peer) return "Чат";

    if (peer.type === "chat") {
      const title = conv.conversation.chat_settings && conv.conversation.chat_settings.title;
      return title || "Беседа";
    }

    if (peer.type === "user") {
      const pid = Number(peer.id);
      const prof = (profiles || []).find(p => Number(p.id) === pid);
      if (prof) {
        return `${prof.first_name || ""} ${prof.last_name || ""}`.trim() || `Пользователь ${pid}`;
      }
      return `Пользователь ${pid}`;
    }

    if (peer.type === "group") {
      const absId = Math.abs(Number(peer.id));
      const g = (groups || []).find(gr => Number(gr.id) === Number(absId));
      return (g && g.name) || `Группа ${absId}`;
    }

    return "Чат";
  } catch (e) {
    logDebug("getRealChatTitle error", e);
    return "Чат";
  }
}

function requestTimeoutPromise(page, reqObj, timeout = REQUEST_TIMEOUT) {
  return new Promise((resolve, reject) => {
    let expired = false;
    const tid = setTimeout(() => { expired = true; reject(new Error("request timeout")); }, timeout);
    try {
      page.request(reqObj)
        .then((res) => { if (expired) return; clearTimeout(tid); resolve(res); })
        .catch((err) => { if (expired) return; clearTimeout(tid); reject(err); });
    } catch (e) {
      clearTimeout(tid);
      reject(e);
    }
  });
}

Page(BasePage({
  build() {
    logDebug("[page] build start");
    this.showLoadingScreen("VK: Загрузка...");
    setTimeout(() => { this.loadConversations(); }, 60);
  },

  showLoadingScreen(text) {
    safeClearScreen();
    createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: 0x111111 });
    createWidget(hmUI.widget.TEXT, { x: 0, y: SCREEN_H / 2 - 30, w: SCREEN_W, h: 60, text: text, text_size: 26, color: 0xffffff, align_h: hmUI.align.CENTER_H });
  },

  loadConversations() {
    safeClearScreen();
    this.showLoadingScreen("VK: Загрузка чатов...");

    createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: HEADER_H, color: 0x3578e6 });
    createWidget(hmUI.widget.TEXT, { x: 0, y: 18, w: SCREEN_W, h: 30, text: "VK: Загрузка чатов...", text_size: 20, color: 0xffffff, align_h: hmUI.align.CENTER_H });
    try { setScrollLock({ lock: false }); } catch (e) { logDebug("setScrollLock not supported", e); }
    const req = { method: "GET_CONVERSATIONS" };
    requestTimeoutPromise(this, req, REQUEST_TIMEOUT)
      .then((res) => {
        if (!(res && res.success)) {
          this.showError("Ошибка загрузки диалогов");
          return;
        }
        conversations = Array.isArray(res.conversations) ? res.conversations : [];
        profiles = Array.isArray(res.profiles) ? res.profiles : [];
        groups = Array.isArray(res.groups) ? res.groups : [];

        logDebug(`Loaded: ${conversations.length} conversations, ${profiles.length} profiles, ${groups.length} groups`);
        currentPage = 0;
        this.renderChatList();
      })
      .catch((err) => {
        logDebug("GET_CONVERSATIONS error", err && err.message ? err.message : err);
        this.showError("Ошибка сети при загрузке чатов");
      });
  },

  showError(text) {
    safeClearScreen();
    createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: 0x2a1a1a });
    createWidget(hmUI.widget.TEXT, { x: 20, y: SCREEN_H / 2 - 40, w: SCREEN_W - 40, h: 60, text: text, text_size: 18, color: 0xff6b6b, align_h: hmUI.align.CENTER_H });

    createWidget(hmUI.widget.BUTTON, {
      x: SCREEN_W / 2 - 80,
      y: SCREEN_H / 2 + 20,
      w: 160,
      h: 44,
      text: "Повторить",
      text_size: 18,
      normal_color: 0x3578e6,
      press_color: 0x2a5d94,
      color: 0xffffff,
      click_func: () => { this.loadConversations(); }
    });
  },

  renderChatList() {
    safeClearScreen();
    createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: 0x0f0f0f });
    createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: HEADER_H, color: 0x3578e6 });

    const totalPages = Math.ceil(conversations.length / chatsPerPage);

    createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: 18,
      w: SCREEN_W,
      h: 30,
      text: `VK Чаты (${currentPage + 1}/${totalPages})`,
      text_size: 22,
      color: 0xffffff,
      align_h: hmUI.align.CENTER_H
    });
    if (!conversations || conversations.length === 0) {
      createWidget(hmUI.widget.TEXT, {
        x: 20,
        y: SCREEN_H / 2 - 20,
        w: SCREEN_W - 40,
        h: 40,
        text: "Нет диалогов",
        text_size: 20,
        color: 0xcccccc,
        align_h: hmUI.align.CENTER_H
      });
      return;
    }
    const startIndex = currentPage * chatsPerPage;
    const endIndex = Math.min(startIndex + chatsPerPage, conversations.length);
    const currentChats = conversations.slice(startIndex, endIndex);
    for (let i = 0; i < currentChats.length; i++) {
      this.drawChatButton(currentChats[i], i, startIndex + i);
    }
    this.drawNavigationButtons(totalPages);
  },

  drawNavigationButtons(totalPages) {
    const buttonWidth = 80;
    const buttonHeight = 50;
    const buttonY = SCREEN_H - 80;
    if (currentPage > 0) {
      createWidget(hmUI.widget.BUTTON, {
        x: 100,
        y: buttonY,
        w: buttonWidth,
        h: buttonHeight,
        radius: 12,
        normal_color: 0x3578e6,
        press_color: 0x2a5d94,
        text: "←",
        text_size: 24,
        color: 0xffffff,
        click_func: () => {
          currentPage--;
          this.renderChatList();
        }
      });
    }
    if (currentPage < totalPages - 1) {
      createWidget(hmUI.widget.BUTTON, {
        x: SCREEN_W - 100 - buttonWidth,
        y: buttonY,
        w: buttonWidth,
        h: buttonHeight,
        radius: 12,
        normal_color: 0x3578e6,
        press_color: 0x2a5d94,
        text: "→",
        text_size: 24,
        color: 0xffffff,
        click_func: () => {
          currentPage++;
          this.renderChatList();
        }
      });
    }
    this.drawPageIndicator(totalPages, buttonY - 20);
  },

  drawPageIndicator(totalPages, y) {
    const dotSize = 8;
    const dotSpacing = 15;
    const totalWidth = totalPages * dotSpacing;
    const startX = (SCREEN_W - totalWidth) / 2;
    for (let i = 0; i < totalPages; i++) {
      createWidget(hmUI.widget.FILL_RECT, {
        x: startX + (i * dotSpacing),
        y: y,
        w: dotSize,
        h: dotSize,
        radius: dotSize / 2,
        color: i === currentPage ? 0x3578e6 : 0x666666
      });
    }
  },

  drawChatButton(conv, positionOnPage, globalIndex) {
    const buttonHeight = 80;
    const buttonWidth = SCREEN_W - 40;
    const buttonX = 20;
    const buttonY = HEADER_H + 20 + (positionOnPage * (buttonHeight + 15));
    const displayTitle = `Чат ${globalIndex + 1}`;
    let lastMsg = "";
    if (conv.last_message && conv.last_message.text) {
      lastMsg = conv.last_message.text.length > 60 ?
        conv.last_message.text.substring(0, 60) + "..." :
        conv.last_message.text;
    } else {
      lastMsg = "Нет сообщений";
    }
    createWidget(hmUI.widget.BUTTON, {
      x: buttonX,
      y: buttonY,
      w: buttonWidth,
      h: buttonHeight,
      radius: 12,
      normal_color: 0x222222,
      press_color: 0x444444,
      text: displayTitle,
      text_size: 20,
      color: 0xffffff,
      click_func: () => {
        logDebug("chat button clicked:", globalIndex);
        const realTitle = getRealChatTitle(conv);
        this.openChat(conv, realTitle);
      }
    });
    createWidget(hmUI.widget.TEXT, {
      x: buttonX + 15,
      y: buttonY + 40,
      w: buttonWidth - 30,
      h: 30,
      text: lastMsg,
      text_size: 16,
      color: 0xaaaaaa
    });
  },

  openChat(conv, realTitle) {
    safeClearScreen();
    const peer = conv && conv.conversation && conv.conversation.peer ? conv.conversation.peer : null;
    if (!peer) {
      this.showError("Неверный чат");
      return;
    }
    currentChatId = Number(peer.id);
    currentChatTitle = realTitle;
    logDebug(`Opening chat: ${currentChatTitle} (id: ${currentChatId})`);
    try { setScrollLock({ lock: true }); } catch (e) { logDebug("setScrollLock failed", e); }
    this.drawChatShell();
    const req = { method: "GET_MESSAGES", peer_id: currentChatId };
    requestTimeoutPromise(this, req, REQUEST_TIMEOUT)
      .then((res) => {
        if (!(res && res.success && Array.isArray(res.messages))) {
          this.showError("Ошибка загрузки сообщений");
          return;
        }
        currentMessages = res.messages.slice();
        currentChatProfiles = Array.isArray(res.profiles) ? res.profiles : [];
        currentChatGroups = Array.isArray(res.groups) ? res.groups : [];
        this.renderMessages();
      })
      .catch((err) => {
        logDebug("GET_MESSAGES error:", err && err.message ? err.message : err);
        this.showError("Ошибка сети при загрузке сообщений");
      });
  },

  drawChatShell() {
    safeClearScreen();
    createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: 0x0f0f0f });
    createWidget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: HEADER_H, color: 0x3578e6 });
    createWidget(hmUI.widget.BUTTON, {
      x: 0,
      y: 12,
      w: SCREEN_W,
      h: HEADER_H - 20,
      text: currentChatTitle,
      text_size: 20,
      normal_color: 0x00000000,
      press_color: 0x2255ffffff,
      color: 0xffffff,
      text_style: hmUI.text_style.ELLIPSIS,
      align_h: hmUI.align.CENTER_H,
      click_func: () => {
        try { setScrollLock({ lock: false }); } catch (e) { logDebug("setScrollLock failed", e); }
        this.renderChatList();
      }
    });
    messagesContainer = createWidget(hmUI.widget.VIEW_CONTAINER, {
      x: 0,
      y: HEADER_H,
      w: SCREEN_W,
      h: DRAFT_Y - HEADER_H - 6
    });
    this.drawDraftRow();
  },

  drawDraftRow() {
    createWidget(hmUI.widget.FILL_RECT, {
      x: DRAFT_SAFE_X,
      y: DRAFT_Y,
      w: DRAFT_SAFE_W,
      h: DRAFT_ROW_H,
      color: 0x333333,
      radius: 10
    });
    createWidget(hmUI.widget.BUTTON, {
      x: DRAFT_SAFE_X + 6,
      y: DRAFT_Y + 6,
      w: DRAFT_SAFE_W - 12,
      h: DRAFT_ROW_H - 12,
      text: draftText.trim().length > 0 ? draftText : "Написать сообщение...",
      text_size: 16,
      normal_color: 0x00000000,
      press_color: 0x22ffffff,
      color: 0xdddddd,
      text_style: hmUI.text_style.ELLIPSIS,
      align_h: hmUI.align.LEFT,
      click_func: () => { this.openKeyboard(); }
    });
  },

  openKeyboard() {
    try {
      createKeyboard({
        inputType: inputType.TEXT,
        text: draftText || "",
        onComplete: (_, result) => {
          const value = result && (result.data ?? result.text) ? (result.data ?? result.text) : "";
          draftText = String(value || "");
          if (draftText && String(draftText).trim().length > 0) this.sendMessage(draftText);
        },
        onCancel: () => {}
      });
    } catch (e) {
      logDebug("createKeyboard failed", e);
    }
  },

  renderMessages() {
    if (!messagesContainer) {
      logDebug("renderMessages: messagesContainer is null");
      return;
    }
    let y = PADDING;
    const spacing = 10;
    const isGroup = currentChatId > 2000000000 || currentChatId < -2000000000;
    for (let i = 0; i < currentMessages.length; i++) {
      if (i > 0) y += spacing;
      const msg = currentMessages[i];
      if (!msg) continue;
      const isOut = Number(msg.out) === 1;
      let senderName = null;
      if (isGroup && !isOut) {
        const prof = currentChatProfiles.find(p => Number(p.id) === Number(msg.from_id));
        if (prof) senderName = prof.first_name || "Участник";
      }
      const m = measureBubble(msg.text || "", isGroup, isOut);
      this.drawMessageAt(msg, y, senderName);
      y += m.height;
    }
  },

  drawMessageAt(msg, y, senderName = null) {
    if (!messagesContainer) return;
    const isOut = Number(msg.out) === 1 || Number(msg.from_id) === 0;
    const text = msg.text || "";
    const isGroup = currentChatId > 2000000000 || currentChatId < -2000000000;
    const m = measureBubble(text, isGroup, isOut);
    const x = isOut ? (SCREEN_W - m.width - PADDING * 2) : PADDING * 2;
    const color = isOut ? 0x3578e6 : 0x333333;
    messagesContainer.createWidget(hmUI.widget.FILL_RECT, {
      x: x,
      y: y,
      w: m.width,
      h: m.height,
      color: color,
      radius: 12
    });
    let textY = y + 10;
    if (senderName && m.senderNameHeight > 0) {
      messagesContainer.createWidget(hmUI.widget.TEXT, {
        x: x + 12,
        y: textY,
        w: m.width - 24,
        h: LINE_HEIGHT,
        text: senderName,
        text_size: 14,
        color: 0x34c759,
        align_h: hmUI.align.LEFT
      });
      textY += LINE_HEIGHT;
    }
    for (let i = 0; i < m.lines.length; i++) {
      messagesContainer.createWidget(hmUI.widget.TEXT, {
        x: x + 12,
        y: textY + (i * LINE_HEIGHT),
        w: m.width - 24,
        h: LINE_HEIGHT,
        text: m.lines[i],
        text_size: 16,
        color: 0xffffff,
        align_h: hmUI.align.LEFT
      });
    }
    const t = formatTime(msg.date);
    messagesContainer.createWidget(hmUI.widget.TEXT, {
      x: x + 10,
      y: y + m.height - BUBBLE_TIME_H,
      w: m.width - 20,
      h: 16,
      text: t,
      text_size: 12,
      color: 0xdddddd,
      align_h: isOut ? hmUI.align.RIGHT : hmUI.align.LEFT
    });
  },

  sendMessage(messageText) {
    if (!currentChatId) {
      this.showError("Не выбран чат");
      return;
    }
    if (!messageText || String(messageText).trim().length === 0) return;
    const randomId = Math.floor(Math.random() * 1000000000);

    const req = {
      method: "SEND_MESSAGE",
      peer_id: currentChatId,
      message: messageText,
      random_id: randomId
    };

    requestTimeoutPromise(this, req, REQUEST_TIMEOUT)
      .then((res) => {
        if (res && res.success) {
          draftText = "";
          this.openChat({ conversation: { peer: { id: currentChatId } } }, currentChatTitle);
        } else {
          this.showError("Ошибка отправки сообщения");
        }
      })
      .catch((err) => {
        logDebug("SEND_MESSAGE error", err && err.message ? err.message : err);
        this.showError("Ошибка отправки (сеть)");
      });
  }
}));
