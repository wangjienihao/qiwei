<template>
  <div class="chat-workbench">
    <section class="chat-sidebar">
      <div class="sidebar-tabs">
        <el-radio-group v-model="conversationFilter" size="mini">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="pending">待回复</el-radio-button>
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
          placeholder="搜索会话"
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
              <div class="badges">
                <el-tag
                  v-if="isContactPending(contact)"
                  size="mini"
                  type="warning"
                  effect="plain"
                >
                  待回复
                </el-tag>
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
      </div>
    </section>

    <section class="chat-main">
      <div class="chat-header">
        <div class="header-left">
          <span class="target-name">
            {{ selectedContact ? selectedContact.nickname : "请选择会话" }}
          </span>
          <span class="target-id">{{ conversationId || "-" }}</span>
          <el-tag
            v-if="selectedContact && isContactPending(selectedContact)"
            size="mini"
            type="warning"
            effect="plain"
          >
            待回复
          </el-tag>
        </div>
        <div class="header-actions">
          <div class="realtime-box">
            <span class="sync-time">{{ lastSyncAt ? `同步: ${lastSyncAt}` : "未同步" }}</span>
            <el-switch
              v-model="realtimeEnabled"
              active-text="实时"
              inactive-text="手动"
              @change="onRealtimeToggle"
            />
          </div>
          <el-button size="mini" :disabled="!conversationId" @click="copyConversationId">
            复制会话ID
          </el-button>
          <el-button size="mini" :disabled="!selectedContact" @click="openDetailDrawer">
            详情
          </el-button>
          <el-button size="mini" :disabled="!selectedContact" @click="nextPendingConversation">
            下一条待回复
          </el-button>
          <el-button size="mini" :disabled="!selectedContact" @click="markCurrentAsRead">
            标记已读
          </el-button>
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
          <div v-if="hiddenMessageCount > 0" class="stream-tip">
            为保证流畅，仅展示最近 {{ renderMessages.length }} 条消息（更早
            {{ hiddenMessageCount }} 条已折叠）
          </div>
          <template v-for="item in displayMessages">
            <div v-if="item.kind === 'divider'" :key="item.key" class="time-divider">
              <span>{{ item.label }}</span>
            </div>
            <div
              v-else
              :key="item.key"
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
                  <span>
                    {{ item.isOutgoing ? profileName : item.sender || selectedContact.nickname }}
                  </span>
                  <span>{{ item.time || "-" }}</span>
                </div>
                <div class="msg-bubble">{{ item.content }}</div>
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
          </template>
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
      title="会话详情"
      :visible.sync="detailVisible"
      size="30%"
      direction="rtl"
    >
      <div v-if="!selectedContact" class="detail-empty">
        <el-empty :image-size="74" description="未选择会话" />
      </div>
      <template v-else>
        <div class="detail-profile">
          <el-avatar :src="selectedContact.avatar" :size="54">
            {{ getInitial(selectedContact.nickname) }}
          </el-avatar>
          <div class="detail-main">
            <div class="nickname">{{ selectedContact.nickname }}</div>
            <div class="subid">{{ selectedContact.id }}</div>
          </div>
        </div>

        <div class="detail-actions">
          <el-button
            size="mini"
            :loading="contactDetailLoading"
            @click="syncContactDetail"
          >
            同步资料
          </el-button>
        </div>

        <div class="detail-block">
          <div class="block-title">会话摘要</div>
          <div class="detail-item">
            <span>会话类型</span>
            <el-tag size="mini" :type="selectedContactKind === 'group' ? 'warning' : 'success'">
              {{ selectedContactKind === "group" ? "群聊" : "单聊" }}
            </el-tag>
          </div>
          <div class="detail-item">
            <span>未读数</span>
            <b>{{ selectedContact.unreadCount || 0 }}</b>
          </div>
          <div class="detail-item">
            <span>最近时间</span>
            <b>{{ selectedContact.lastTime || "-" }}</b>
          </div>
        </div>

        <div class="detail-block">
          <div class="block-title">标签</div>
          <div class="tag-list">
            <el-tag
              v-for="tag in selectedContactTags"
              :key="tag.id"
              size="mini"
              class="mini-gap"
            >
              {{ tag.name }}
            </el-tag>
            <span v-if="!selectedContactTags.length" class="hint">暂无标签</span>
          </div>
        </div>

        <div class="detail-block">
          <div class="block-title">接口详情</div>
          <pre class="detail-json">{{ prettyContactDetail }}</pre>
        </div>
      </template>
    </el-drawer>

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

const TAG_ASSIGNMENT_STORAGE_KEY = "qiwei_tag_assignments_v1";
const DEFAULT_REALTIME_INTERVAL_MS = 5000;
const MAX_MESSAGE_CACHE = 400;
const MAX_MESSAGE_RENDER = 160;
const AUTO_SCROLL_THRESHOLD_PX = 96;
const DUPLICATE_TS_WINDOW_MS = 20 * 1000;
const DUPLICATE_SCAN_TAIL = 100;

function asList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const candidateKeys = [
    "list",
    "items",
    "rows",
    "messages",
    "msg_list",
    "records",
    "label_list",
    "labels",
    "data",
  ];
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

