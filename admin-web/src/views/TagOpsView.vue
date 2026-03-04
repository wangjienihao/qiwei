<template>
  <el-row :gutter="12">
    <el-col :span="10">
      <el-card shadow="never" class="panel-card">
        <div slot="header" class="head">
          <span>标签列表（V3.1）</span>
          <el-button size="mini" :loading="loadingTags" @click="loadTags">刷新</el-button>
        </div>

        <el-input
          v-model.trim="newTagName"
          size="small"
          placeholder="输入新标签名，例如：高意向客户"
          class="mb"
        >
          <el-button slot="append" :loading="creating" @click="createTag">创建</el-button>
        </el-input>

        <el-table :data="tags" border height="560" row-key="key">
          <el-table-column prop="name" label="标签名" min-width="150" />
          <el-table-column prop="id" label="标签ID" min-width="120" />
          <el-table-column prop="count" label="人数" width="72" />
        </el-table>
      </el-card>
    </el-col>

    <el-col :span="14">
      <el-card shadow="never" class="panel-card">
        <div slot="header" class="head">
          <span>客户打标签 + 人群包视图</span>
          <span class="hint">交集 / 并集快速圈选人群</span>
        </div>

        <el-form label-width="120px" size="small">
          <el-form-item label="联系人ID">
            <el-input v-model.trim="contactId" placeholder="输入 contact id / user id" />
          </el-form-item>
          <el-form-item label="标签ID">
            <el-select v-model="selectedTagId" filterable placeholder="选择标签ID" style="width: 100%">
              <el-option
                v-for="tag in tags"
                :key="tag.key"
                :label="`${tag.name} (${tag.id})`"
                :value="tag.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="binding" @click="bindTag">
              绑定标签
            </el-button>
            <el-button @click="clearAssignments">清空本地人群映射</el-button>
          </el-form-item>
        </el-form>

        <el-divider content-position="left">人群包视图（V3）</el-divider>
        <el-form label-width="120px" size="small">
          <el-form-item label="目标标签">
            <el-select
              v-model="audienceTagIds"
              multiple
              filterable
              collapse-tags
              placeholder="可多选标签"
              style="width: 100%"
            >
              <el-option
                v-for="tag in tags"
                :key="tag.key"
                :label="`${tag.name} (${tag.id})`"
                :value="tag.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="组合规则">
            <el-radio-group v-model="audienceMode">
              <el-radio-button label="union">并集（命中任一标签）</el-radio-button>
              <el-radio-button label="intersect">交集（命中全部标签）</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="候选联系人">
            <el-input
              v-model.trim="audienceSeedInput"
              type="textarea"
              :rows="2"
              placeholder="可选：输入联系人ID，逗号或换行分隔。为空则使用本地已绑定联系人。"
            />
          </el-form-item>
          <el-form-item label="人群结果">
            <div class="audience-meta">
              <el-tag type="success" size="mini">命中 {{ audienceMatchedIds.length }} 人</el-tag>
              <el-tag type="info" size="mini">样本库 {{ audienceSourceIds.length }} 人</el-tag>
              <el-tag type="warning" size="mini">本地映射 {{ assignedContactCount }} 人</el-tag>
            </div>
            <div class="id-cloud">
              <el-tag
                v-for="id in audienceMatchedIds.slice(0, 16)"
                :key="id"
                size="mini"
                class="tag-gap"
              >
                {{ id }}
              </el-tag>
              <span v-if="audienceMatchedIds.length > 16" class="hint">
                其余 {{ audienceMatchedIds.length - 16 }} 人...
              </span>
            </div>
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

const ASSIGNMENT_STORAGE_KEY = "qiwei_tag_assignments_v1";

function asList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const keys = ["list", "items", "rows", "label_list", "labels", "data"];
  for (const key of keys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }
  return [];
}

function normalizeTags(rawData) {
  return asList(rawData).map((row, index) => ({
    key: String(row.id || row.label_id || row.tag_id || `tag_${index}`),
    id: String(row.id || row.label_id || row.tag_id || ""),
    name: String(row.name || row.label_name || row.tag_name || "未命名标签"),
    count: Number(row.count || row.total || row.member_count || 0),
    raw: row,
  }));
}

