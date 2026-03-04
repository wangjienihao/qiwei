<template>
  <div class="chat-workbench">
    <section class="chat-sidebar">
      <div class="sidebar-tabs">
        <el-radio-group v-model="conversationFilter" size="mini">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="unread">未读</el-radio-button>
          <el-radio-button label="single">单聊</el-radio-button>
          <el-radio-button label="group">群聊</el-radio-button>
        </el-radio-group>
      </div>

      <div class="sidebar-search">
        <el-input
          v-model.trim="keyword"
          size="small"
          clearable
          placeholder="搜索"
        >
          <i slot="prefix" class="el-input__icon el-icon-search" />
        </el-input>
      </div>

      <div class="conversation-list">
        <div v-if="!visibleContacts.length" class="empty-state">
          <el-empty :image-size="70" description="暂无会话" />
        </div>
        <div
          v-for="contact in visibleContacts"
          :key="contact.key"
          class="conversation-item"
          :class="{ active: selectedContact && selectedContact.key === contact.key }"
          @click="selectContact(contact)"
        >
          <el-avatar :src="contact.avatar" :size="38">
            {{ getInitial(contact.nickname) }}
          </el-avatar>
          <div class="conversation-main">
            <div class="conversation-title">
              <span class="name ellipsis">{{ contact.nickname }}</span>
              <span class="time">{{ contact.lastTime || "-" }}</span>
            </div>
            <div class="conversation-sub">
              <span class="ellipsis">{{ contact.lastMessage || "暂无消息" }}</span>
              <el-badge
                v-if="contact.unreadCount > 0"
                :value="contact.unreadCount"
                :max="99"
                class="badge"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="chat-main">
      <div class="chat-header">
        <div class="header-left">
          <span class="target-name">
            {{ selectedContact ? selectedContact.nickname : "请选择会话" }}
          </span>
          <span class="target-id">{{ conversationId || "-" }}</span>
        </div>
        <div class="header-actions">
          <el-button size="mini" :loading="loadingContacts" @click="loadContacts">
            刷新会话
          </el-button>
          <el-button size="mini" :loading="loadingMessages" @click="loadMessages">
            拉取消息
          </el-button>
          <el-button size="mini" @click="debugVisible = true">调试</el-button>
        </div>
      </div>

      <div ref="msgViewport" class="chat-messages">
        <el-empty
          v-if="!selectedContact"
          :image-size="90"
          description="左侧选择会话后开始聊天"
        />
        <el-empty
          v-else-if="!messages.length"
          :image-size="90"
          description="暂无消息，点击右上角“拉取消息”"
        />
        <div v-else class="message-stream">
          <div
            v-for="(item, index) in messages"
            :key="index"
            class="message-row"
            :class="{ outgoing: item.isOutgoing }"
          >
            <el-avatar
              v-if="!item.isOutgoing"
              :src="selectedContact ? selectedContact.avatar : ''"
              :size="32"
              class="msg-avatar"
            >
              {{ getInitial(item.sender || selectedContact.nickname) }}
            </el-avatar>

            <div class="msg-body">
              <div class="msg-meta">
                <span>{{ item.isOutgoing ? profileName : item.sender || selectedContact.nickname }}</span>
                <span>{{ item.time || "-" }}</span>
              </div>
              <div class="msg-bubble">{{ item.content || "-" }}</div>
            </div>

            <el-avatar
              v-if="item.isOutgoing"
              :src="profileAvatar"
              :size="32"
              class="msg-avatar"
            >
              {{ getInitial(profileName) }}
            </el-avatar>
          </div>
        </div>
      </div>

      <div class="chat-compose">
        <div class="template-row">
          <el-tag
            v-for="template in quickTemplates"
            :key="template"
            size="mini"
            class="template-tag"
            @click="applyQuickTemplate(template)"
          >
            {{ template }}
          </el-tag>
        </div>
        <el-input
          v-model="messageText"
          type="textarea"
          :rows="3"
          resize="none"
          placeholder="输入消息，Ctrl + Enter 快速发送"
          @keydown.native.ctrl.enter="sendText"
        />
        <div class="compose-actions">
          <span class="hint">仅支持文本消息，更多类型后续扩展</span>
          <el-button type="primary" size="mini" :loading="sending" @click="sendText">
            发送
          </el-button>
        </div>
      </div>
    </section>

    <el-drawer
      title="最近接口返回"
      :visible.sync="debugVisible"
      size="32%"
      direction="rtl"
    >
      <pre class="debug-json">{{ prettyLastResponse }}</pre>
    </el-drawer>
  </div>
