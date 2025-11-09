import { BaseSideService } from "@zeppos/zml/base-side";

const VK_API_BASE = "https://api.vk.com/method/";
//PUT YOUR VK TOKEN HERE
const ACCESS_TOKEN = "YOUR_VK_TOKEN";
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
        fields: 'photo_50,screen_name'
      });
      if (Array.isArray(response) && response.length > 0) return response[0];
      return response;
    } catch (error) {
      console.error(`getGroupById(${groupId}) error:`, error && error.message ? error.message : error);
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
}

const vkClient = new VKClient();

async function handleRequest(method, params, res) {
  try {
    console.log(`=== HANDLE ${method} ===`, params);
    switch (method) {
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
