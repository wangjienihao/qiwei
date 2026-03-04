<template>
  <el-row :gutter="12">
    <el-col :span="12">
      <el-card shadow="never" class="panel-card">
        <div slot="header" class="head">
          <span>朋友圈运营（V3）</span>
          <el-button size="mini" :loading="loadingRecords" @click="loadRecords">刷新记录</el-button>
        </div>

        <el-form label-width="100px" size="small">
          <el-form-item label="文案内容">
            <el-input
              v-model="snsContent"
              type="textarea"
              :rows="4"
              placeholder="输入朋友圈文案"
            />
          </el-form-item>
          <el-form-item label="图片URL">
            <el-input v-model.trim="snsImage" placeholder="可选，http(s)://..." />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="posting" @click="postSns">发布朋友圈</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </el-col>

    <el-col :span="12">
      <el-card shadow="never" class="panel-card">
        <div slot="header" class="head">
          <span>最近朋友圈记录</span>
          <span class="hint">{{ records.length }} 条</span>
        </div>

        <el-empty v-if="!records.length" description="暂无记录" />
        <div v-else class="record-list">
          <div v-for="(item, index) in records" :key="index" class="record-item">
            <div class="record-time">{{ item.time || "-" }}</div>
            <div class="record-content">{{ item.content || "-" }}</div>
          </div>
        </div>

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
  const keys = ["list", "items", "rows", "records", "sns_list"];
  for (const key of keys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }
  return [];
}

function normalizeRecords(rawData) {
  return asList(rawData).map((item) => ({
    time: item.create_time || item.time || item.publish_time || "",
    content: item.content || item.text || item.desc || "",
  }));
}

export default {
  name: "MomentsOpsView",
  data() {
    return {
      posting: false,
      loadingRecords: false,
      snsContent: "",
      snsImage: "",
      records: [],
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
    this.loadRecords();
  },
  methods: {
    async request(path, data) {
      return requestBySession(this.session, path, data);
    },
    async postSns() {
      if (!this.snsContent.trim()) {
        this.$message.warning("请输入朋友圈文案");
        return;
      }
      this.posting = true;
      try {
        const payload = await this.request("/sns/post_sns", {
          guid: this.session.guid,
          content: this.snsContent.trim(),
          image_url: this.snsImage.trim(),
          image_urls: this.snsImage.trim() ? [this.snsImage.trim()] : [],
        });
        this.lastResponse = payload;
        const code = getErrorCode(payload);
        if (code !== 0) {
          this.$message.error(getErrorMessage(payload) || "发布失败");
          return;
        }
        this.$message.success("发布请求成功");
        this.snsContent = "";
        this.snsImage = "";
        this.loadRecords();
      } catch (error) {
        this.$message.error(error.message || "发布失败");
      } finally {
        this.posting = false;
      }
    },
    async loadRecords() {
      this.loadingRecords = true;
      try {
        const payload = await this.request("/sns/get_sns_record", {
          guid: this.session.guid,
        });
        this.lastResponse = payload;
        if (hasBusinessError(payload)) {
          this.$message.error(getErrorMessage(payload) || "获取记录失败");
          return;
        }
        this.records = normalizeRecords(payload.data);
      } catch (error) {
        this.$message.error(error.message || "获取记录失败");
      } finally {
        this.loadingRecords = false;
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
.record-list {
  max-height: 260px;
  overflow: auto;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}
.record-item {
  padding: 10px;
  border-bottom: 1px solid #f2f3f5;
}
.record-item:last-child {
  border-bottom: none;
}
.record-time {
  color: #909399;
  font-size: 12px;
}
.record-content {
  margin-top: 6px;
  color: #303133;
  line-height: 1.5;
}
.json-box {
  background: #1f2d3d;
  color: #d3dce6;
  padding: 10px;
  border-radius: 4px;
  max-height: 230px;
  overflow: auto;
  font-size: 12px;
}
</style>
