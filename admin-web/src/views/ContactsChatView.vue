<template>
  <el-row :gutter="16" class="page-row">
    <el-col :span="9">
      <el-card shadow="never" class="full-card">
        <div slot="header" class="header-row">
          <span>好友列表</span>
          <el-button
            type="primary"
            size="mini"
            :loading="loadingContacts"
            @click="loadContacts"
          >
            刷新
          </el-button>
        </div>

        <el-input
          v-model.trim="keyword"
          size="small"
          placeholder="按姓名/ID搜索"
          clearable
          class="search-input"
        />

        <el-table
          :data="filteredContacts"
          border
          height="520"
          row-key="key"
          :highlight-current-row="true"
          @current-change="onCurrentChange"
        >
          <el-table-column prop="name" label="名称" min-width="120" />
          <el-table-column prop="id" label="ID" min-width="170" />
        </el-table>
      </el-card>
    </el-col>

    <el-col :span="15">
      <el-card shadow="never" class="full-card">
        <div slot="header" class="header-row">
          <span>发送消息</span>
          <span class="muted">
            当前 Guid：{{ session ? session.guid : "-" }}
          </span>
        </div>

        <el-form label-width="120px" size="small">
          <el-form-item label="当前好友">
            <el-input :value="selectedContact ? selectedContact.name : ''" disabled />
          </el-form-item>
          <el-form-item label="会话 ID">
            <el-input
              v-model.trim="conversationIdInput"
              placeholder="例如 S:788xxxx / R:10xxxx"
            />
          </el-form-item>
          <el-form-item label="消息内容">
            <el-input
              v-model="messageText"
              type="textarea"
              :rows="5"
              placeholder="请输入要发送的文本消息"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="sending" @click="sendText">
              发送文本消息
            </el-button>
            <el-button @click="fillBySelected">使用选中好友 ID</el-button>
          </el-form-item>
        </el-form>

        <el-alert
          v-if="sendTip"
          :title="sendTip"
          type="info"
          :closable="false"
          show-icon
          class="tip"
        />

        <el-divider content-position="left">最近接口返回</el-divider>
        <pre class="json-block">{{ prettyLastResponse }}</pre>
      </el-card>
    </el-col>
  </el-row>
</template>

<script>
import {
  callGuidRequest,
  getErrorCode,
  getErrorMessage,
  hasBusinessError,
} from "../api/guidRequest";
import { inferConversationId, normalizeContacts } from "../utils/contact";

export default {
  name: "ContactsChatView",
  data() {
    return {
      loadingContacts: false,
      sending: false,
      contacts: [],
      keyword: "",
      selectedContact: null,
      conversationIdInput: "",
      messageText: "",
      sendTip: "",
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
          String(item.name || "")
            .toLowerCase()
            .includes(key) ||
          String(item.id || "")
            .toLowerCase()
            .includes(key)
        );
      });
    },
    prettyLastResponse() {
      if (!this.lastResponse) {
        return "{}";
      }
      return JSON.stringify(this.lastResponse, null, 2);
    },
  },
  created() {
    this.loadContacts();
  },
  methods: {
    async request(path, data) {
      if (!this.session) {
        throw new Error("请先登录");
      }
      return callGuidRequest({
        baseUrl: this.session.baseUrl,
        endpoint: this.session.endpoint || "/open/GuidRequest",
        appKey: this.session.appKey,
        appSecret: this.session.appSecret,
        path,
        data,
      });
    },
    onCurrentChange(row) {
      this.selectedContact = row || null;
      if (this.selectedContact) {
        this.conversationIdInput = inferConversationId(this.selectedContact);
      }
    },
    fillBySelected() {
      if (!this.selectedContact) {
        this.$message.warning("请先在左侧选择好友");
        return;
      }
      this.conversationIdInput = inferConversationId(this.selectedContact);
    },
    async loadContacts() {
      if (!this.session) {
        this.$message.error("会话不存在，请重新登录");
        return;
      }
      this.loadingContacts = true;
      this.sendTip = "";
      try {
        const payload = await this.request("/contact/sync_contact", {
          guid: this.session.guid,
        });
        this.lastResponse = payload;

        if (hasBusinessError(payload)) {
          this.$message.error(getErrorMessage(payload) || "获取好友列表失败");
          this.contacts = [];
          return;
        }

        const list = normalizeContacts(payload.data);
        this.contacts = list;
        if (!list.length) {
          this.$message.warning("未解析到好友列表，请查看最近接口返回");
        } else {
          this.$message.success(`已加载 ${list.length} 个好友`);
        }
      } catch (error) {
        this.$message.error(error.message || "获取好友列表失败");
      } finally {
        this.loadingContacts = false;
      }
    },
    async sendText() {
      if (!this.session) {
        this.$message.error("会话不存在，请重新登录");
        return;
      }
      if (!this.conversationIdInput) {
        this.$message.warning("请先填写会话 ID");
        return;
      }
      if (!this.messageText.trim()) {
        this.$message.warning("请输入消息内容");
        return;
      }

      this.sending = true;
      this.sendTip = "";
      try {
        const payload = await this.request("/msg/send_text", {
          guid: this.session.guid,
          conversation_id: this.conversationIdInput,
          content: this.messageText.trim(),
        });
        this.lastResponse = payload;

        const code = getErrorCode(payload);
        if (code !== 0) {
          this.sendTip = `发送失败：${getErrorMessage(payload) || "未知错误"}`;
          this.$message.error(this.sendTip);
          return;
        }

        this.sendTip = "发送成功";
        this.$message.success("消息发送成功");
      } catch (error) {
        this.sendTip = `发送失败：${error.message || "未知错误"}`;
        this.$message.error(this.sendTip);
      } finally {
        this.sending = false;
      }
    },
  },
};
</script>

<style scoped>
.page-row {
  min-height: 680px;
}

.full-card {
  min-height: 680px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.search-input {
  margin-bottom: 12px;
}

.muted {
  color: #909399;
  font-size: 12px;
}

.tip {
  margin: 8px 0 12px;
}

.json-block {
  max-height: 220px;
  overflow: auto;
  background: #1f2d3d;
  color: #d3dce6;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
}
</style>