function stripConversationPrefix(value) {
  return String(value || "")
    .trim()
    .replace(/^(S:|R:)/i, "");
}

function normalizeConversationId(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return "";
  }
  const text = String(raw).trim();
  if (!text) {
    return "";
  }
  const upper = text.toUpperCase();
  if (upper.startsWith("S:") || upper.startsWith("R:")) {
    return `${upper[0]}:${text.slice(2)}`;
  }
  if (text.startsWith("10")) {
    return `R:${text}`;
  }
  if (text.startsWith("788") || text.startsWith("168")) {
    return `S:${text}`;
  }
  return text;
}

function buildConversationTargets(conversationId) {
  const normalized = normalizeConversationId(conversationId);
  const pure = stripConversationPrefix(conversationId);
  const set = new Set([normalized, pure]);
  if (pure.startsWith("10")) {
    set.add(`R:${pure}`);
  }
  if (pure.startsWith("788") || pure.startsWith("168")) {
    set.add(`S:${pure}`);
  }
  return Array.from(set).filter(Boolean);
}

function createConversationTargetSet(conversationId) {
  return new Set(buildConversationTargets(conversationId));
}

function getByPath(target, path) {
  if (!target || typeof target !== "object") {
    return undefined;
  }
  const segments = String(path).split(".");
  let current = target;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function collectValuesByKeys(item, keys) {
  if (!item || typeof item !== "object") {
    return [];
  }
  const values = [];
  keys.forEach((key) => {
    const value = key.includes(".") ? getByPath(item, key) : item[key];
    if (Array.isArray(value)) {
      value.forEach((row) => {
        if (row !== undefined && row !== null && row !== "") {
          values.push(row);
        }
      });
      return;
    }
    if (value !== undefined && value !== null && value !== "") {
      values.push(value);
    }
  });
  return values;
}

function addConversationCandidateVariants(set, value) {
  if (!set) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => addConversationCandidateVariants(set, item));
    return;
  }
  if (value === undefined || value === null || value === "") {
    return;
  }
  const text = String(value).trim();
  if (!text) {
    return;
  }
  set.add(text);
  const normalized = normalizeConversationId(text);
  if (normalized) {
    set.add(normalized);
  }
  const pure = stripConversationPrefix(text);
  if (pure) {
    set.add(pure);
  }
}

function addIdentityCandidateVariants(set, value) {
  if (!set) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => addIdentityCandidateVariants(set, item));
    return;
  }
  if (value === undefined || value === null || value === "") {
    return;
  }
  const text = String(value).trim();
  if (!text) {
    return;
  }
  set.add(text);
  if (/^(S:|R:)/i.test(text)) {
    set.add(stripConversationPrefix(text));
  }
}

function hasTargetMatch(values, targetSet) {
  if (!targetSet || !targetSet.size || !Array.isArray(values) || !values.length) {
    return false;
  }
  for (let i = 0; i < values.length; i += 1) {
    if (targetSet.has(values[i])) {
      return true;
    }
  }
  return false;
}

function collectConversationCandidates(item) {
  const values = collectValuesByKeys(item, [
    "conversation_id",
    "conversationId",
    "conv_id",
    "to_conversation_id",
    "from_conversation_id",
    "conversation.id",
    "conversation.conversation_id",
    "session.conversation_id",
    "chat.conversation_id",
    "room_id",
  ]);
  const set = new Set();
  values.forEach((value) => addConversationCandidateVariants(set, value));
  return Array.from(set);
}

function collectParticipantCandidates(item) {
  const values = collectValuesByKeys(item, [
    "from_id",
    "to_id",
    "peer_id",
    "target_id",
    "sender_id",
    "sender_user_id",
    "sender_userid",
    "sender_wxid",
    "from_user_id",
    "from_userid",
    "to_user_id",
    "to_userid",
    "user_id",
    "userid",
    "external_user_id",
    "external_userid",
    "friend_id",
    "contact_id",
    "contactId",
    "receiver_id",
    "receive_id",
    "talker",
    "from.id",
    "to.id",
    "sender.id",
    "receiver.id",
    "from.user_id",
    "to.user_id",
  ]);
  const set = new Set();
  values.forEach((value) => addIdentityCandidateVariants(set, value));
  return Array.from(set);
}

function collectSenderCandidates(item) {
  const values = collectValuesByKeys(item, [
    "from_id",
    "sender_id",
    "sender_user_id",
    "sender_userid",
    "sender_wxid",
    "from_user_id",
    "from_userid",
    "from.id",
    "sender.id",
    "from.user_id",
  ]);
  const set = new Set();
  values.forEach((value) => addIdentityCandidateVariants(set, value));
  return Array.from(set);
}

function collectReceiverCandidates(item) {
  const values = collectValuesByKeys(item, [
    "to_id",
    "target_id",
    "peer_id",
    "receiver_id",
    "receive_id",
    "to_user_id",
    "to_userid",
    "to.id",
    "receiver.id",
    "to.user_id",
  ]);
  const set = new Set();
  values.forEach((value) => addIdentityCandidateVariants(set, value));
  return Array.from(set);
}

