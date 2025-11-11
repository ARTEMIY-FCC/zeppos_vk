import * as hmUI from "@zos/ui";
import { log as Logger } from "@zos/utils";
import { BasePage } from "@zeppos/zml/base-page";
import { setScrollLock } from "@zos/page";
import { pauseDropWristScreenOff } from '@zos/display';

const logger = Logger.getLogger("vk_watch_pro");
const logDebug = (...args) => { try { logger.log.apply(logger, args); } catch (e) {} };

const SCREEN_W = 480;
const SCREEN_H = 480;
const HEADER_H = 80;
const PADDING = 20;
const LINE_HEIGHT = 26;
const MAX_CHARS_PER_LINE = 38;
const BUBBLE_PAD = 16;
const BUBBLE_RADIUS = 20;
const DRAFT_H = 64;
const DRAFT_Y = SCREEN_H - DRAFT_H - 20;
const SAFE_AREA_X = 32;
const CUSTOM_FONT = 'fonts/font.ttf';

const COLORS = {
  bg: 0x0a0a0a,
  surface: 0x151515,
  primary: 0x5289f7,
  primaryDark: 0x3a6bc7,
  accent: 0x34c759,
  textPrimary: 0xffffff,
  textSecondary: 0xbbbbbb,
  textHint: 0x888888,
  bubbleOut: 0x5289f7,
  bubbleIn: 0x222222,
  error: 0xff5252,
  online: 0x34c759,
  link: 0x5289f7
};

// Keyboard constants and variables
const SPACE = 2;
const BUTTON_H = 50;
const TEXT_SIZE = 24;
const NORMAL_COLOR = 0x222222;
const PRESS_COLOR = 0x444444;
const TEXT_COLOR = 0xffffff;
const ROW_SPACING = 60;

const SCREEN_WIDTH = 480;
const X_MARGIN = 10;
const AVAILABLE_WIDTH = SCREEN_WIDTH - (X_MARGIN * 2);

const rusRow1 = ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'];
const rusRow2 = ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'];
const rusRow3 = ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю'];

const engRow1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
const engRow2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
const engRow3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

const symRow1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const symRow2 = ['@', '#', '₽', '$', '€', '&', '*', '(', ')'];
const symRow3 = ['-', '_', '+', '=', '/', '?', '!', '.'];

const symRow2_1 = ['[', ']', '{', '}', '<', '>', '~', '`', '\\'];
const symRow2_2 = ['|', ':', ';', '"', "'", '©', '®', '™'];
const symRow2_3 = ['%', '^', '¥', '£', '¢', ',', '.'];

const emojiRow1 = ['🙂', '😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🔥', '🎉'];
const emojiRow2 = ['🚀', '⭐', '👋', '🙏', '🤷', '😥', '😡', '🥳', '✅', '❌'];
const emojiRow3 = ['➡️', '⬅️', '🕒', '💡', '🌍', '💻', '💰', '🍔', '✈️', '⚙️'];

let row1Keys = [...rusRow1];
let row2Keys = [...rusRow2];
let row3Keys = [...rusRow3];

let inputStr = "";
let isUpper = false;
let currentLayout = 'RUS';

let inputTextWidget;
let keyboardY = 180;
let letterButtons = [[], [], []];
let specialButtons = [];
let spacebarButton;

const updateText = () => {
    if (inputTextWidget) {
        inputTextWidget.setProperty(hmUI.prop.TEXT, inputStr || "Текст..");
    }
};

const updateKeys = () => {
    row1Keys.forEach((char, i) => {
        const btnObj = letterButtons[0][i];
        if (btnObj && btnObj.widget) {
            btnObj.widget.setProperty(hmUI.prop.TEXT, isUpper ? char.toUpperCase() : char);
        }
    });
    row2Keys.forEach((char, i) => {
        const btnObj = letterButtons[1][i];
        if (btnObj && btnObj.widget) {
            btnObj.widget.setProperty(hmUI.prop.TEXT, isUpper ? char.toUpperCase() : char);
        }
    });
    row3Keys.forEach((char, i) => {
        const btnObj = letterButtons[2][i];
        if (btnObj && btnObj.widget) {
            btnObj.widget.setProperty(hmUI.prop.TEXT, isUpper ? char.toUpperCase() : char);
        }
    });
};

const createLetterButton = (x, yOffset, char, buttonW) => {
    const y = keyboardY + yOffset;
    let text = (currentLayout === 'EMOJI' || (currentLayout === 'SYM' && isUpper))
        ? char
        : (isUpper ? char.toUpperCase() : char);

    const widget = hmUI.createWidget(hmUI.widget.BUTTON, {
        x,
        y,
        w: buttonW,
        h: BUTTON_H,
        text: text,
        text_size: TEXT_SIZE,
        color: TEXT_COLOR,
        normal_color: NORMAL_COLOR,
        press_color: PRESS_COLOR,
        radius: 4,
        click_func: () => {
            const inputChar = (currentLayout === 'EMOJI' || (currentLayout === 'SYM' && isUpper))
                ? char
                : (isUpper ? char.toUpperCase() : char);

            inputStr += inputChar;
            updateText();
        },
    });

    return { widget, x, yOffset, char };
};

const destroyLetterButtons = () => {
    letterButtons.forEach(row => {
        row.forEach(btnObj => {
            if (btnObj && btnObj.widget) {
                hmUI.deleteWidget(btnObj.widget);
            }
        });
    });
    letterButtons = [[], [], []];
};

const drawLetterButtons = () => {
    const maxKeys = Math.max(row1Keys.length, row2Keys.length, row3Keys.length);
    
    const buttonW = Math.floor((AVAILABLE_WIDTH - (maxKeys - 1) * SPACE) / maxKeys);

    let row1Width = row1Keys.length * buttonW + (row1Keys.length - 1) * SPACE;
    let row1X = (SCREEN_WIDTH - row1Width) / 2;
    let currentX = row1X;
    row1Keys.forEach((char, i) => {
        const btnObj = createLetterButton(currentX, 0, char, buttonW);
        letterButtons[0].push(btnObj);
        currentX += buttonW + SPACE;
    });

    let row2Width = row2Keys.length * buttonW + (row2Keys.length - 1) * SPACE;
    let row2X = (SCREEN_WIDTH - row2Width) / 2;
    currentX = row2X;
    row2Keys.forEach((char, i) => {
        const btnObj = createLetterButton(currentX, ROW_SPACING, char, buttonW);
        letterButtons[1].push(btnObj);
        currentX += buttonW + SPACE;
    });

    let row3Width = row3Keys.length * buttonW + (row3Keys.length - 1) * SPACE;
    let row3X = (SCREEN_WIDTH - row3Width) / 2;
    currentX = row3X;
    row3Keys.forEach((char, i) => {
        const btnObj = createLetterButton(currentX, ROW_SPACING * 2, char, buttonW);
        letterButtons[2].push(btnObj);
        currentX += buttonW + SPACE;
    });
};

