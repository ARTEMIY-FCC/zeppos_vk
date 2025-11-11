import { BaseSideService } from "@zeppos/zml/base-side";

const VK_API_BASE = "https://api.vk.com/method/";
// ВСТАВЬ СВОИ ТОКЕНЫ ВК СЮДА
const TOKENS = [
  { name: "Аккаунт 1", value: "твой_токен_вк" },
  { name: "Аккаунт 2", value: "можешь_еще_сюда" },
  { name: "Аккаунт 3", value: "и_сюда_если_надо" }
];
let ACCESS_TOKEN = TOKENS.find(t => t.value.trim())?.value || "";
const API_VERSION = "5.131";

class VKClient {
  constructor() {
    this.cache = {
      conversations: null,
      messages: {},
      lastUpdate: {}
    };
  }

  async makeVKRequest(method, params = {}) {
    const url = `${VK_API_BASE}${method}`;
    const urlParams = new URLSearchParams({
      access_token: ACCESS_TOKEN,
      v: API_VERSION,
      ...params
    });
    try {
      console.log(`[VK REQUEST] POST ${method} -> ${url} body(<=240):`, urlParams.toString().substring(0,240));
      const response = await fetch({
        url,
        method: 'POST',
        timeout: 20000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: urlParams.toString()
      });
      const bodyRaw = response && response.body ? response.body : null;
      const responseBody = typeof bodyRaw === 'string' ? JSON.parse(bodyRaw) : bodyRaw;
      if (!responseBody) throw new Error("Empty response from VK API");
      if (responseBody.error) {
        console.error("VK API Error:", responseBody.error);
        throw new Error(responseBody.error.error_msg || "VK API error");
      }
      if (!responseBody.response) throw new Error("Invalid VK API response");
      return responseBody.response;
    } catch (error) {
      console.error(`[makeVKRequest] ${method} error:`, error && error.message ? error.message : error);
      throw error;
    }
  }

  async getConversations() {
    try {
      const response = await this.makeVKRequest('messages.getConversations', {
        count: '40',
        extended: '1'
      });
      const optimizedConversations = (response.items || []).map(item => {
        const conversation = { conversation: item.conversation };
        if (item.last_message) {
          conversation.last_message = {
            text: item.last_message.text || "",
            date: item.last_message.date,
            from_id: item.last_message.from_id,
            out: item.last_message.out
          };
        }
        return conversation;
      });
      const optimizedProfiles = (response.profiles || []).map(p => ({
        id: Number(p.id),
        first_name: p.first_name || "",
        last_name: p.last_name || "",
        photo_50: p.photo_50 || null
      }));
      let optimizedGroups = (response.groups || []).map(g => ({
        id: Number(g.id),
        name: g.name || "",
        screen_name: g.screen_name || "",
        photo_50: g.photo_50 || null
      }));
      this.cache.conversations = {
        conversations: optimizedConversations,
        profiles: optimizedProfiles,
        groups: optimizedGroups
      };
      this.cache.lastUpdate.conversations = Date.now();
      return this.cache.conversations;
    } catch (error) {
      console.error("getConversations error:", error && error.message ? error.message : error);
      if (this.cache.conversations) return this.cache.conversations;
      throw error;
    }
  }

  async getGroupById(groupId) {
    try {
      const response = await this.makeVKRequest('groups.getById', {
        group_id: String(groupId),
        fields: 'description,photo_200,members_count'
      });
      if (Array.isArray(response) && response.length > 0) return response[0];
      return response;
    } catch (error) {
      console.error(`getGroupById(${groupId}) error:`, error && error.message ? error.message : error);
      throw error;
    }
  }

  async getUserById(userId) {
    try {
      const response = await this.makeVKRequest('users.get', {
        user_ids: String(userId),
        fields: 'photo_200,about,status,online'
      });
      if (Array.isArray(response) && response.length > 0) return response[0];
      return response;
    } catch (error) {
      console.error(`getUserById(${userId}) error:`, error && error.message ? error.message : error);
      throw error;
    }
  }

  async getGroupMembers(groupId, count = 20) {
    try {
      const response = await this.makeVKRequest('groups.getMembers', {
        group_id: String(groupId),
        count: String(count),
        fields: 'first_name,last_name'
      });
      return response;
    } catch (error) {
      console.error(`getGroupMembers(${groupId}) error:`, error && error.message ? error.message : error);
      throw error;
    }
  }

  async getConversationMembers(peerId) {
    try {
      const response = await this.makeVKRequest('messages.getConversationMembers', {
        peer_id: String(peerId),
        fields: 'first_name,last_name'
      });
      return response;
    } catch (error) {
      console.error(`getConversationMembers(${peerId}) error:`, error && error.message ? error.message : error);
      throw error;
    }
  }