function parseIds(text) {
  if (!text) {
    return [];
  }
  return String(text)
    .split(/[\n,，\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export default {
  name: "TagOpsView",
  data() {
    return {
      loadingTags: false,
      creating: false,
      binding: false,
      tags: [],
      newTagName: "",
      contactId: "",
      selectedTagId: "",
      audienceTagIds: [],
      audienceMode: "union",
      audienceSeedInput: "",
      assignmentMap: {},
      lastResponse: null,
    };
  },
  computed: {
    session() {
      return this.$store.state.session;
    },
    assignedContactCount() {
      return Object.keys(this.assignmentMap).length;
    },
    audienceSourceIds() {
      const manual = parseIds(this.audienceSeedInput);
      if (manual.length) {
        return manual;
      }
      return Object.keys(this.assignmentMap);
    },
    audienceMatchedIds() {
      if (!this.audienceTagIds.length || !this.audienceSourceIds.length) {
        return [];
      }
      return this.audienceSourceIds.filter((contactId) => {
        const contactTags = this.assignmentMap[contactId] || [];
        if (this.audienceMode === "intersect") {
          return this.audienceTagIds.every((tagId) => contactTags.includes(tagId));
        }
        return this.audienceTagIds.some((tagId) => contactTags.includes(tagId));
      });
    },
    prettyLastResponse() {
      return JSON.stringify(this.lastResponse || {}, null, 2);
    },
  },
  created() {
    this.loadAssignments();
    this.loadTags();
  },
  methods: {
    loadAssignments() {
      try {
        const raw = window.localStorage.getItem(ASSIGNMENT_STORAGE_KEY);
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
    saveAssignments() {
      window.localStorage.setItem(ASSIGNMENT_STORAGE_KEY, JSON.stringify(this.assignmentMap));
    },
    rememberAssignment(contactId, tagId) {
      const id = String(contactId);
      const current = this.assignmentMap[id] || [];
      if (!current.includes(tagId)) {
        this.assignmentMap = {
          ...this.assignmentMap,
          [id]: current.concat(tagId),
        };
        this.saveAssignments();
      }
    },
    clearAssignments() {
      this.assignmentMap = {};
      this.saveAssignments();
      this.$message.success("本地人群映射已清空");
    },
    async request(path, data) {
      return requestBySession(this.session, path, data);
    },
    async loadTags() {
      this.loadingTags = true;
      try {
        const payload = await this.request("/label/sync_label_list", {
          guid: this.session.guid,
        });
        this.lastResponse = payload;
        if (hasBusinessError(payload)) {
          this.$message.error(getErrorMessage(payload) || "同步标签失败");
          return;
        }
        this.tags = normalizeTags(payload.data);
      } catch (error) {
        this.$message.error(error.message || "同步标签失败");
      } finally {
        this.loadingTags = false;
      }
    },
    async createTag() {
      if (!this.newTagName.trim()) {
        this.$message.warning("请先输入标签名");
        return;
      }
      this.creating = true;
      try {
        const payload = await this.request("/label/create_label", {
          guid: this.session.guid,
          name: this.newTagName.trim(),
          label_name: this.newTagName.trim(),
        });
        this.lastResponse = payload;
        const code = getErrorCode(payload);
        if (code !== 0) {
          this.$message.error(getErrorMessage(payload) || "创建标签失败");
          return;
        }
        this.$message.success("标签创建请求成功");
        this.newTagName = "";
        this.loadTags();
      } catch (error) {
        this.$message.error(error.message || "创建标签失败");
      } finally {
        this.creating = false;
      }
    },
    async bindTag() {
      if (!this.contactId) {
        this.$message.warning("请填写联系人ID");
        return;
      }
      if (!this.selectedTagId) {
        this.$message.warning("请选择标签ID");
        return;
      }
      this.binding = true;
      try {
        const payload = await this.request("/label/contact_add_label", {
          guid: this.session.guid,
          contact_id: this.contactId,
          label_id: this.selectedTagId,
          label_ids: [this.selectedTagId],
        });
        this.lastResponse = payload;
        const code = getErrorCode(payload);
        if (code !== 0) {
          this.$message.error(getErrorMessage(payload) || "绑定标签失败");
          return;
        }
        this.rememberAssignment(this.contactId, this.selectedTagId);
        this.$message.success("标签绑定成功");
      } catch (error) {
        this.$message.error(error.message || "绑定标签失败");
      } finally {
        this.binding = false;
      }
    },
  },
};
</script>

<style scoped>
.panel-card {
  min-height: 680px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.hint {
  color: #909399;
  font-size: 12px;
}
.mb {
  margin-bottom: 10px;
}
.audience-meta {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.id-cloud {
  min-height: 32px;
}
.tag-gap {
  margin-right: 6px;
  margin-bottom: 4px;
}
.json-box {
  background: #1f2d3d;
  color: #d3dce6;
  padding: 10px;
  border-radius: 4px;
  max-height: 170px;
  overflow: auto;
  font-size: 12px;
}
</style>
