<template>
  <div>
    <el-row :gutter="12" class="summary-row">
      <el-col :span="6">
        <el-card shadow="never" class="summary-card">
          <div class="label">联系人</div>
          <div class="value">{{ contacts.length }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="summary-card">
          <div class="label">最近会话</div>
          <div class="value">{{ recentContacts.length }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="summary-card">
          <div class="label">会话消息</div>
          <div class="value">{{ messages.length }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="summary-card">
          <div class="label">未读总数</div>
          <div class="value">{{ unreadTotal }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12">
      <el-col :span="9">
        <el-card shadow="never" class="panel-card">
          <div slot="header" class="head">
            <span>联系人与最近会话</span>
            <el-button size="mini" :loading="loadingContacts" @click="loadContacts">
              刷新
            </el-button>
          </div>

          <el-input
            v-model.trim="keyword"
            size="small"
            clearable
            placeholder="搜索昵称/ID"
            class="search"
          />

          <el-tabs v-model="leftTab" stretch>
            <el-tab-pane label="最近会话" name="recent">
              <div v-if="!recentContacts.length" class="empty">
                <el-empty :image-size="72" description="暂无最近会话" />
              </div>
              <div v-else class="recent-list">
                <div
                  v-for="contact in recentContacts"
                  :key="contact.key"
                  class="recent-item"
                  :class="{ active: selectedContact && selectedContact.key === contact.key }"
                  @click="selectContact(contact)"
                >
                  <el-avatar :src="contact.avatar" :size="34">
                    {{ getInitial(contact.nickname) }}
                  </el-avatar>
                  <div class="recent-main">
                    <div class="recent-top">
                      <span class="name ellipsis">{{ contact.nickname }}</span>
                      <span class="time">{{ contact.lastTime || "-" }}</span>
                    </div>
                    <div class="recent-bottom">
                      <span class="msg ellipsis">
                        {{ contact.lastMessage || "暂无最近消息" }}
                      </span>
                      <el-badge
                        v-if="contact.unreadCount > 0"
                        :value="contact.unreadCount"
                        :max="99"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="全部联系人" name="contacts">
              <el-table
                :data="filteredContacts"
                height="442"
                border
                row-key="key"
                :highlight-current-row="true"
                @current-change="selectContact"
              >
                <el-table-column label="昵称" min-width="150">
                  <template slot-scope="{ row }">
                    <div class="contact-cell">
                      <el-avatar :src="row.avatar" :size="28">
                        {{ getInitial(row.nickname) }}
                      </el-avatar>
                      <div class="contact-meta">
                        <span class="ellipsis">{{ row.nickname }}</span>
                        <small class="sub ellipsis">{{ row.id }}</small>
                      </div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="lastTime" label="最近时间" width="118" />
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>

      <el-col :span="15">
        <el-card shadow="never" class="panel-card">
          <div slot="header" class="head">
            <span>会话中心（V2.1）</span>
            <div class="head-actions">
              <el-button size="mini" :loading="loadingMessages" @click="loadMessages">
                拉取消息
              </el-button>
              <el-button size="mini" type="primary" :loading="sending" @click="sendText">
                发送
              </el-button>
            </div>
          </div>

          <el-form :inline="true" size="small" class="inline-form">
            <el-form-item label="当前联系人">
              <el-input
                :value="selectedContact ? selectedContact.nickname : '未选择'"
                style="width: 180px"
                disabled
              />
            </el-form-item>
            <el-form-item label="会话 ID">
              <el-input
                v-model.trim="conversationId"
                style="width: 240px"
                placeholder="S:788xxxx / R:10xxxx"
              />
            </el-form-item>
            <el-form-item label="快捷语">
              <el-select
                v-model="quickTemplate"
                clearable
                style="width: 190px"
                placeholder="选择常用话术"
                @change="applyQuickTemplate"
              >
                <el-option
                  v-for="item in quickTemplates"
                  :key="item"
                  :value="item"
                  :label="item"
                />
              </el-select>
            </el-form-item>
          </el-form>

          <el-input
            v-model="messageText"
            type="textarea"
            :rows="3"
            placeholder="输入要发送的文本消息"
            class="compose"
          />

          <el-empty v-if="!messages.length" description="暂无消息，点击“拉取消息”尝试同步" />
          <div v-else class="msg-list">
            <div v-for="(item, index) in messages" :key="index" class="msg-item">
              <div class="msg-top">
                <span class="sender">{{ item.sender || "未知发送者" }}</span>
                <span class="time">{{ item.time || "-" }}</span>
              </div>
              <div class="content">{{ item.content || "-" }}</div>
            </div>
          </div>

          <el-divider content-position="left">最近接口返回</el-divider>
          <pre class="json-box">{{ prettyLastResponse }}</pre>
        </el-card>
      </el-col>
    </el-row>
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

function normalizeMessages(rawData) {
  return asList(rawData).map((item) => ({
    sender:
      item.sender_name ||
      item.nickname ||
      item.from_name ||
      item.from ||
      item.username ||
      "",
    content: item.content || item.text || item.msg || item.message || "",
    time:
      item.create_time ||
      item.send_time ||
      item.time ||
      item.timestamp ||
      "",
  }));
}

function toTimeScore(text) {
  if (!text) {
    return 0;
  }
  const normalized = String(text).replace(/-/g, "/");
  const ts = Date.parse(normalized);
  return Number.isNaN(ts) ? 0 : ts;
}

export default {
  name: "SessionWorkbenchView",
  data() {
    return {
      loadingContacts: false,
      loadingMessages: false,
      sending: false,
      leftTab: "recent",
      keyword: "",
      contacts: [],
      selectedContactKey: "",
      conversationId: "",
      messageText: "",
      quickTemplate: "",
      quickTemplates: [
        "你好，已收到你的消息。",
        "这边帮你确认一下，请稍等。",
        "感谢反馈，我们会尽快处理。",
      ],
      messages: [],
      lastResponse: null,
    };
  },
  computed: {
    session() {
      return this.$store.state.session;
    },
    filteredContacts() {
      if (!this.keyword) {
        return this.contacts;
      }
      const key = this.keyword.toLowerCase();
      return this.contacts.filter((item) => {
        return (
          String(item.nickname || "")
            .toLowerCase()
            .includes(key) ||
          String(item.id || "")
            .toLowerCase()
            .includes(key)
        );
      });
    },
    recentContacts() {
      const list = this.filteredContacts.slice();
      return list
        .sort((a, b) => {
          const unreadScore = (b.unreadCount || 0) - (a.unreadCount || 0);
          if (unreadScore !== 0) {
            return unreadScore;
          }
          return toTimeScore(b.lastTime) - toTimeScore(a.lastTime);
        })
        .slice(0, 18);
    },
    selectedContact() {
      return this.contacts.find((item) => item.key === this.selectedContactKey) || null;
    },
    unreadTotal() {
      return this.contacts.reduce((sum, item) => sum + (item.unreadCount || 0), 0);
    },
    prettyLastResponse() {
      return JSON.stringify(this.lastResponse || {}, null, 2);
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
    applyQuickTemplate(value) {
      if (!value) {
        return;
      }
      this.messageText = value;
    },
    selectContact(row) {
      if (!row) {
        return;
      }
      this.selectedContactKey = row.key;
      this.conversationId = inferConversationId(row);
    },
    upsertContactSummary({ message, time }) {
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
        }
      } catch (error) {
        this.$message.error(error.message || "同步联系人失败");
      } finally {
        this.loadingContacts = false;
      }
    },
    async loadMessages() {
      if (!this.conversationId) {
        this.$message.warning("请先选择联系人或填写会话 ID");
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
        this.messages = normalizeMessages(payload.data);
        if (!this.messages.length) {
          this.$message.info("已请求成功，但暂无可展示的消息");
          return;
        }
        const latest = this.messages[0];
        this.upsertContactSummary({
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
        this.$message.warning("请先填写会话 ID");
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
        this.$message.success("发送成功");
        this.messages.unshift({
          sender: "我",
          content,
          time: new Date().toLocaleString(),
        });
        this.upsertContactSummary({
          message: content,
          time: new Date().toLocaleString(),
        });
        this.messageText = "";
        this.quickTemplate = "";
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
.summary-row {
  margin-bottom: 12px;
}
.summary-card .label {
  color: #909399;
  font-size: 12px;
}
.summary-card .value {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}
.panel-card {
  min-height: 650px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.head-actions {
  display: flex;
  gap: 8px;
}
.search {
  margin-bottom: 10px;
}
.empty {
  padding-top: 36px;
}
.recent-list {
  max-height: 442px;
  overflow: auto;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}
.recent-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid #f2f3f5;
  cursor: pointer;
}
.recent-item:last-child {
  border-bottom: none;
}
.recent-item.active {
  background: #ecf5ff;
}
.recent-main {
  min-width: 0;
  flex: 1;
}
.recent-top,
.recent-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.recent-top .name {
  color: #303133;
  font-weight: 500;
}
.recent-top .time {
  font-size: 12px;
  color: #909399;
}
.recent-bottom .msg {
  color: #606266;
  font-size: 12px;
}
.contact-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.contact-meta {
  min-width: 0;
}
.contact-meta .sub {
  display: block;
  color: #909399;
  font-size: 12px;
}
.inline-form {
  margin-bottom: 8px;
}
.compose {
  margin-bottom: 8px;
}
.msg-list {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  max-height: 230px;
  overflow: auto;
}
.msg-item {
  padding: 10px 12px;
  border-bottom: 1px solid #f2f3f5;
}
.msg-item:last-child {
  border-bottom: none;
}
.msg-top {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
}
.sender {
  color: #606266;
}
.content {
  margin-top: 6px;
  color: #303133;
  line-height: 1.5;
}
.json-box {
  background: #1f2d3d;
  color: #d3dce6;
  padding: 10px;
  border-radius: 4px;
  max-height: 150px;
  overflow: auto;
  font-size: 12px;
}
.ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
