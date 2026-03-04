<template>
  <el-row :gutter="12">
    <el-col :span="10">
      <el-card shadow="never" class="panel-card">
        <div slot="header" class="head">
          <span>群列表（V2）</span>
          <el-button size="mini" :loading="loadingGroups" @click="loadGroups">刷新</el-button>
        </div>

        <el-table
          :data="groups"
          border
          height="560"
          row-key="key"
          :highlight-current-row="true"
          @current-change="onSelectGroup"
        >
          <el-table-column label="群名" min-width="180">
            <template slot-scope="{ row }">
              <div class="group-cell">
                <el-avatar :size="28" :src="row.avatar">{{ getInitial(row.name) }}</el-avatar>
                <span class="ellipsis">{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="id" label="群ID" min-width="170" />
          <el-table-column prop="memberCount" label="人数" width="70" />
        </el-table>
      </el-card>
    </el-col>

    <el-col :span="14">
      <el-card shadow="never" class="panel-card">
        <div slot="header" class="head">
          <span>群运营动作</span>
          <span class="hint">选中群后可快速发消息或拉详情</span>
        </div>

        <el-form label-width="120px" size="small">
          <el-form-item label="当前群">
            <el-input :value="selectedGroup ? selectedGroup.name : ''" disabled />
          </el-form-item>
          <el-form-item label="会话ID">
            <el-input v-model.trim="conversationId" placeholder="R:10xxxx 或群ID" />
          </el-form-item>
          <el-form-item label="运营消息">
            <el-input
              v-model="messageText"
              type="textarea"
              :rows="4"
              placeholder="输入群发文本消息"
            />
          </el-form-item>
          <el-form-item>
            <el-button size="small" :loading="loadingDetail" @click="loadGroupDetail">
              拉取群详情
            </el-button>
            <el-button type="primary" size="small" :loading="sending" @click="sendGroupMessage">
              发送群消息
            </el-button>
          </el-form-item>
        </el-form>

        <el-divider content-position="left">最近接口返回</el-divider>
        <pre class="json-box">{{ prettyLastResponse }}</pre>
      </el-card>
    </el-col>
  </el-row>
</template>

<script>
import {
  getErrorCode,
  getErrorMessage,
  hasBusinessError,
} from "../api/guidRequest";
import { requestBySession } from "../api/sessionGateway";

function asList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const keys = ["list", "items", "rows", "room_list", "rooms", "group_list"];
  for (const key of keys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }
  return [];
}

function normalizeGroups(rawData) {
  return asList(rawData).map((row, index) => {
    const id =
      row.conversation_id ||
      row.room_id ||
      row.group_id ||
      row.id ||
      row.chat_id ||
      "";
    const name = row.room_name || row.group_name || row.name || row.nickname || "未命名群";
    const memberCount = Number(
      row.member_count || row.members || row.total_member_count || 0,
    );
    const avatar = row.avatar || row.head_img || row.icon || "";

    return {
      key: id || `group_${index}`,
      id: String(id),
      name: String(name),
      avatar: String(avatar),
      memberCount,
      raw: row,
    };
  });
}

function inferGroupConversationId(group) {
  if (!group) {
    return "";
  }
  if (group.id.startsWith("R:")) {
    return group.id;
  }
  if (group.id.startsWith("10")) {
    return `R:${group.id}`;
  }
  return group.id;
}

export default {
  name: "GroupOpsView",
  data() {
    return {
      loadingGroups: false,
      loadingDetail: false,
      sending: false,
      groups: [],
      selectedGroup: null,
      conversationId: "",
      messageText: "",
      lastResponse: null,
    };
  },
  computed: {
    session() {
      return this.$store.state.session;
    },
    prettyLastResponse() {
      return JSON.stringify(this.lastResponse || {}, null, 2);
    },
  },
  created() {
    this.loadGroups();
  },
  methods: {
    getInitial(text) {
      if (!text) {
        return "群";
      }
      return String(text).slice(0, 1);
    },
    async request(path, data) {
      return requestBySession(this.session, path, data);
    },
    onSelectGroup(row) {
      this.selectedGroup = row || null;
      if (this.selectedGroup) {
        this.conversationId = inferGroupConversationId(this.selectedGroup);
      }
    },
    async loadGroups() {
      this.loadingGroups = true;
      try {
        const payload = await this.request("/room/get_room_list", {
          guid: this.session.guid,
        });
        this.lastResponse = payload;
        if (hasBusinessError(payload)) {
          this.$message.error(getErrorMessage(payload) || "获取群列表失败");
          return;
        }
        this.groups = normalizeGroups(payload.data);
        if (!this.groups.length) {
          this.$message.info("已调用成功，但未解析到群列表数据");
        }
      } catch (error) {
        this.$message.error(error.message || "获取群列表失败");
      } finally {
        this.loadingGroups = false;
      }
    },
    async loadGroupDetail() {
      if (!this.selectedGroup) {
        this.$message.warning("请先选择一个群");
        return;
      }
      this.loadingDetail = true;
      try {
        const payload = await this.request("/room/batch_get_room_detail", {
          guid: this.session.guid,
          room_ids: [this.selectedGroup.id],
        });
        this.lastResponse = payload;
        if (hasBusinessError(payload)) {
          this.$message.error(getErrorMessage(payload) || "拉取群详情失败");
          return;
        }
        this.$message.success("群详情拉取成功");
      } catch (error) {
        this.$message.error(error.message || "拉取群详情失败");
      } finally {
        this.loadingDetail = false;
      }
    },
    async sendGroupMessage() {
      if (!this.conversationId) {
        this.$message.warning("请填写会话ID");
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
        this.$message.success("群消息发送成功");
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
.panel-card {
  min-height: 640px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.hint {
  color: #909399;
  font-size: 12px;
}
.group-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.json-box {
  background: #1f2d3d;
  color: #d3dce6;
  padding: 10px;
  border-radius: 4px;
  max-height: 280px;
  overflow: auto;
  font-size: 12px;
}
</style>