function buildContactPeerTargetSet(contact) {
  const set = new Set();
  if (!contact || typeof contact !== "object") {
    return set;
  }
  addIdentityCandidateVariants(set, contact.id);
  const raw = contact.raw && typeof contact.raw === "object" ? contact.raw : {};
  collectValuesByKeys(raw, [
    "id",
    "user_id",
    "userid",
    "external_user_id",
    "external_userid",
    "wxid",
    "uid",
    "peer_id",
    "target_id",
    "contact_id",
    "contactId",
    "friend_id",
    "profile.user_id",
    "profile.external_user_id",
    "profile.userid",
    "profile.wxid",
  ]).forEach((value) => addIdentityCandidateVariants(set, value));
  return set;
}

function hasMessageHints(message) {
  return (
    (Array.isArray(message.conversationCandidates) &&
      message.conversationCandidates.length > 0) ||
    (Array.isArray(message.participantCandidates) &&
      message.participantCandidates.length > 0) ||
    (Array.isArray(message.senderCandidates) && message.senderCandidates.length > 0) ||
    (Array.isArray(message.receiverCandidates) && message.receiverCandidates.length > 0)
  );
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function buildContactNameSet(contact) {
  const set = new Set();
  if (!contact || typeof contact !== "object") {
    return set;
  }
  [
    contact.nickname,
    contact.name,
    contact.remark,
    contact.alias,
  ].forEach((value) => {
    const normalized = normalizeName(value);
    if (normalized) {
      set.add(normalized);
    }
  });
  const raw = contact.raw && typeof contact.raw === "object" ? contact.raw : {};
  collectValuesByKeys(raw, [
    "nickname",
    "name",
    "remark",
    "alias",
    "display_name",
    "contact_name",
    "wx_nickname",
  ]).forEach((value) => {
    const normalized = normalizeName(value);
    if (normalized) {
      set.add(normalized);
    }
  });
  return set;
}

function buildSelfTargetSet(session) {
  const set = new Set();
  if (!session || typeof session !== "object") {
    return set;
  }
  collectValuesByKeys(session, [
    "guid",
    "uid",
    "id",
    "user_id",
    "userid",
    "wxid",
    "profile.id",
    "profile.uid",
    "profile.guid",
    "profile.user_id",
    "profile.userid",
    "profile.external_user_id",
    "profile.external_userid",
    "profile.wxid",
  ]).forEach((value) => addIdentityCandidateVariants(set, value));
  return set;
}

function buildSelfNameSet(session, profileName) {
  const set = new Set();
  const addName = (value) => {
    const normalized = normalizeName(value);
    if (normalized) {
      set.add(normalized);
    }
  };
  addName(profileName);
  if (!session || typeof session !== "object") {
    return set;
  }
  collectValuesByKeys(session, [
    "name",
    "nickname",
    "username",
    "profile.name",
    "profile.nickname",
    "profile.username",
    "profile.remark",
    "profile.alias",
  ]).forEach(addName);
  return set;
}

function resolveOutgoingDirection(
  message,
  selfTargetSet,
  selfNameSet,
  peerTargetSet,
  peerNameSet,
) {
  if (hasTargetMatch(message.senderCandidates, selfTargetSet)) {
    return true;
  }
  if (hasTargetMatch(message.receiverCandidates, selfTargetSet)) {
    return false;
  }
  if (hasTargetMatch(message.senderCandidates, peerTargetSet)) {
    return false;
  }
  if (hasTargetMatch(message.receiverCandidates, peerTargetSet)) {
    return true;
  }
  const senderName = normalizeName(message.sender);
  if (senderName) {
    if (selfNameSet.has(senderName)) {
      return true;
    }
    if (peerNameSet.has(senderName)) {
      return false;
    }
  }
  return Boolean(message.isOutgoing);
}

function messageBelongsToConversation(
  message,
  conversationTargetSet,
  peerTargetSet,
  peerNameSet,
  selectedContactKind,
) {
  if (hasTargetMatch(message.conversationCandidates, conversationTargetSet)) {
    return true;
  }
  if (hasTargetMatch(message.participantCandidates, peerTargetSet)) {
    return true;
  }
  if (hasMessageHints(message)) {
    return false;
  }
  if (selectedContactKind === "single") {
    const senderName = normalizeName(message.sender);
    return Boolean(senderName && peerNameSet.has(senderName));
  }
  return false;
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

function formatDividerLabel(ts) {
  if (!ts) {
    return "";
  }
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function isSameDay(a, b) {
  if (!a || !b) {
    return false;
  }
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function pickFirst(item, keys) {
  if (!item || typeof item !== "object") {
    return "";
  }
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

function normalizeVisibleText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isDisplayableMessage(item) {
  if (!item || typeof item !== "object") {
    return false;
  }
  return Boolean(normalizeVisibleText(item.content));
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
      const row = item && typeof item === "object" ? item : {};
      const sender = String(
        row.sender_name ||
          row.nickname ||
          row.from_name ||
          row.from ||
          row.username ||
          "",
      );
      const tsRaw = pickFirst(row, [
        "create_time",
        "send_time",
        "time",
        "timestamp",
        "created_at",
      ]);
      const ts = toTimestamp(tsRaw);
      const messageId = String(
        pickFirst(row, [
          "msg_id",
          "message_id",
          "msgid",
          "msgId",
          "id",
          "client_msg_id",
          "clientMsgId",
          "server_msg_id",
          "serverMsgId",
          "msg_svr_id",
          "msgsvrid",
          "new_msg_id",
          "newmsgid",
          "local_id",
        ]) || "",
      ).trim();
      const conversationCandidates = collectConversationCandidates(row);
      const participantCandidates = collectParticipantCandidates(row);
      const senderCandidates = collectSenderCandidates(row);
      const receiverCandidates = collectReceiverCandidates(row);
      return {
        sender,
        content: buildMessageContent(row),
        ts,
        time: formatTime(tsRaw),
        messageId,
        conversationId: conversationCandidates[0] || "",
        conversationCandidates,
        participantCandidates,
        senderCandidates,
        receiverCandidates,
        isOutgoing: inferOutgoing(row, profileName),
      };
    })
    .filter((item) => isDisplayableMessage(item))
    .sort(compareMessagesByTime);
}

function getMessageIdentity(msg) {
  if (msg.messageId) {
    return `id:${msg.messageId}`;
  }
  const conversationKey =
    msg.conversationId ||
    (Array.isArray(msg.conversationCandidates) && msg.conversationCandidates[0]) ||
    (Array.isArray(msg.participantCandidates) && msg.participantCandidates[0]) ||
    (Array.isArray(msg.senderCandidates) && msg.senderCandidates[0]) ||
    (Array.isArray(msg.receiverCandidates) && msg.receiverCandidates[0]) ||
    "";
  return `t:${msg.ts}|cv:${conversationKey}|s:${msg.sender}|c:${msg.content}|o:${Number(msg.isOutgoing)}`;
}

function getSortableMessageTs(message) {
  const ts = Number(message && message.ts ? message.ts : 0);
  if (Number.isFinite(ts) && ts > 0) {
    return ts;
  }
  return Number.MAX_SAFE_INTEGER;
}

function compareMessagesByTime(a, b) {
  const aTs = getSortableMessageTs(a);
  const bTs = getSortableMessageTs(b);
  if (aTs !== bTs) {
    return aTs - bTs;
  }
  const aTime = normalizeVisibleText(a && a.time);
  const bTime = normalizeVisibleText(b && b.time);
  if (aTime !== bTime) {
    return aTime.localeCompare(bTime);
  }
  const aKey = getMessageIdentity(a || {});
  const bKey = getMessageIdentity(b || {});
  if (aKey === bKey) {
    return 0;
  }
  return aKey > bKey ? 1 : -1;
}

function normalizeTextForDedupe(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function mergeUniqueArray(a, b) {
  return Array.from(new Set([...(a || []), ...(b || [])].filter(Boolean)));
}

function isSameArray(a, b) {
  if (a === b) {
    return true;
  }
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function mergeMessageRecord(base, incoming) {
  const mergedConversationCandidates = mergeUniqueArray(
    base.conversationCandidates,
    incoming.conversationCandidates,
  );
  const mergedParticipantCandidates = mergeUniqueArray(
    base.participantCandidates,
    incoming.participantCandidates,
  );
  const mergedSenderCandidates = mergeUniqueArray(
    base.senderCandidates,
    incoming.senderCandidates,
  );
  const mergedReceiverCandidates = mergeUniqueArray(
    base.receiverCandidates,
    incoming.receiverCandidates,
  );
  const next = {
    ...base,
    ...incoming,
    messageId: incoming.messageId || base.messageId,
    sender: incoming.sender || base.sender,
    content: incoming.content || base.content,
    ts: incoming.ts || base.ts,
    time: incoming.time || base.time,
    conversationCandidates: mergedConversationCandidates,
    participantCandidates: mergedParticipantCandidates,
    senderCandidates: mergedSenderCandidates,
    receiverCandidates: mergedReceiverCandidates,
    conversationId:
      incoming.conversationId ||
      base.conversationId ||
      mergedConversationCandidates[0] ||
      mergedParticipantCandidates[0] ||
      "",
    isOutgoing:
      incoming.isOutgoing === undefined ? Boolean(base.isOutgoing) : Boolean(incoming.isOutgoing),
  };
  const unchanged =
    next.messageId === base.messageId &&
    next.sender === base.sender &&
    next.content === base.content &&
    Number(next.ts || 0) === Number(base.ts || 0) &&
    next.time === base.time &&
    next.conversationId === base.conversationId &&
    Boolean(next.isOutgoing) === Boolean(base.isOutgoing) &&
    isSameArray(next.conversationCandidates, base.conversationCandidates) &&
    isSameArray(next.participantCandidates, base.participantCandidates) &&
    isSameArray(next.senderCandidates, base.senderCandidates) &&
    isSameArray(next.receiverCandidates, base.receiverCandidates);
  return unchanged ? base : next;
}

function hasArrayOverlap(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) {
    return false;
  }
  const set = new Set(a);
  for (let i = 0; i < b.length; i += 1) {
    if (set.has(b[i])) {
      return true;
    }
  }
  return false;
}

function isLikelyDuplicateMessage(existing, incoming) {
  if (!existing || !incoming) {
    return false;
  }
  if (existing.messageId && incoming.messageId) {
    return existing.messageId === incoming.messageId;
  }
  if (Boolean(existing.isOutgoing) !== Boolean(incoming.isOutgoing)) {
    return false;
  }
  const existingContent = normalizeTextForDedupe(existing.content);
  const incomingContent = normalizeTextForDedupe(incoming.content);
  if (!existingContent || existingContent !== incomingContent) {
    return false;
  }
  const existingTs = Number(existing.ts || 0);
  const incomingTs = Number(incoming.ts || 0);
  if (existingTs > 0 && incomingTs > 0) {
    const tsDelta = Math.abs(existingTs - incomingTs);
    if (tsDelta > DUPLICATE_TS_WINDOW_MS) {
      return false;
    }
  }
  const existingSender = String(existing.sender || "").trim();
  const incomingSender = String(incoming.sender || "").trim();
  if (existingSender && incomingSender && existingSender !== incomingSender) {
    return false;
  }
  const existingTargets = mergeUniqueArray(
    mergeUniqueArray(existing.conversationCandidates, existing.participantCandidates),
    mergeUniqueArray(existing.senderCandidates, existing.receiverCandidates),
  );
  const incomingTargets = mergeUniqueArray(
    mergeUniqueArray(incoming.conversationCandidates, incoming.participantCandidates),
    mergeUniqueArray(incoming.senderCandidates, incoming.receiverCandidates),
  );
  if (existingTargets.length && incomingTargets.length) {
    return hasArrayOverlap(existingTargets, incomingTargets);
  }
  return true;
}

function mergeMessageArrays(existing, incoming, maxSize = MAX_MESSAGE_CACHE) {
  const mergedList = existing.slice();
  const strictIndexMap = new Map();
  mergedList.forEach((item, index) => {
    strictIndexMap.set(getMessageIdentity(item), index);
  });
  const newItems = [];
  let changed = false;
  incoming.forEach((item) => {
    const strictIdentity = getMessageIdentity(item);
    if (strictIndexMap.has(strictIdentity)) {
      const existingIndex = strictIndexMap.get(strictIdentity);
      const mergedItem = mergeMessageRecord(mergedList[existingIndex], item);
      if (mergedItem !== mergedList[existingIndex]) {
        mergedList[existingIndex] = mergedItem;
        changed = true;
      }
      strictIndexMap.set(getMessageIdentity(mergedItem), existingIndex);
      return;
    }

    const start = Math.max(0, mergedList.length - DUPLICATE_SCAN_TAIL);
    let duplicateIndex = -1;
    for (let i = mergedList.length - 1; i >= start; i -= 1) {
      if (isLikelyDuplicateMessage(mergedList[i], item)) {
        duplicateIndex = i;
        break;
      }
    }
    if (duplicateIndex >= 0) {
      const mergedItem = mergeMessageRecord(mergedList[duplicateIndex], item);
      if (mergedItem !== mergedList[duplicateIndex]) {
        mergedList[duplicateIndex] = mergedItem;
        changed = true;
      }
      strictIndexMap.set(getMessageIdentity(mergedItem), duplicateIndex);
      return;
    }

    mergedList.push(item);
    strictIndexMap.set(strictIdentity, mergedList.length - 1);
    changed = true;
    newItems.push(item);
  });
  let merged = mergedList.slice().sort(compareMessagesByTime);
  let trimmed = false;
  if (maxSize > 0 && merged.length > maxSize) {
    merged = merged.slice(merged.length - maxSize);
    trimmed = true;
  }
  return {
    merged,
    newItems,
    changed: trimmed || changed,
  };
}

function keepRecentMessages(messages, maxSize = MAX_MESSAGE_CACHE) {
  if (maxSize <= 0 || messages.length <= maxSize) {
    return messages;
  }
  return messages.slice(messages.length - maxSize);
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
      detailVisible: false,
      contactDetailLoading: false,
      realtimeEnabled: true,
      realtimeIntervalMs: DEFAULT_REALTIME_INTERVAL_MS,
      realtimeTimer: null,
      realtimeBusy: false,
      isPageVisible: true,
      lastSyncAt: "",
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
      contactDetail: null,
      assignmentMap: {},
      tagNameMap: {},
      pendingMap: {},
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
    selectedContactKind() {
      if (!this.selectedContact) {
        return "single";
      }
      return inferConversationKind(this.selectedContact);
    },
    selectedContactTags() {
      if (!this.selectedContact) {
        return [];
      }
      const rawId = String(this.selectedContact.id || "");
      const candidates = [rawId, rawId.replace(/^S:/, ""), rawId.replace(/^R:/, "")];
      let ids = [];
      for (const id of candidates) {
        if (Array.isArray(this.assignmentMap[id]) && this.assignmentMap[id].length) {
          ids = this.assignmentMap[id];
          break;
        }
      }
      return ids.map((id) => ({
        id,
        name: this.tagNameMap[id] || id,
      }));
    },
    prettyContactDetail() {
      if (!this.detailVisible) {
        return "";
      }
      return JSON.stringify(this.contactDetail || {}, null, 2);
    },
    renderMessages() {
      return keepRecentMessages(this.messages, MAX_MESSAGE_RENDER);
    },
    hiddenMessageCount() {
      return Math.max(0, this.messages.length - this.renderMessages.length);
    },
    displayMessages() {
      const rows = [];
      let lastTs = 0;
      for (let i = 0; i < this.renderMessages.length; i += 1) {
        const item = this.renderMessages[i];
        const ts = item.ts || 0;
        const identity = getMessageIdentity(item) || `${ts || 0}_${i}`;
        const needDivider =
          i === 0 ||
          !lastTs ||
          !isSameDay(lastTs, ts) ||
          Math.abs(ts - lastTs) > 5 * 60 * 1000;
        if (needDivider) {
          rows.push({
            kind: "divider",
            key: `d_${identity}`,
            label: formatDividerLabel(ts),
          });
        }
        rows.push({
          ...item,
          kind: "message",
          key: `m_${identity}`,
        });
        lastTs = ts;
      }
      return rows;
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
          if (this.conversationFilter === "pending" && !this.isContactPending(item)) {
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          const pendingScore =
            Number(this.isContactPending(b)) - Number(this.isContactPending(a));
          if (pendingScore !== 0) {
            return pendingScore;
          }
          const unreadScore = Number(b.unreadCount || 0) - Number(a.unreadCount || 0);
          if (unreadScore !== 0) {
            return unreadScore;
          }
          return Number(b.lastTs || 0) - Number(a.lastTs || 0);
        });
    },
    prettyLastResponse() {
      if (!this.debugVisible) {
        return "";
      }
      return JSON.stringify(this.lastResponse || {}, null, 2);
    },
  },
  watch: {
    messages(next, prev) {
      const nextLength = Array.isArray(next) ? next.length : 0;
      const prevLength = Array.isArray(prev) ? prev.length : 0;
      if (nextLength <= prevLength) {
        return;
      }
      this.$nextTick(() => this.scrollToBottom(false));
    },
    selectedContactKey() {
      this.contactDetail = null;
    },
  },
  created() {
    if (typeof document !== "undefined") {
      this.isPageVisible = !document.hidden;
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    }
    this.restoreAssignmentMap();
    this.loadTagMap();
    this.loadContacts();
  },
  beforeDestroy() {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
    }
    this.stopRealtimePolling();
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
    updateLastSyncTime() {
      this.lastSyncAt = formatTime(Date.now());
    },
    onVisibilityChange() {
      if (typeof document === "undefined") {
        this.isPageVisible = true;
        return;
      }
      this.isPageVisible = !document.hidden;
      if (!this.isPageVisible) {
        this.stopRealtimePolling();
        return;
      }
      this.restartRealtimePolling();
      if (this.realtimeEnabled && this.conversationId) {
        this.syncMessages({ silent: true });
      }
    },
    onRealtimeToggle() {
      this.restartRealtimePolling();
      if (this.realtimeEnabled && this.conversationId) {
        this.syncMessages({ silent: true });
      }
    },
    startRealtimePolling() {
      if (!this.realtimeEnabled || !this.conversationId || !this.isPageVisible) {
        return;
      }
      this.stopRealtimePolling();
      this.realtimeTimer = setInterval(() => {
        if (!this.isPageVisible) {
          return;
        }
        this.syncMessages({ silent: true });
      }, this.realtimeIntervalMs);
    },
    stopRealtimePolling() {
      if (this.realtimeTimer) {
        clearInterval(this.realtimeTimer);
      }
      this.realtimeTimer = null;
    },
    restartRealtimePolling() {
      this.stopRealtimePolling();
      this.startRealtimePolling();
    },
    async syncMessages({ silent = false } = {}) {
      if (!this.conversationId) {
        return;
      }
      if (silent && !this.isPageVisible) {
        return;
      }
      if (this.realtimeBusy) {
        return;
      }
      const currentConversationId = this.conversationId;
      this.realtimeBusy = true;
      if (!silent) {
        this.loadingMessages = true;
      }
      try {
        const payload = await this.request("/sync/sync_msg", {
          guid: this.session.guid,
          conversation_id: currentConversationId,
        });
        // Ignore stale response from old conversation.
        if (currentConversationId !== this.conversationId) {
          return;
        }
        if (!silent || this.debugVisible) {
          this.lastResponse = payload;
        }
        if (hasBusinessError(payload)) {
          if (!silent) {
            this.$message.error(getErrorMessage(payload) || "拉取消息失败");
          }
          return;
        }

        const incomingAll = normalizeMessages(payload.data, this.profileName);
        const conversationTargetSet = createConversationTargetSet(currentConversationId);
        const peerTargetSet = buildContactPeerTargetSet(this.selectedContact);
        const peerNameSet = buildContactNameSet(this.selectedContact);
        const selfTargetSet = buildSelfTargetSet(this.session);
        const selfNameSet = buildSelfNameSet(this.session, this.profileName);
        const incoming = incomingAll
          .filter((item) =>
            messageBelongsToConversation(
              item,
              conversationTargetSet,
              peerTargetSet,
              peerNameSet,
              this.selectedContactKind,
            ),
          )
          .map((item) => ({
            ...item,
            isOutgoing: resolveOutgoingDirection(
              item,
              selfTargetSet,
              selfNameSet,
              peerTargetSet,
              peerNameSet,
            ),
          }));

        const existingMessages = this.messages.filter((item) =>
          isDisplayableMessage(item),
        );
        const { merged, newItems, changed } = mergeMessageArrays(
          existingMessages,
          incoming,
          MAX_MESSAGE_CACHE,
        );
        if (changed) {
          this.messages = merged;
        }
        if (!silent || changed) {
          this.updateLastSyncTime();
        }

        if (!merged.length || !newItems.length) {
          return;
        }
        const latest = merged[merged.length - 1];
        this.touchContactSummary({
          message: latest.content,
          time: latest.time,
        });
        if (this.selectedContact) {
          const hasNewIncoming = newItems.some((item) => !item.isOutgoing);
          this.markPendingState(
            this.selectedContact.key,
            hasNewIncoming && Number(this.selectedContact.unreadCount || 0) === 0,
          );
        }
      } catch (error) {
        if (!silent) {
          this.$message.error(error.message || "拉取消息失败");
        }
      } finally {
        if (!silent) {
          this.loadingMessages = false;
        }
        this.realtimeBusy = false;
      }
    },
    isContactPending(contact) {
      if (!contact) {
        return false;
      }
      if (Number(contact.unreadCount || 0) > 0) {
        return true;
      }
      return Boolean(this.pendingMap[contact.key]);
    },
    restoreAssignmentMap() {
      try {
        const raw = window.localStorage.getItem(TAG_ASSIGNMENT_STORAGE_KEY);
        if (!raw) {
          this.assignmentMap = {};
          return;
        }
        const parsed = JSON.parse(raw);
        this.assignmentMap = parsed && typeof parsed === "object" ? parsed : {};
      } catch (error) {
        this.assignmentMap = {};
      }
    },
    async loadTagMap() {
      try {
        const payload = await this.request("/label/sync_label_list", {
          guid: this.session.guid,
        });
        if (hasBusinessError(payload)) {
          return;
        }
        const map = {};
        asList(payload.data).forEach((row) => {
          const id = String(row.id || row.label_id || row.tag_id || "");
          const name = String(row.name || row.label_name || row.tag_name || "");
          if (id) {
            map[id] = name || id;
          }
        });
        this.tagNameMap = map;
      } catch (error) {
        // ignore
      }
    },
    applyQuickTemplate(template) {
      this.messageText = template;
    },
    async copyConversationId() {
      if (!this.conversationId) {
        return;
      }
      try {
        await navigator.clipboard.writeText(this.conversationId);
        this.$message.success("会话ID已复制");
      } catch (error) {
        this.$message.warning("复制失败，请手动复制");
      }
    },
    openDetailDrawer() {
      if (!this.selectedContact) {
        this.$message.warning("请先选择会话");
        return;
      }
      this.detailVisible = true;
      if (!this.contactDetail) {
        this.syncContactDetail();
      }
    },
    async syncContactDetail() {
      if (!this.selectedContact) {
        return;
      }
      this.contactDetailLoading = true;
      try {
        const rawId = String(this.selectedContact.id || "");
        const userId = rawId.replace(/^S:/, "").replace(/^R:/, "");
        const payload = await this.request("/contact/batch_get_userinfo", {
          guid: this.session.guid,
          user_ids: [userId],
          contact_ids: [userId],
          ids: [userId],
        });
        this.lastResponse = payload;
        if (hasBusinessError(payload)) {
          this.$message.error(getErrorMessage(payload) || "同步资料失败");
          return;
        }
        this.contactDetail = payload.data || {};
        this.$message.success("资料同步成功");
      } catch (error) {
        this.$message.error(error.message || "同步资料失败");
      } finally {
        this.contactDetailLoading = false;
      }
    },
    markPendingState(contactKey, pending) {
      if (Boolean(this.pendingMap[contactKey]) === Boolean(pending)) {
        return;
      }
      this.pendingMap = {
        ...this.pendingMap,
        [contactKey]: Boolean(pending),
      };
    },
    isNearBottom() {
      const viewport = this.$refs.msgViewport;
      if (!viewport) {
        return true;
      }
      const distance =
        viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
      return distance <= AUTO_SCROLL_THRESHOLD_PX;
    },
    scrollToBottom(force = false) {
      const viewport = this.$refs.msgViewport;
      if (!viewport) {
        return;
      }
      if (!force && !this.isNearBottom()) {
        return;
      }
      viewport.scrollTop = viewport.scrollHeight;
    },
    touchContactSummary({ message, time, unreadCount }) {
      if (!this.selectedContact) {
        return;
      }
      const idx = this.contacts.findIndex((item) => item.key === this.selectedContact.key);
      if (idx < 0) {
        return;
      }
      const current = this.contacts[idx];
      const nextMessage = message || current.lastMessage;
      const nextTime = time || current.lastTime;
      const nextUnread =
        unreadCount === undefined ? Number(current.unreadCount || 0) : Number(unreadCount || 0);
      if (
        String(current.lastMessage || "") === String(nextMessage || "") &&
        String(current.lastTime || "") === String(nextTime || "") &&
        Number(current.unreadCount || 0) === nextUnread
      ) {
        return;
      }
      const next = this.contacts.slice();
      next[idx] = {
        ...next[idx],
        lastMessage: nextMessage,
        lastTime: nextTime,
        lastTs: toTimestamp(nextTime),
        unreadCount: nextUnread,
      };
      this.contacts = next;
    },
    async selectContact(contact) {
      if (!contact) {
        return;
      }
      const nextConversationId = inferConversationId(contact);
      if (
        this.selectedContactKey === contact.key &&
        this.conversationId === nextConversationId &&
        this.messages.length
      ) {
        return;
      }
      this.selectedContactKey = contact.key;
      this.conversationId = nextConversationId;
      this.messages = [];
      await this.syncMessages({ silent: false });
      this.restartRealtimePolling();
      this.$nextTick(() => this.scrollToBottom(true));
    },
    async nextPendingConversation() {
      const list = this.contacts
        .filter((item) => this.isContactPending(item))
        .sort((a, b) => Number(b.lastTs || 0) - Number(a.lastTs || 0));
      if (!list.length) {
        this.$message.info("当前没有待回复会话");
        return;
      }
      const currentIndex = list.findIndex((item) => item.key === this.selectedContactKey);
      const next = list[(currentIndex + 1) % list.length];
      this.selectContact(next);
    },
    async markCurrentAsRead() {
      if (!this.selectedContact || !this.conversationId) {
        return;
      }
      try {
        const payload = await this.request("/msg/report_unread", {
          guid: this.session.guid,
          conversation_id: this.conversationId,
          unread_count: 0,
        });
        this.lastResponse = payload;
        if (hasBusinessError(payload)) {
          this.$message.warning(getErrorMessage(payload) || "标记已读失败");
          return;
        }
      } catch (error) {
        // swallow API error but still update local status for better UX
      }
      this.touchContactSummary({
        unreadCount: 0,
      });
      this.markPendingState(this.selectedContact.key, false);
      this.$message.success("已标记已读");
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
        const nextContacts = normalizeContacts(payload.data).map((item) => ({
          ...item,
          lastTs: toTimestamp(item.lastTime),
        }));
        // Keep pending state for contacts still existing in list.
        const nextPending = {};
        nextContacts.forEach((item) => {
          if (this.pendingMap[item.key]) {
            nextPending[item.key] = this.pendingMap[item.key];
          }
        });
        this.pendingMap = nextPending;
        this.contacts = nextContacts;
        if (!this.contacts.length) {
          this.selectedContactKey = "";
          this.conversationId = "";
          this.messages = [];
          this.stopRealtimePolling();
          return;
        }
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
      await this.syncMessages({ silent: false });
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
        const nowTs = Date.now();
        const time = formatTime(nowTs);
        const peerTargetSet = buildContactPeerTargetSet(this.selectedContact);
        const selfTargetSet = buildSelfTargetSet(this.session);
        const participantCandidates = mergeUniqueArray(
          Array.from(selfTargetSet),
          Array.from(peerTargetSet),
        );
        const outgoingMessage = {
          sender: this.profileName,
          content,
          ts: nowTs,
          time,
          conversationId: normalizeConversationId(this.conversationId),
          conversationCandidates: buildConversationTargets(this.conversationId),
          participantCandidates,
          senderCandidates: Array.from(selfTargetSet),
          receiverCandidates: Array.from(peerTargetSet),
          isOutgoing: true,
        };
        this.messages = keepRecentMessages(this.messages.concat(outgoingMessage), MAX_MESSAGE_CACHE);
        this.touchContactSummary({
          message: content,
          time,
          unreadCount: 0,
        });
        if (this.selectedContact) {
          this.markPendingState(this.selectedContact.key, false);
        }
        this.messageText = "";
        this.$nextTick(() => this.scrollToBottom(true));
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
  width: 308px;
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

.sidebar-tabs ::v-deep .el-radio-button__inner {
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #606266;
  padding: 6px 8px;
  box-shadow: none;
}

.sidebar-tabs ::v-deep .el-radio-button__orig-radio:checked + .el-radio-button__inner {
  background: #e6f1ff;
  color: #2f77ff;
  box-shadow: none;
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

.badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge {
  margin-left: 2px;
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
  display: flex;
  align-items: center;
  gap: 8px;
}

.target-name {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.target-id {
  color: #909399;
  font-size: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.realtime-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 4px;
  border-right: 1px solid #ebeef5;
}

.sync-time {
  font-size: 12px;
  color: #909399;
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

.stream-tip {
  align-self: center;
  font-size: 12px;
  color: #909399;
  background: #eef3ff;
  border: 1px solid #d8e3ff;
  border-radius: 999px;
  padding: 4px 10px;
}

.time-divider {
  display: flex;
  justify-content: center;
}

.time-divider span {
  padding: 2px 8px;
  border-radius: 999px;
  background: #edf2fa;
  color: #909399;
  font-size: 12px;
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

.detail-empty {
  padding-top: 42px;
}

.detail-profile {
  display: flex;
  align-items: center;
  gap: 10px;
}

.detail-main {
  min-width: 0;
}

.nickname {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.subid {
  color: #909399;
  font-size: 12px;
  margin-top: 3px;
  word-break: break-all;
}

.detail-actions {
  margin-top: 10px;
}

.detail-block {
  margin-top: 14px;
}

.block-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
  color: #606266;
}

.tag-list {
  min-height: 24px;
}

.mini-gap {
  margin-right: 6px;
  margin-bottom: 4px;
}

.detail-json {
  margin: 0;
  padding: 8px;
  border-radius: 4px;
  background: #f5f7fa;
  color: #606266;
  font-size: 11px;
  max-height: 250px;
  overflow: auto;
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
