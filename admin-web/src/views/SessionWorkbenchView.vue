<template>
  <div>
    <el-row :gutter="12" class="summary-row">
      <el-col :span="8">
        <el-card shadow="never" class="summary-card">
          <div class="label">联系人数量</div>
          <div class="value">{{ contacts.length }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="summary-card">
          <div class="label">会话消息</div>
          <div class="value">{{ messages.length }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="summary-card">
          <div class="label">当前会话</div>
          <div class="value ellipsis">{{ conversationId || "-" }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12">
      <el-col :span="8">
        <el-card shadow="never" class="panel-card">
          <div slot="header" class="head">
            <span>会话联系人</span>
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
          <el-table
            :data="filteredContacts"
            height="460"
            border
            row-key="key"
            :highlight-current-row="true"
            @current-change="selectContact"
          >
            <el-table-column label="昵称" min-width="140">
              <template slot-scope="{ row }">
                <div class="contact-cell">
                  <el-avatar :src="row.avatar" :size="28">
                    {{ getInitial(row.nickname) }}
                  </el-avatar>
                  <span class="ellipsis">{{ row.nickname }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="id" label="ID" min-width="150" />
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card shadow="never" class="panel-card">
          <div slot="header" class="head">
            <span>会话中心（V2）</span>
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
            <el-form-item label="会话 ID">
              <el-input
                v-model.trim="conversationId"
                style="width: 260px"
                placeholder="S:788xxxx / R:10xxxx"
              />
            </el-form-item>
            <el-form-item label="消息内容">
              <el-input
                v-model="messageText"
                style="width: 360px"
                placeholder="输入要发送的文本消息"
              />
            </el-form-item>
          </el-form>

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

export default {
  name: "SessionWorkbenchView",
  data() {
    return {
      loadingContacts: false,
      loadingMessages: false,
      sending: false,
      keyword: "",
      contacts: [],
      conversationId: "",
      messageText: "",
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
    selectContact(row) {
      if (!row) {
        return;
      }
      this.conversationId = inferConversationId(row);
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
        }
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
        const payload = await this.request("/msg/send_text", {
          guid: this.session.guid,
          conversation_id: this.conversationId,
          content: this.messageText.trim(),
        });
        this.lastResponse = payload;
        const code = getErrorCode(payload);
        if (code !== 0) {
          this.$message.error(getErrorMessage(payload) || "发送失败");
          return;
        }
        this.$message.success("发送成功");
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
.summary-row {
  margin-bottom: 12px;
}
.summary-card .label {
  color: #909399;
  font-size: 12px;
}
.summary-card .value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}
.panel-card {
  min-height: 620px;
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
.contact-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.inline-form {
  margin-bottom: 6px;
}
.msg-list {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  max-height: 250px;
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
  max-height: 180px;
  overflow: auto;
  font-size: 12px;
}
.ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