</template>

<script>
import {
  getErrorCode,
  getErrorMessage,
  hasBusinessError,
} from "../api/guidRequest";
import { requestBySession } from "../api/sessionGateway";
import { inferConversationId, normalizeContacts } from "../utils/contact";

function asList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const candidateKeys = ["list", "items", "rows", "messages", "msg_list", "records"];
  for (const key of candidateKeys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }
  return [];
}

function toTimestamp(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return 0;
  }
  if (typeof raw === "number") {
    return raw > 1e12 ? raw : raw * 1000;
  }
  const num = Number(raw);
  if (!Number.isNaN(num) && String(raw).match(/^\d+$/)) {
    return num > 1e12 ? num : num * 1000;
  }
  const parsed = Date.parse(String(raw).replace(/-/g, "/"));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatTime(raw) {
  const ts = toTimestamp(raw);
  if (!ts) {
    return "";
  }
  const date = new Date(ts);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

function pickFirst(item, keys) {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return "";
}

function buildMessageContent(item) {
  const direct = pickFirst(item, [
    "content",
    "text",
    "msg",
    "message",
    "body",
    "display_content",
  ]);
  if (typeof direct === "string") {
    return direct;
  }
  if (direct && typeof direct === "object") {
    return JSON.stringify(direct);
  }
  const type = String(
    item.msg_type || item.message_type || item.type || "",
  ).toLowerCase();
  if (!type) {
    return "";
  }
  const map = {
    image: "[图片]",
    file: "[文件]",
    video: "[视频]",
    voice: "[语音]",
    link: "[链接]",
    weapp: "[小程序]",
  };
  return map[type] || `[${type}]`;
}

function inferOutgoing(item, profileName) {
  const boolKeys = [
    "from_self",
    "is_self",
    "self",
    "is_send",
    "is_sender",
    "send_by_self",
    "outgoing",
  ];
  for (const key of boolKeys) {
    if (item[key] === true || item[key] === 1 || item[key] === "1") {
      return true;
    }
  }

  const direction = String(item.direction || "").toLowerCase();
  if (["out", "send", "to", "outgoing"].includes(direction)) {
    return true;
  }
  if (["in", "receive", "from", "incoming"].includes(direction)) {
    return false;
  }

  const sender = String(
    item.sender_name || item.nickname || item.from_name || item.from || "",
  );
  if (profileName && sender && sender.includes(profileName)) {
    return true;
  }
  return false;
}

function normalizeMessages(rawData, profileName) {
  return asList(rawData)
    .map((item) => {
      const sender = String(
        item.sender_name ||
          item.nickname ||
          item.from_name ||
          item.from ||
          item.username ||
          "",
      );
      const tsRaw = pickFirst(item, [
        "create_time",
        "send_time",
        "time",
        "timestamp",
        "created_at",
      ]);
      const ts = toTimestamp(tsRaw);
      return {
        sender,
        content: buildMessageContent(item),
        ts,
        time: formatTime(tsRaw),
        isOutgoing: inferOutgoing(item, profileName),
      };
    })
    .sort((a, b) => a.ts - b.ts);
}

function inferConversationKind(contact) {
  const id = String(contact.id || "");
  if (id.startsWith("R:") || id.startsWith("10")) {
    return "group";
  }
  return "single";
}

export default {
  name: "SessionWorkbenchView",
  data() {
    return {
      loadingContacts: false,
      loadingMessages: false,
      sending: false,
      debugVisible: false,
      conversationFilter: "all",
      keyword: "",
      contacts: [],
      selectedContactKey: "",
      conversationId: "",
      messageText: "",
      quickTemplates: [
        "你好，已收到你的消息。",
        "我这边先帮你确认一下。",
        "收到，稍后第一时间回复你。",
      ],
      messages: [],
      lastResponse: null,
    };
  },
  computed: {
    session() {
      return this.$store.state.session;
    },
    profileName() {
      const profile = this.session && this.session.profile;
      if (!profile || typeof profile !== "object") {
        return "我";
      }
      return profile.nickname || profile.name || profile.username || "我";
    },
    profileAvatar() {
      const profile = this.session && this.session.profile;
      if (!profile || typeof profile !== "object") {
        return "";
      }
      return profile.avatar || profile.head_img || profile.headimgurl || "";
    },
    selectedContact() {
      return this.contacts.find((item) => item.key === this.selectedContactKey) || null;
    },
    visibleContacts() {
      const query = this.keyword.toLowerCase();
      return this.contacts
        .filter((item) => {
          if (query) {
            const matched =
              String(item.nickname || "")
                .toLowerCase()
                .includes(query) ||
              String(item.id || "")
                .toLowerCase()
                .includes(query);
            if (!matched) {
              return false;
            }
          }

          const kind = inferConversationKind(item);
          if (this.conversationFilter === "single" && kind !== "single") {
            return false;
          }
          if (this.conversationFilter === "group" && kind !== "group") {
            return false;
          }
          if (this.conversationFilter === "unread" && Number(item.unreadCount || 0) <= 0) {
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          const unreadScore = Number(b.unreadCount || 0) - Number(a.unreadCount || 0);
          if (unreadScore !== 0) {
            return unreadScore;
          }
          return toTimestamp(b.lastTime) - toTimestamp(a.lastTime);
        });
    },
    prettyLastResponse() {
      return JSON.stringify(this.lastResponse || {}, null, 2);
    },
  },
  watch: {
    messages() {
      this.$nextTick(this.scrollToBottom);
    },
  },
  created() {
    this.loadContacts();
  },
  methods: {
    getInitial(text) {
      if (!text) {
        return "友";
      }
      return String(text).slice(0, 1);
    },
    async request(path, data) {
      return requestBySession(this.session, path, data);
    },
    applyQuickTemplate(template) {
      this.messageText = template;
    },
    scrollToBottom() {
      if (!this.$refs.msgViewport) {
        return;
      }
      this.$refs.msgViewport.scrollTop = this.$refs.msgViewport.scrollHeight;
    },
    touchContactSummary({ message, time }) {
      if (!this.selectedContact) {
        return;
      }
      const idx = this.contacts.findIndex((item) => item.key === this.selectedContact.key);
      if (idx < 0) {
        return;
      }
      const next = this.contacts.slice();
      next[idx] = {
        ...next[idx],
        lastMessage: message || next[idx].lastMessage,
        lastTime: time || next[idx].lastTime,
        unreadCount: 0,
      };
      this.contacts = next;
    },
    async selectContact(contact) {
      if (!contact) {
        return;
      }
      this.selectedContactKey = contact.key;
      this.conversationId = inferConversationId(contact);
      this.loadMessages();
    },
    async loadContacts() {
      this.loadingContacts = true;
      try {
        const payload = await this.request("/contact/sync_contact", {
          guid: this.session.guid,
        });
        this.lastResponse = payload;
        if (hasBusinessError(payload)) {
          this.$message.error(getErrorMessage(payload) || "同步联系人失败");
          return;
        }
        this.contacts = normalizeContacts(payload.data);
        if (!this.selectedContactKey && this.contacts.length) {
          this.selectContact(this.contacts[0]);
          return;
        }
        if (
          this.selectedContactKey &&
          !this.contacts.find((item) => item.key === this.selectedContactKey) &&
          this.contacts.length
        ) {
          this.selectContact(this.contacts[0]);
        }
      } catch (error) {
        this.$message.error(error.message || "同步联系人失败");
      } finally {
        this.loadingContacts = false;
      }
    },
    async loadMessages() {
      if (!this.conversationId) {
        return;
      }
      this.loadingMessages = true;
      try {
        const payload = await this.request("/sync/sync_msg", {
          guid: this.session.guid,
          conversation_id: this.conversationId,
        });
        this.lastResponse = payload;
        if (hasBusinessError(payload)) {
          this.$message.error(getErrorMessage(payload) || "拉取消息失败");
          return;
        }
        this.messages = normalizeMessages(payload.data, this.profileName);
        if (!this.messages.length) {
          return;
        }
        const latest = this.messages[this.messages.length - 1];
        this.touchContactSummary({
          message: latest.content,
          time: latest.time,
        });
      } catch (error) {
        this.$message.error(error.message || "拉取消息失败");
      } finally {
        this.loadingMessages = false;
      }
    },
    async sendText() {
      if (!this.conversationId) {
        this.$message.warning("请先从左侧选择会话");
        return;
      }
      if (!this.messageText.trim()) {
        this.$message.warning("请输入消息内容");
        return;
      }
      this.sending = true;
      try {
        const content = this.messageText.trim();
        const payload = await this.request("/msg/send_text", {
          guid: this.session.guid,
          conversation_id: this.conversationId,
          content,
        });
        this.lastResponse = payload;
        const code = getErrorCode(payload);
        if (code !== 0) {
          this.$message.error(getErrorMessage(payload) || "发送失败");
          return;
        }
        const time = formatTime(Date.now());
        this.messages.push({
          sender: this.profileName,
          content,
          ts: Date.now(),
          time,
          isOutgoing: true,
        });
        this.touchContactSummary({
          message: content,
          time,
        });
        this.messageText = "";
      } catch (error) {
        this.$message.error(error.message || "发送失败");
      } finally {
        this.sending = false;
      }
    },
  },
};
</script>

<style scoped>
.chat-workbench {
  display: flex;
  height: calc(100vh - 126px);
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.chat-sidebar {
  width: 300px;
  border-right: 1px solid #ebeef5;
  background: #fafafa;
  display: flex;
  flex-direction: column;
}

.sidebar-tabs {
  padding: 10px;
  border-bottom: 1px solid #ebeef5;
  background: #f5f7fa;
}

.sidebar-search {
  padding: 10px;
  border-bottom: 1px solid #f2f3f5;
}

.conversation-list {
  flex: 1;
  overflow: auto;
}

.conversation-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid #f2f3f5;
  cursor: pointer;
}

.conversation-item:hover {
  background: #f0f7ff;
}

.conversation-item.active {
  background: #e6f1ff;
}

.conversation-main {
  min-width: 0;
  flex: 1;
}

.conversation-title,
.conversation-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.conversation-title .name {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.conversation-title .time {
  font-size: 12px;
  color: #909399;
}

.conversation-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.badge {
  margin-left: 6px;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-header {
  height: 56px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
}

.header-left {
  min-width: 0;
}

.target-name {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.target-id {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.chat-messages {
  flex: 1;
  overflow: auto;
  padding: 14px;
  background: #f8f9fb;
}

.message-stream {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.message-row.outgoing {
  justify-content: flex-end;
}

.message-row.outgoing .msg-body {
  align-items: flex-end;
}

.msg-avatar {
  flex-shrink: 0;
}

.msg-body {
  display: flex;
  flex-direction: column;
  max-width: 70%;
}

.msg-meta {
  display: flex;
  gap: 10px;
  color: #909399;
  font-size: 12px;
  margin-bottom: 4px;
}

.msg-bubble {
  background: #fff;
  color: #303133;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 8px 10px;
  line-height: 1.55;
  word-break: break-word;
}

.message-row.outgoing .msg-bubble {
  background: #d9ecff;
  border-color: #b3d8ff;
}

.chat-compose {
  border-top: 1px solid #ebeef5;
  padding: 10px 12px;
  background: #fff;
}

.template-row {
  margin-bottom: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.template-tag {
  cursor: pointer;
}

.compose-actions {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hint {
  color: #909399;
  font-size: 12px;
}

.empty-state {
  padding: 30px 0;
}

.debug-json {
  background: #1f2d3d;
  color: #d3dce6;
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  max-height: calc(100vh - 140px);
  overflow: auto;
}

.ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