  async getMessages(peerId, count = 20, offset = 0) {
    try {
      const response = await this.makeVKRequest('messages.getHistory', {
        peer_id: String(peerId),
        count: String(count),
        offset: String(offset),
        extended: '1'
      });
      const optimizedMessages = (response.items || []).map(msg => ({
        id: msg.id,
        text: msg.text ? (msg.text.length > 1000 ? msg.text.substring(0, 1000) + "..." : msg.text) : "",
        date: msg.date,
        from_id: msg.from_id,
        out: msg.out,
        attachments: msg.attachments || []
      }));
      optimizedMessages.reverse();
      const wrapped = {
        messages: optimizedMessages,
        profiles: response.profiles || [],
        groups: response.groups || []
      };
      this.cache.messages[peerId] = wrapped;
      this.cache.lastUpdate.messages = Date.now();
      return wrapped;
    } catch (error) {
      console.error(`getMessages(${peerId}) error:`, error && error.message ? error.message : error);
      if (this.cache.messages[peerId]) return this.cache.messages[peerId];
      throw error;
    }
  }

  async sendMessage(peerId, message, randomId) {
    try {
      const response = await this.makeVKRequest('messages.send', {
        peer_id: String(peerId),
        message: String(message),
        random_id: String(randomId)
      });
      delete this.cache.messages[peerId];
      return { success: true, message_id: response };
    } catch (error) {
      console.error(`sendMessage error to ${peerId}:`, error && error.message ? error.message : error);
      throw error;
    }
  }

  async getProfileInfo() {
    try {
      const response = await this.makeVKRequest('account.getProfileInfo');
      return response;
    } catch (error) {
      console.error("getProfileInfo error:", error && error.message ? error.message : error);
      throw error;
    }
  }

  async getNewsfeed() {
    try {
      const response = await this.makeVKRequest('newsfeed.get', {
        filters: 'post',
        count: '30',
        extended: '1'
      });
      const optimizedItems = (response.items || []).map(item => ({
        type: item.type,
        source_id: item.source_id,
        date: item.date,
        text: item.text || "",
        likes: item.likes || { count: 0 },
        reposts: item.reposts || { count: 0 }
      }));
      const profiles = (response.profiles || []).map(p => ({
        id: Number(p.id),
        first_name: p.first_name || "",
        last_name: p.last_name || ""
      }));
      const groups = (response.groups || []).map(g => ({
        id: Number(g.id),
        name: g.name || ""
      }));
      return { items: optimizedItems, profiles, groups };
    } catch (error) {
      console.error("getNewsfeed error:", error && error.message ? error.message : error);
      throw error;
    }
  }

  async postWall(message) {
    try {
      const response = await this.makeVKRequest('wall.post', {
        message: String(message)
      });
      return response;
    } catch (error) {
      console.error("postWall error:", error && error.message ? error.message : error);
      throw error;
    }
  }
}

const vkClient = new VKClient();