const updateSpecialButtonLabels = () => {
    if (!specialButtons[0] || !specialButtons[1]) return;

    const shiftBtnWidget = specialButtons[0].widget;
    const globeBtnWidget = specialButtons[1].widget;
    const deleteBtnWidget = specialButtons[2].widget;

    deleteBtnWidget.setProperty(hmUI.prop.TEXT, '<');

    if (currentLayout === 'RUS') {
        shiftBtnWidget.setProperty(hmUI.prop.TEXT, isUpper ? '↓' : '↑');
        globeBtnWidget.setProperty(hmUI.prop.TEXT, 'ENG');
    } else if (currentLayout === 'ENG') {
        shiftBtnWidget.setProperty(hmUI.prop.TEXT, isUpper ? '↓' : '↑');
        globeBtnWidget.setProperty(hmUI.prop.TEXT, '123');
    } else if (currentLayout === 'SYM') {
        shiftBtnWidget.setProperty(hmUI.prop.TEXT, isUpper ? '123' : '#+=');
        globeBtnWidget.setProperty(hmUI.prop.TEXT, '🙂');
    } else if (currentLayout === 'EMOJI') {
        shiftBtnWidget.setProperty(hmUI.prop.TEXT, '..');
        globeBtnWidget.setProperty(hmUI.prop.TEXT, 'РУС');
    }
};

const moveKeyboard = (delta) => {
    keyboardY += delta;
    for (let r = 0; r < letterButtons.length; r++) {
        for (let k = 0; k < letterButtons[r].length; k++) {
            const btnObj = letterButtons[r][k];
            if (btnObj && btnObj.widget) {
                const newY = keyboardY + btnObj.yOffset;
                btnObj.widget.setProperty(hmUI.prop.Y, newY);
            }
        }
    }
    for (let i = 0; i < specialButtons.length; i++) {
        const s = specialButtons[i];
        if (s && s.widget) {
            const newY = keyboardY + s.yOffset;
            s.widget.setProperty(hmUI.prop.Y, newY);
        }
    }

    if (spacebarButton && spacebarButton.widget) {
        const newY = keyboardY + spacebarButton.yOffset;
        spacebarButton.widget.setProperty(hmUI.prop.Y, newY);
    }
};

let conversations = [], profiles = [], groups = [];
let currentChatId = null, currentChatTitle = "", currentMessages = [];
let currentChatProfiles = [], currentChatGroups = [];
let currentConv = null;
let draftText = "";
let postDraft = "";
let currentPage = 0;
const CHATS_PER_PAGE = 3;
let createdWidgets = [];
let messagesContainer = null;
let feedContainer = null;
let userFirstName = "";
let feedItems = [], feedProfiles = [], feedGroups = [];
let currentTab = "messages";

function safeClear() {
  while (createdWidgets.length) hmUI.deleteWidget(createdWidgets.pop());
  messagesContainer = null;
  feedContainer = null;
}

function widget(type, props) {
  const w = hmUI.createWidget(type, props);
  createdWidgets.push(w);
  return w;
}

function parseVKLinks(text) {
  if (!text) return [];
  const linkPattern = /\[#[^\|]*\|([^\|]+)\|([^\]]+)\]/g;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }
    
    segments.push({
      type: 'link',
      content: match[1],
      url: match[2]
    });
    
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }

  return segments.length ? segments : [{ type: 'text', content: text }];
}

function wrapText(text, max = MAX_CHARS_PER_LINE) {
  if (!text) return [""];
  const paragraphs = String(text).split('\n');
  const lines = [];
  paragraphs.forEach(p => {
    if (p === '') {
      lines.push('');
    } else {
      const words = p.split(/\s+/);
      let line = "";
      for (const w of words) {
        const test = line + (line ? " " : "") + w;
        if (test.length <= max) {
          line = test;
        } else {
          if (line) lines.push(line);
          if (w.length > max) {
            let i = 0;
            while (i < w.length) {
              lines.push(w.substr(i, max));
              i += max;
            }
            line = "";
          } else {
            line = w;
          }
        }
      }
      if (line) lines.push(line);
    }
  });
  return lines.length ? lines : [""];
}

function measureBubble(text, hasName, isOut) {
  const lines = wrapText(text);
  const nameH = hasName ? 24 : 0;
  const height = lines.length * LINE_HEIGHT + BUBBLE_PAD * 2 + 28 + nameH;
  const width = Math.min(SCREEN_W - PADDING * 3, Math.max(140, lines.reduce((a, l) => Math.max(a, l.length), 0) * 10 + 40));
  return { width, height, lines, nameH };
}

function formatTime(ts) {
  const d = new Date(ts * 1000);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 86400) {
    return d.toTimeString().substr(0, 5);
  }
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

function getChatTitle(conv) {
  try {
    const peer = conv.conversation.peer;
    if (peer.type === "chat") return conv.conversation.chat_settings?.title || "Беседа";
    if (peer.type === "user") {
      const p = profiles.find(x => Number(x.id) === Number(peer.id));
      return p ? `${p.first_name} ${p.last_name}`.trim() : "Пользователь";
    }
    if (peer.type === "group") {
      const g = groups.find(x => Math.abs(x.id) === Math.abs(peer.id));
      return g?.name || "Группа";
    }
  } catch (e) {}
  return "Чат";
}