async function handleRequest(method, params, res) {
  try {
    console.log(`=== HANDLE ${method} ===`, params);
    switch (method) {
      case "GET_TOKENS": {
        const validTokens = TOKENS.filter(t => t.value.trim());
        res(null, { success: true, tokens: validTokens.map(t => t.name) });
        break;
      }
      case "SET_TOKEN": {
        const index = params.index;
        const validTokens = TOKENS.filter(t => t.value.trim());
        if (index >= 0 && index < validTokens.length) {
          ACCESS_TOKEN = validTokens[index].value;
          res(null, { success: true });
        } else {
          res(null, { success: false, error: "Invalid index" });
        }
        break;
      }
      case "TEST_VK_API": {
        try {
          const body = new URLSearchParams({ user_ids: '1', v: API_VERSION, access_token: ACCESS_TOKEN }).toString();
          const vkResponse = await fetch({ url: `${VK_API_BASE}users.get`, method: 'POST', timeout: 15000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
          const bodyParsed = typeof vkResponse.body === 'string' ? JSON.parse(vkResponse.body) : vkResponse.body;
          if (bodyParsed.error) res(null, { success: false, error: `VK API Error: ${bodyParsed.error.error_msg}`, step: "vk_api_test" });
          else res(null, { success: true, message: "VK API OK", user_data: bodyParsed.response });
        } catch (err) {
          res(null, { success: false, error: `VK API error: ${err.message}`, step: "vk_api_test" });
        }
        break;
      }
      case "GET_GROUP": {
        const groupId = params.group_id || params.groupId || params.id;
        if (!groupId) {
          res(null, { success: false, error: "group_id required" });
          break;
        }
        try {
          const g = await vkClient.getGroupById(groupId);
          res(null, { success: true, response: Array.isArray(g) ? g : [g] });
        } catch (e) {
          console.error("GET_GROUP error:", e);
          res(null, { success: false, error: e && e.message ? e.message : String(e) });
        }
        break;
      }
      case "GET_GROUP_INFO": {
        const groupId = params.group_id;
        if (!groupId) {
          res(null, { success: false, error: "group_id required" });
          break;
        }
        try {
          const response = await vkClient.getGroupById(groupId);
          res(null, { success: true, groups: Array.isArray(response) ? response : [response] });
        } catch (e) {
          console.error("GET_GROUP_INFO error:", e);
          res(null, { success: false, error: e && e.message ? e.message : String(e) });
        }
        break;
      }
      case "GET_USER_INFO": {
        const userId = params.user_id;
        if (!userId) {
          res(null, { success: false, error: "user_id required" });
          break;
        }
        try {
          const response = await vkClient.getUserById(userId);
          res(null, { success: true, users: Array.isArray(response) ? response : [response] });
        } catch (e) {
          console.error("GET_USER_INFO error:", e);
          res(null, { success: false, error: e && e.message ? e.message : String(e) });
        }
        break;
      }
      case "GET_GROUP_MEMBERS": {
        const groupId = params.group_id;
        if (!groupId) {
          res(null, { success: false, error: "group_id required" });
          break;
        }
        try {
          const response = await vkClient.getGroupMembers(groupId, params.count || 20);
          const optimizedUsers = (response.items || []).map(u => ({
            id: u.id,
            first_name: u.first_name || "",
            last_name: u.last_name || ""
          }));
          res(null, { success: true, count: response.count || 0, users: optimizedUsers });
        } catch (e) {
          console.error("GET_GROUP_MEMBERS error:", e);
          res(null, { success: false, error: e && e.message ? e.message : String(e) });
        }
        break;
      }
      case "GET_CONVERSATION_MEMBERS": {
        const peerId = params.peer_id;
        if (!peerId) {
          res(null, { success: false, error: "peer_id required" });
          break;
        }
        try {
          const response = await vkClient.getConversationMembers(peerId);
          const optimizedProfiles = (response.profiles || []).map(p => ({
            id: p.id,
            first_name: p.first_name || "",
            last_name: p.last_name || ""
          }));
          res(null, { success: true, count: response.count || 0, profiles: optimizedProfiles });
        } catch (e) {
          console.error("GET_CONVERSATION_MEMBERS error:", e);
          res(null, { success: false, error: e && e.message ? e.message : String(e) });
        }
        break;
      }
      case "GET_CONVERSATIONS": {
        const conv = await vkClient.getConversations();
        res(null, {
          success: true,
          conversations: conv.conversations,
          profiles: conv.profiles,
          groups: conv.groups,
          count: conv.conversations.length
        });
        break;
      }
      case "GET_MESSAGES": {
        const peerId = params.peer_id;
        const msgs = await vkClient.getMessages(peerId, 50, 0);
        res(null, {
          success: true,
          messages: msgs.messages,
          profiles: msgs.profiles || [],
          groups: msgs.groups || [],
          count: msgs.messages.length
        });
        break;
      }
      case "SEND_MESSAGE": {
        const peerId = params.peer_id;
        const message = params.message || "";
        const randomId = params.random_id || Math.floor(Math.random() * 1000000);
        const result = await vkClient.sendMessage(peerId, message, randomId);
        res(null, { success: true, message_id: result.message_id || result });
        break;
      }
      case "GET_PROFILE": {
        const profile = await vkClient.getProfileInfo();
        res(null, { success: true, ...profile });
        break;
      }
      case "GET_NEWSFEED": {
        const feed = await vkClient.getNewsfeed();
        res(null, { success: true, items: feed.items, profiles: feed.profiles, groups: feed.groups });
        break;
      }
      case "POST_WALL": {
        const message = params.message || "";
        const result = await vkClient.postWall(message);
        res(null, { success: true, post_id: result.post_id });
        break;
      }
      default:
        res(null, { success: false, error: `Unknown method: ${method}` });
        break;
    }
  } catch (error) {
    console.error("handleRequest ERROR:", error && error.message ? error.message : error);
    res(null, { success: false, error: error && error.message ? error.message : String(error), method });
  }
}

setInterval(async () => {
  try { await vkClient.getConversations(); } catch (e) { console.error("Background conv update failed:", e); }
}, 60000);

AppSideService(
  BaseSideService({
    onInit() { console.log("VK Side initialized"); },
    onRequest(req, res) {
      console.log("=== SIDE REQ ===", req);
      const { method, ...params } = req;
      if (method === "PING") { res(null, { success: true, timestamp: Date.now() }); return; }
      handleRequest(method, params, res);
    },
    onRun() { console.log("VK Side running"); },
    onDestroy() { console.log("VK Side destroyed"); }
  })
);