function getAttDesc(att) {
  switch (att.type) {
    case 'photo': return 'Фото 📷';
    case 'video': return 'Видео 🎥';
    case 'audio': return 'Аудио 🎵';
    case 'audio_message': return 'Голосовое сообщение 🎤';
    case 'doc': return 'Документ 📄';
    case 'graffiti': return 'Граффити ✏️';
    case 'link': return `Ссылка 🔗 ${att.link?.title || ''}`;
    case 'market': return 'Товар 🛒';
    case 'wall': return 'Запись на стене 📌';
    case 'share': return 'Поделиться 🔗';
    case 'gift': return 'Подарок 🎁';
    case 'sticker': return 'Стикер 😊';
    case 'call': {
      let state = '';
      if (att.call.state === 'canceled') state = 'Отмененный звонок';
      else if (att.call.state === 'declined') state = 'Отклоненный звонок';
      else if (att.call.state === 'missed') state = 'Пропущенный звонок';
      else if (att.call.state === 'reached') state = `Звонок (${att.call.duration} сек)`;
      else state = 'Звонок';
      return state + ' 📞';
    }
    case 'story': return 'История 📖';
    case 'poll': return 'Опрос 📊';
    default: return 'Вложение 📎';
  }
}

function getActionDesc(action) {
  switch (action.type) {
    case 'chat_photo_update': return 'Обновлена фото чата';
    case 'chat_photo_remove': return 'Удалена фото чата';
    case 'chat_create': return `Чат создан: ${action.text || ''}`;
    case 'chat_title_update': return `Название изменено на ${action.text || ''}`;
    case 'chat_invite_user': return 'Пригласил пользователя';
    case 'chat_kick_user': return 'Исключил пользователя';
    case 'chat_pin_message': return 'Закреплено сообщение';
    case 'chat_unpin_message': return 'Откреплено сообщение';
    case 'chat_invite_user_by_link': return 'Присоединился по ссылке';
    default: return 'Действие в чате';
  }
}

function getMessageContent(msg) {
  if (msg.action) {
    return getActionDesc(msg.action);
  }
  let content = msg.text || '';
  if (msg.attachments && msg.attachments.length) {
    content += (content ? '\n' : '') + msg.attachments.map(getAttDesc).join('\n');
  }
  if (msg.fwd_messages && msg.fwd_messages.length) {
    content += (content ? '\n' : '') + `Пересланные сообщения (${msg.fwd_messages.length})`;
  }
  if (msg.reply_message) {
    const replySnippet = msg.reply_message.text ? msg.reply_message.text.substr(0, 20) + '...' : 'сообщение';
    content = `Ответ на: ${replySnippet}\n` + content;
  }
  return content;
}

function request(method, params = {}, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const tid = setTimeout(() => reject(new Error("timeout")), timeout);
    this.request({ method, ...params })
      .then(res => { clearTimeout(tid); resolve(res); })
      .catch(err => { clearTimeout(tid); reject(err); });
  });
}

Page(BasePage({
  onInit() {
    logger.debug("page onInit invoked");
  },

  build() {
    this.showSplash();
    setTimeout(() => {
      this.selectTokenIfNeeded();
    }, 300);
  },

  onDestroy() {
    logger.debug("page onDestroy invoked");
  },

  buildKeyboard() {
    logger.debug("keyboard build invoked");

    widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: COLORS.bg });

    inputStr = this.keyboardInitial || "";
    row1Keys = [...rusRow1];
    row2Keys = [...rusRow2];
    row3Keys = [...rusRow3];
    isUpper = false;
    currentLayout = 'RUS';
    keyboardY = 180;
    letterButtons = [[], [], []];
    specialButtons = [];
    spacebarButton = null;

    // Отмена кнопка
    widget(hmUI.widget.BUTTON, {
      x: 80,
      y: 50,
      w: 100,
      h: 50,
      text: "Отмена",
      text_size: 28,
      color: TEXT_COLOR,
      normal_color: 0x888888,
      press_color: 0x666666,
      radius: 8,
      click_func: () => {
        this.onKeyboardCancel();
      },
    });

    // Отправить кнопка (замена OK)
    widget(hmUI.widget.BUTTON, {
      x: 300,
      y: 50,
      w: 120,
      h: 50,
      text: "Отправить",
      text_size: 28,
      color: TEXT_COLOR,
      normal_color: 0x0088ff,
      press_color: 0x0066cc,
      radius: 8,
      click_func: () => {
        this.onKeyboardComplete(inputStr);
      },
    });

    inputTextWidget = widget(hmUI.widget.TEXT, {
      x: 0,
      y: 110,
      w: SCREEN_WIDTH,
      h: 60,
      color: TEXT_COLOR,
      text: "Текст..",
      text_size: 28,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
    });

    drawLetterButtons();

    const specialKeys = ['^', 'G', 'D'];
    const specialW = 80;
    const specialSpace = 20;
    let bottomWidth = specialKeys.length * specialW + (specialKeys.length - 1) * specialSpace;
    let bottomX = (SCREEN_WIDTH - bottomWidth) / 2;
    let currentX = bottomX;

    specialKeys.forEach((sym, i) => {
      const yOffset = ROW_SPACING * 3;
      const widgetBtn = widget(hmUI.widget.BUTTON, {
        x: currentX,
        y: keyboardY + yOffset,
        w: specialW,
        h: BUTTON_H,
        text: sym,
        text_size: TEXT_SIZE,
        color: TEXT_COLOR,
        normal_color: 0x666666,
        press_color: 0x888888,
        radius: 4,
        click_func: () => {
          if (i === 0) {
            if (currentLayout === 'RUS' || currentLayout === 'ENG') {
              isUpper = !isUpper;
              updateKeys();
            } else if (currentLayout === 'SYM') {
              isUpper = !isUpper;
              destroyLetterButtons();
              if (isUpper) {
                row1Keys = symRow2_1;
                row2Keys = symRow2_2;
                row3Keys = symRow2_3;
              } else {
                row1Keys = symRow1;
                row2Keys = symRow2;
                row3Keys = symRow3;
              }
              drawLetterButtons();
            }
            updateSpecialButtonLabels();

          } else if (i === 1) {
            isUpper = false;
            destroyLetterButtons();

            if (currentLayout === 'RUS') {
              currentLayout = 'ENG';
              row1Keys = engRow1; row2Keys = engRow2; row3Keys = engRow3;
            } else if (currentLayout === 'ENG') {
              currentLayout = 'SYM';
              row1Keys = symRow1; row2Keys = symRow2; row3Keys = symRow3;
            } else if (currentLayout === 'SYM') {
              currentLayout = 'EMOJI';
              row1Keys = emojiRow1; row2Keys = emojiRow2; row3Keys = emojiRow3;
            } else if (currentLayout === 'EMOJI') {
              currentLayout = 'RUS';
              row1Keys = rusRow1; row2Keys = rusRow2; row3Keys = rusRow3;
            }

            drawLetterButtons();
            updateSpecialButtonLabels();
          } else if (i === 2) {
            if (inputStr.length > 0) {
              inputStr = inputStr.slice(0, -1);
              updateText();
            }
          }
        },
      });
      specialButtons.push({ widget: widgetBtn, x: currentX, yOffset, sym });
      currentX += specialW + specialSpace;
    });

    specialButtons[2].widget.setProperty(hmUI.prop.TEXT, '<');
    updateSpecialButtonLabels();

    const spacebarW = 200;
    const spacebarX = (SCREEN_WIDTH - spacebarW) / 2;
    const spacebarYOffset = ROW_SPACING * 4;

    const spacebarWidget = widget(hmUI.widget.BUTTON, {
      x: spacebarX,
      y: keyboardY + spacebarYOffset,
      w: spacebarW,
      h: BUTTON_H,
      text: ' ',
      text_size: TEXT_SIZE,
      color: TEXT_COLOR,
      normal_color: 0x444444,
      press_color: 0x666666,
      radius: 4,
      click_func: () => {
        inputStr += ' ';
        updateText();
      },
    });
    spacebarButton = { widget: spacebarWidget, x: spacebarX, yOffset: spacebarYOffset, sym: ' ' };

    widget(hmUI.widget.BUTTON, {
      x: 430,
      y: 20,
      w: 40,
      h: 40,
      text: "▲",
      text_size: 20,
      color: TEXT_COLOR,
      normal_color: 0x444444,
      press_color: 0x666666,
      radius: 4,
      click_func: () => {
        moveKeyboard(-10);
      },
    });

    widget(hmUI.widget.BUTTON, {
      x: 430,
      y: 70,
      w: 40,
      h: 40,
      text: "▼",
      text_size: 20,
      color: TEXT_COLOR,
      normal_color: 0x444444,
      press_color: 0x666666,
      radius: 4,
      click_func: () => {
        moveKeyboard(10);
      },
    });

    updateText();
  },

  showCustomKeyboard(forWhat, initial) {
    this.keyboardFor = forWhat;
    this.keyboardInitial = initial;
    safeClear();
    this.buildKeyboard();
  },

  onKeyboardComplete(text) {
    if (this.keyboardFor === 'message') {
      draftText = text.trim();
      this.openChat(currentConv, currentChatTitle);
      if (draftText) this.sendMessage(draftText);
    } else if (this.keyboardFor === 'post') {
      postDraft = text.trim();
      this.loadFeed();
      if (postDraft) this.sendPost(postDraft);
    }
  },

  onKeyboardCancel() {
    if (this.keyboardFor === 'message') {
      this.openChat(currentConv, currentChatTitle);
    } else if (this.keyboardFor === 'post') {
      this.loadFeed();
    }
  },

  selectTokenIfNeeded() {
    request.call(this, "GET_TOKENS")
      .then(res => {
        if (res.success && res.tokens && res.tokens.length >= 2) {
          this.showTokenSelection(res.tokens);
        } else {
          this.loadProfile();
          this.loadConversations();
        }
      })
      .catch(() => {
        this.loadProfile();
        this.loadConversations();
      });
  },

  showTokenSelection(tokens) {
    safeClear();
    widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: COLORS.bg });
    widget(hmUI.widget.TEXT, { 
      x: 0, y: 100, w: SCREEN_W, h: 50, 
      text: "Выберите токен", text_size: 24, color: COLORS.textPrimary, 
      align_h: hmUI.align.CENTER_H,
      font: CUSTOM_FONT 
    });
    tokens.forEach((name, i) => {
      const y = 160 + i * 70;
      widget(hmUI.widget.BUTTON, {
        x: PADDING, y, w: SCREEN_W - PADDING*2, h: 60,
        radius: 30, normal_color: COLORS.surface, press_color: 0x333333,
        text: name, text_size: 22, color: COLORS.textPrimary,
        click_func: () => this.setToken(i)
      });
    });
  },

  setToken(index) {
    request.call(this, "SET_TOKEN", { index })
      .then(res => {
        if (res.success) {
          this.loadProfile();
          this.loadConversations();
        } else {
          this.showError("Ошибка выбора токена", () => this.selectTokenIfNeeded());
        }
      })
      .catch(() => this.showError("Нет связи", () => this.selectTokenIfNeeded()));
  },

  showSplash() {
    safeClear();
    widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: COLORS.bg });
    widget(hmUI.widget.IMG, {
      x: SCREEN_W / 2 - 100,
      y: SCREEN_H / 2 - 100,
      src: 'vk.png'
    });
  },

  loadProfile() {
    request.call(this, "GET_PROFILE")
      .then(res => {
        if (res.success) {
          userFirstName = res.first_name || "пользователь";
        }
      })
      .catch(() => {});
  },

  loadConversations() {
    currentTab = "messages";
    pauseDropWristScreenOff({ duration: 60000 });
    this.showLoading("Загрузка чатов...");
    request.call(this, "GET_CONVERSATIONS")
      .then(res => {
        if (!res.success) throw new Error("no data");
        conversations = res.conversations || [];
        profiles = res.profiles || [];
        groups = res.groups || [];
        currentPage = 0;
        this.renderMessagesTab();
      })
      .catch(() => this.showError("Нет сети", () => this.loadConversations()));
  },

  loadFeed() {
    currentTab = "feed";
    pauseDropWristScreenOff({ duration: 60000 });
    this.showLoading("Загрузка ленты...");
    request.call(this, "GET_NEWSFEED")
      .then(res => {
        if (!res.success) throw new Error("no data");
        feedItems = res.items || [];
        feedProfiles = res.profiles || [];
        feedGroups = res.groups || [];
        this.renderFeedTab();
      })
      .catch(() => this.showError("Нет сети", () => this.loadFeed()));
  },

  showLoading(text) {
    safeClear();
    widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: COLORS.bg });
    widget(hmUI.widget.TEXT, { 
      x: 0, y: 180, w: SCREEN_W, h: 50, 
      text, text_size: 24, color: COLORS.textPrimary, 
      align_h: hmUI.align.CENTER_H,
      font: CUSTOM_FONT
    });
  },

  showError(text, retryFn) {
    safeClear();
    widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: COLORS.bg });
    widget(hmUI.widget.TEXT, { 
      x: 40, y: 160, w: SCREEN_W-80, h: 80, 
      text, text_size: 20, color: COLORS.error, 
      align_h: hmUI.align.CENTER_H,
      font: CUSTOM_FONT
    });
    if (retryFn) {
      widget(hmUI.widget.BUTTON, {
        x: SCREEN_W/2 - 90, y: 280, w: 180, h: 56,
        text: "Повторить", radius: 28,
        normal_color: COLORS.primary, press_color: COLORS.primaryDark,
        text_size: 20, color: 0xffffff,
        click_func: retryFn
      });
    }
  },

  renderTabBar() {
    widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: HEADER_H, color: COLORS.primary });

    const iconSize = 64;
    const gap = 40;
    const totalWidth = iconSize * 2 + gap;
    const startX = (SCREEN_W - totalWidth) / 2;
    const msgIconX = startX;
    const feedIconX = startX + iconSize + gap;
    const iconY = (HEADER_H - iconSize) / 2;

    widget(hmUI.widget.BUTTON, {
      x: 0, y: 0, w: SCREEN_W / 2, h: HEADER_H,
      normal_color: 0x00000000, press_color: 0x00000000,
      click_func: () => this.loadConversations()
    });

    widget(hmUI.widget.BUTTON, {
      x: SCREEN_W / 2, y: 0, w: SCREEN_W / 2, h: HEADER_H,
      normal_color: 0x00000000, press_color: 0x00000000,
      click_func: () => this.loadFeed()
    });

    widget(hmUI.widget.IMG, {
      x: msgIconX, y: iconY, src: 'soo.png'
    });

    widget(hmUI.widget.IMG, {
      x: feedIconX, y: iconY, src: 'news.png'
    });

    if (currentTab === "messages") {
      widget(hmUI.widget.FILL_RECT, {
        x: msgIconX, y: HEADER_H - 4, w: iconSize, h: 4, color: 0xffffff
      });
    } else {
      widget(hmUI.widget.FILL_RECT, {
        x: feedIconX, y: HEADER_H - 4, w: iconSize, h: 4, color: 0xffffff
      });
    }
  },

  renderMessagesTab() {
    safeClear();
    widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: COLORS.bg });
    this.renderTabBar();

    if (!conversations.length) {
      widget(hmUI.widget.TEXT, { 
        x: 0, y: 240, w: SCREEN_W, h: 40, 
        text: "Нет диалогов", text_size: 22, 
        color: COLORS.textHint, align_h: hmUI.align.CENTER_H,
        font: CUSTOM_FONT
      });
      return;
    }

    const totalPages = Math.ceil(conversations.length / CHATS_PER_PAGE);
    const start = currentPage * CHATS_PER_PAGE;
    const chats = conversations.slice(start, start + CHATS_PER_PAGE);

    chats.forEach((conv, i) => {
      const y = HEADER_H + 20 + i * 96;
      const title = getChatTitle(conv);
      const last = conv.last_message?.text || "Нет сообщений";
      const preview = last.length > 50 ? last.substr(0,47) + "..." : last;

      widget(hmUI.widget.BUTTON, {
        x: PADDING, y, w: SCREEN_W - PADDING*2, h: 84,
        radius: 20, normal_color: COLORS.surface, press_color: 0x333333,
        click_func: () => this.openChat(conv, title)
      });

      widget(hmUI.widget.TEXT, {
        x: PADDING + 72, y: y + 12, w: SCREEN_W - PADDING*2 - 90, h: 32,
        text: title, text_size: 22, color: COLORS.textPrimary,
        font: CUSTOM_FONT
      });

      widget(hmUI.widget.TEXT, {
        x: PADDING + 72, y: y + 44, w: SCREEN_W - PADDING*2 - 90, h: 28,
        text: preview, text_size: 16, color: COLORS.textSecondary,
        font: CUSTOM_FONT
      });

      widget(hmUI.widget.CIRCLE, {
        x: PADDING + 20, y: y + 22, radius: 28, color: 0x444444
      });
      widget(hmUI.widget.TEXT, {
        x: PADDING + 20, y: y + 18, w: 56, h: 32,
        text: title[0] || "?", text_size: 28, color: 0xaaaaaa, 
        align_h: hmUI.align.CENTER_H,
        font: CUSTOM_FONT
      });
    });

    const navY = SCREEN_H - 100;
    if (currentPage > 0) {
      widget(hmUI.widget.BUTTON, {
        x: 80, y: navY, w: 80, h: 80,
        text: "←", text_size: 36, normal_color: 0x00000000,
        click_func: () => { currentPage--; this.renderMessagesTab(); }
      });
    }
    if (currentPage < totalPages - 1) {
      widget(hmUI.widget.BUTTON, {
        x: SCREEN_W - 160, y: navY, w: 80, h: 80,
        text: "→", text_size: 36, normal_color: 0x00000000,
        click_func: () => { currentPage++; this.renderMessagesTab(); }
      });
    }

    const dotX = SCREEN_W / 2 - totalPages * 10;
    for (let i = 0; i < totalPages; i++) {
      widget(hmUI.widget.CIRCLE, {
        x: dotX + i * 40 - 8, y: navY + 40, radius: 6,
        color: i === currentPage ? COLORS.primary : 0x444444
      });
    }
  },

  renderFeedTab() {
    safeClear();
    widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: COLORS.bg });
    this.renderTabBar();

    feedContainer = widget(hmUI.widget.VIEW_CONTAINER, {
      x: 0, y: HEADER_H, w: SCREEN_W, h: SCREEN_H - HEADER_H
    });

    let internalY = 20;
    feedContainer.createWidget(hmUI.widget.TEXT, {
      x: 0, y: internalY, w: SCREEN_W, h: 40,
      text: `Привет, ${userFirstName}!`, text_size: 28, 
      color: COLORS.textPrimary, align_h: hmUI.align.CENTER_H,
      font: CUSTOM_FONT
    });

    internalY += 50;
    feedContainer.createWidget(hmUI.widget.TEXT, {
      x: PADDING, y: internalY, w: SCREEN_W - PADDING * 2, h: 30,
      text: "Есть что рассказать?", text_size: 20, color: COLORS.textSecondary,
      font: CUSTOM_FONT
    });

    internalY += 40;
    const inputH = 64;
    const hasPostText = postDraft.trim().length > 0;
    feedContainer.createWidget(hmUI.widget.FILL_RECT, {
      x: SAFE_AREA_X, y: internalY, w: SCREEN_W - SAFE_AREA_X * 2, h: inputH,
      radius: 32, color: COLORS.surface
    });
    feedContainer.createWidget(hmUI.widget.BUTTON, {
      x: SAFE_AREA_X + 12, y: internalY + 8, w: SCREEN_W - SAFE_AREA_X * 2 - 84, h: inputH - 16,
      text: hasPostText ? postDraft : "Написать пост...",
      text_size: 18, color: hasPostText ? COLORS.textPrimary : COLORS.textHint,
      normal_color: 0x00000000, align_h: hmUI.align.LEFT,
      click_func: () => this.showPostKeyboard()
    });
    if (hasPostText) {
      feedContainer.createWidget(hmUI.widget.BUTTON, {
        x: SCREEN_W - SAFE_AREA_X - 60, y: internalY + 8, w: 52, h: 52,
        radius: 26, normal_color: COLORS.primary, press_color: COLORS.primaryDark,
        text: "➤", text_size: 28, color: 0xffffff,
        click_func: () => { this.sendPost(postDraft); }
      });
    }

    internalY += inputH + 20;
    this.renderFeedPosts(internalY);
  },

  showPostKeyboard() {
    this.showCustomKeyboard('post', postDraft);
  },

  sendPost(text) {
    if (!text.trim()) return;
    request.call(this, "POST_WALL", { message: text })
      .then(res => {
        if (res.success) {
          postDraft = "";
          this.loadFeed();
        } else throw 1;
      })
      .catch(() => this.showError("Не опубликовано", () => {}));
  },

  renderFeedPosts(startY) {
    if (!feedContainer) return;
    let y = startY;
    
    feedItems.forEach(item => {
      if (item.type !== "post") return;
      const sourceId = item.source_id;
      let posterName = "Неизвестно";
      
      if (sourceId > 0) {
        const p = feedProfiles.find(p => p.id === sourceId);
        posterName = p ? `${p.first_name} ${p.last_name}`.trim() : "Пользователь";
      } else {
        const g = feedGroups.find(g => g.id === -sourceId);
        posterName = g ? g.name : "Группа";
      }
      
      const text = item.text || "";
      const segments = parseVKLinks(text);
      
      let totalLines = 0;
      const textLines = text.split('\n');
      textLines.forEach(line => {
        if (line.trim() === '') {
          totalLines += 1;
        } else {
          const wrapped = wrapText(line, 35);
          totalLines += wrapped.length;
        }
      });
      
      const height = totalLines * 24 + 60;
      const x = PADDING;
      const w = SCREEN_W - PADDING * 2;

      feedContainer.createWidget(hmUI.widget.FILL_RECT, {
        x, y, w, h: height, radius: 20, color: COLORS.surface
      });

      feedContainer.createWidget(hmUI.widget.TEXT, {
        x: x + 16, y: y + 12, w: w - 32, h: 30,
        text: posterName, text_size: 20, color: COLORS.accent,
        font: CUSTOM_FONT
      });

      let ty = y + 44;
      
      textLines.forEach((line, lineIdx) => {
        if (line.trim() === '') {
          ty += 24;
        } else {
          const lineSegments = parseVKLinks(line);
          const wrappedLines = wrapText(line, 35);
          
          wrappedLines.forEach((wrappedLine, i) => {
            let hasLink = false;
            let linkText = '';
            
            for (const seg of lineSegments) {
              if (seg.type === 'link' && wrappedLine.includes(seg.content)) {
                hasLink = true;
                linkText = seg.content;
                break;
              }
            }
            
            if (hasLink) {
              feedContainer.createWidget(hmUI.widget.TEXT, {
                x: x + 16, y: ty, w: w - 32, h: 24,
                text: wrappedLine, text_size: 18, color: COLORS.link,
                font: CUSTOM_FONT
              });
            } else {
              feedContainer.createWidget(hmUI.widget.TEXT, {
                x: x + 16, y: ty, w: w - 32, h: 24,
                text: wrappedLine, text_size: 18, color: COLORS.textPrimary,
                font: CUSTOM_FONT
              });
            }
            
            ty += 24;
          });
        }
      });

      const time = formatTime(item.date);
      const likes = item.likes ? item.likes.count : 0;
      const reposts = item.reposts ? item.reposts.count : 0;
      const stats = `❤ ${likes} 🔁 ${reposts}   ${time}`;
      
      feedContainer.createWidget(hmUI.widget.TEXT, {
        x: x + 16, y: y + height - 28, w: w - 32, h: 20,
        text: stats, text_size: 14, color: COLORS.textHint, 
        align_h: hmUI.align.RIGHT,
        font: CUSTOM_FONT
      });

      y += height + 16;
    });
  },

  openChat(conv, title) {
    currentConv = conv;
    safeClear();
    currentChatId = Number(conv.conversation.peer.id);
    currentChatTitle = title;

    widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: COLORS.bg });
    widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: HEADER_H, color: COLORS.primary });

    widget(hmUI.widget.BUTTON, {
      x: SCREEN_W / 2 - 50, y: 0, w: 100, h: 40,
      text: "←", text_size: 32, normal_color: 0x00000000,
      click_func: () => { setScrollLock({lock: false}); if (currentTab === "messages") this.renderMessagesTab(); else this.renderFeedTab(); }
    });

    widget(hmUI.widget.BUTTON, {
      x: 0, y: 40, w: SCREEN_W, h: 36,
      text: title, text_size: 24, color: 0xffffff,
      normal_color: COLORS.primary, press_color: COLORS.primaryDark,
      align_h: hmUI.align.CENTER_H, text_style: hmUI.text_style.ELLIPSIS,
      click_func: () => this.showChatInfo(conv)
    });

    messagesContainer = widget(hmUI.widget.VIEW_CONTAINER, {
      x: 0, y: HEADER_H, w: SCREEN_W, h: DRAFT_Y - HEADER_H
    });

    this.drawInput();

    request.call(this, "GET_MESSAGES", { peer_id: currentChatId })
      .then(res => {
        if (!res.success) throw 1;
        currentMessages = res.messages || [];
        currentChatProfiles = res.profiles || [];
        currentChatGroups = res.groups || [];
        this.renderMessages();
      })
      .catch(() => this.showError("Не удалось загрузить сообщения", () => this.openChat(conv, title)));
  },

  async showChatInfo(conv) {
    safeClear();
    widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: COLORS.bg });
    widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: HEADER_H, color: COLORS.primary });

    widget(hmUI.widget.BUTTON, {
      x: SCREEN_W / 2 - 50, y: 0, w: 100, h: 40,
      text: "←", text_size: 32, normal_color: 0x00000000,
      click_func: () => this.openChat(conv, currentChatTitle)
    });

    widget(hmUI.widget.TEXT, {
      x: 0, y: 40, w: SCREEN_W, h: 36,
      text: "Информация", text_size: 24, color: 0xffffff,
      align_h: hmUI.align.CENTER_H,
      font: CUSTOM_FONT
    });

    const infoContainer = widget(hmUI.widget.VIEW_CONTAINER, {
      x: 0, y: HEADER_H, w: SCREEN_W, h: SCREEN_H - HEADER_H
    });

    this.showLoading("Загрузка информации...");

    const peer = conv.conversation.peer;
    const type = peer.type;
    const peerId = peer.id;
    let title = currentChatTitle;
    let description = "";
    let membersCount = 0;
    let members = [];
    let online = false;

    try {
      if (type === "user") {
        const res = await request.call(this, "GET_USER_INFO", { user_id: peerId });
        if (res.success && res.users && res.users.length) {
          const u = res.users[0];
          title = `${u.first_name || ''} ${u.last_name || ''}`.trim();
          description = u.about || u.status || "";
          online = !!u.online;
        }
      } else if (type === "group") {
        const groupId = Math.abs(peerId);
        const gRes = await request.call(this, "GET_GROUP_INFO", { group_id: groupId });
        if (gRes.success && gRes.groups && gRes.groups.length) {
          const g = gRes.groups[0];
          title = g.name || "";
          description = g.description || "";
          membersCount = g.members_count || 0;
        }
        const mRes = await request.call(this, "GET_GROUP_MEMBERS", { group_id: groupId, count: 20 });
        if (mRes.success) {
          members = mRes.users.map(u => `${u.first_name || ''} ${u.last_name || ''}`.trim());
          membersCount = mRes.count || members.length;
        }
      } else if (type === "chat") {
        title = conv.conversation.chat_settings.title || "Беседа";
        const mRes = await request.call(this, "GET_CONVERSATION_MEMBERS", { peer_id: peerId });
        if (mRes.success) {
          membersCount = mRes.count || 0;
          members = mRes.profiles.map(p => `${p.first_name || ''} ${p.last_name || ''}`.trim());
        }
        const ownerId = conv.conversation.chat_settings.owner_id;
        if (ownerId < 0) {
          const groupId = -ownerId;
          const gRes = await request.call(this, "GET_GROUP_INFO", { group_id: groupId });
          if (gRes.success && gRes.groups && gRes.groups.length) {
            description = gRes.groups[0].description || "";
          }
        }
      }

      safeClear();
      widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, color: COLORS.bg });
      widget(hmUI.widget.FILL_RECT, { x: 0, y: 0, w: SCREEN_W, h: HEADER_H, color: COLORS.primary });

      widget(hmUI.widget.BUTTON, {
        x: SCREEN_W / 2 - 50, y: 0, w: 100, h: 40,
        text: "←", text_size: 32, normal_color: 0x00000000,
        click_func: () => this.openChat(conv, currentChatTitle)
      });

      widget(hmUI.widget.TEXT, {
        x: 0, y: 40, w: SCREEN_W, h: 36,
        text: "Информация", text_size: 24, color: 0xffffff,
        align_h: hmUI.align.CENTER_H,
        font: CUSTOM_FONT
      });

      const infoContainer = widget(hmUI.widget.VIEW_CONTAINER, {
        x: 0, y: HEADER_H, w: SCREEN_W, h: SCREEN_H - HEADER_H
      });

      let iy = 20;

      infoContainer.createWidget(hmUI.widget.IMG, {
        x: SCREEN_W / 2 - 75, y: iy, src: 'ava.png', w: 150, h: 150
      });
      iy += 160;

      infoContainer.createWidget(hmUI.widget.TEXT, {
        x: PADDING, y: iy, w: SCREEN_W - PADDING * 2, h: 40,
        text: title, text_size: 26, color: COLORS.textPrimary,
        align_h: hmUI.align.CENTER_H,
        font: CUSTOM_FONT
      });
      iy += 50;

      if (description) {
        const descLines = wrapText(description, 40);
        descLines.forEach((line, i) => {
          infoContainer.createWidget(hmUI.widget.TEXT, {
            x: PADDING, y: iy + i * 24, w: SCREEN_W - PADDING * 2, h: 24,
            text: line, text_size: 18, color: COLORS.textSecondary,
            font: CUSTOM_FONT
          });
        });
        iy += descLines.length * 24 + 20;
      }

      if (type === "user" && online) {
        infoContainer.createWidget(hmUI.widget.TEXT, {
          x: PADDING, y: iy, w: SCREEN_W - PADDING * 2, h: 30,
          text: "Online", text_size: 20, color: COLORS.online,
          align_h: hmUI.align.CENTER_H,
          font: CUSTOM_FONT
        });
        iy += 40;
      }

      if (membersCount > 0 || members.length > 0) {
        infoContainer.createWidget(hmUI.widget.TEXT, {
          x: PADDING, y: iy, w: SCREEN_W - PADDING * 2, h: 30,
          text: `Участники: ${membersCount}`, text_size: 22, color: COLORS.textPrimary,
          font: CUSTOM_FONT
        });
        iy += 40;

        members.forEach((member, i) => {
          infoContainer.createWidget(hmUI.widget.TEXT, {
            x: PADDING + 20, y: iy + i * 28, w: SCREEN_W - PADDING * 2 - 20, h: 28,
            text: member, text_size: 18, color: COLORS.textSecondary,
            font: CUSTOM_FONT
          });
        });
        iy += members.length * 28 + 20;
      }

    } catch (e) {
      this.showError("Не удалось загрузить информацию", () => this.showChatInfo(conv));
    }
  },

  drawInput() {
    const hasText = draftText.trim().length > 0;
    widget(hmUI.widget.FILL_RECT, {
      x: SAFE_AREA_X, y: DRAFT_Y, w: SCREEN_W - SAFE_AREA_X*2, h: DRAFT_H,
      radius: 32, color: COLORS.surface
    });

    widget(hmUI.widget.BUTTON, {
      x: SAFE_AREA_X + 12, y: DRAFT_Y + 8, w: SCREEN_W - SAFE_AREA_X*2 - 84, h: DRAFT_H - 16,
      text: hasText ? draftText : "Написать сообщение...",
      text_size: 18, color: hasText ? COLORS.textPrimary : COLORS.textHint,
      normal_color: 0x00000000, align_h: hmUI.align.LEFT,
      click_func: () => this.showKeyboard()
    });

    if (hasText) {
      widget(hmUI.widget.BUTTON, {
        x: SCREEN_W - SAFE_AREA_X - 60, y: DRAFT_Y + 8, w: 52, h: 52,
        radius: 26, normal_color: COLORS.primary, press_color: COLORS.primaryDark,
        text: "➤", text_size: 28, color: 0xffffff,
        click_func: () => { this.sendMessage(draftText); }
      });
    }
  },

  showKeyboard() {
    this.showCustomKeyboard('message', draftText);
  },

  renderKeyboard(keyboard, baseX, baseY, bubbleWidth) {
    if (!keyboard || !keyboard.buttons || !keyboard.buttons.length) return 0;
    let ky = baseY;
    const colorMap = {
      'primary': { normal: COLORS.primary, press: COLORS.primaryDark },
      'secondary': { normal: 0x444444, press: 0x333333 },
      'positive': { normal: COLORS.accent, press: 0x2a9d4a },
      'negative': { normal: COLORS.error, press: 0xcc4242 }
    };
    keyboard.buttons.forEach(row => {
      let kx = baseX + 8;
      const buttonW = (bubbleWidth - 16) / (row.length || 1);
      row.forEach(btn => {
        const action = btn.action;
        if (action && (action.type === 'text' || action.type === 'callback')) {
          const btnColor = colorMap[btn.color || 'secondary'];
          messagesContainer.createWidget(hmUI.widget.BUTTON, {
            x: kx, y: ky, w: buttonW - 4, h: 40,
            radius: 20, normal_color: btnColor.normal, press_color: btnColor.press,
            text: action.label, text_size: 16, color: 0xffffff,
            click_func: () => {
              const message = action.label || action.payload;
              this.sendMessage(message);
            }
          });
          kx += buttonW;
        }
      });
      ky += 44;
    });
    return ky - baseY;
  },

  renderMessages() {
    if (!messagesContainer) return;
    let y = 20;
    const isGroup = Math.abs(currentChatId) > 2000000000;

    currentMessages.forEach(msg => {
      const content = getMessageContent(msg);
      if (!content) return;
      const isOut = msg.out === 1;
      const isService = !!msg.action;
      const sender = isGroup && !isOut && !isService ? currentChatProfiles.find(p => p.id == msg.from_id) : null;
      const hasName = !!sender;
      const bubble = measureBubble(content, hasName, isOut);
      let x = isOut ? SCREEN_W - bubble.width - PADDING : PADDING;
      let color = isService ? 0x222222 : isOut ? COLORS.bubbleOut : COLORS.bubbleIn;
      if (isService) x = (SCREEN_W - bubble.width) / 2;

      messagesContainer.createWidget(hmUI.widget.FILL_RECT, {
        x, y, w: bubble.width, h: bubble.height,
        radius: BUBBLE_RADIUS, color
      });

      let ty = y + BUBBLE_PAD;
      if (hasName) {
        messagesContainer.createWidget(hmUI.widget.TEXT, {
          x: x + 14, y: ty, w: bubble.width - 28, h: 24,
          text: sender.first_name, text_size: 15, color: COLORS.accent,
          font: CUSTOM_FONT
        });
        ty += 24;
      }

      bubble.lines.forEach((line, i) => {
        messagesContainer.createWidget(hmUI.widget.TEXT, {
          x: x + 14, y: ty + i * LINE_HEIGHT,
          w: bubble.width - 28, h: LINE_HEIGHT,
          text: line, text_size: 18, color: COLORS.textPrimary,
          font: CUSTOM_FONT
        });
      });

      const time = formatTime(msg.date);
      messagesContainer.createWidget(hmUI.widget.TEXT, {
        x: x + 14, y: y + bubble.height - 30,
        w: bubble.width - 28, h: 20,
        text: time, text_size: 13, color: COLORS.textHint,
        align_h: isService ? hmUI.align.CENTER_H : (isOut ? hmUI.align.RIGHT : hmUI.align.LEFT),
        font: CUSTOM_FONT
      });

      let kh = 0;
      if (msg.keyboard && !isOut && !isService) {
        kh = this.renderKeyboard(msg.keyboard, x, y + bubble.height + 4, bubble.width);
      }

      y += bubble.height + kh + 16;
    });
  },

  sendMessage(text) {
    if (!text.trim()) return;
    const random_id = Date.now();
    request.call(this, "SEND_MESSAGE", { peer_id: currentChatId, message: text, random_id })
      .then(res => {
        if (res.success) {
          draftText = "";
          this.drawInput();
          this.openChat(currentConv, currentChatTitle);
        } else throw 1;
      })
      .catch(() => this.showError("Не отправлено", () => {}));
  }
}));
