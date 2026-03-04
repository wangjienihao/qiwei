<template>
  <div>
    <el-row :gutter="16">
      <el-col :span="8">
        <el-card class="metric-card">
          <div class="metric-title">今日会话数</div>
          <div class="metric-value">2,184</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="metric-card">
          <div class="metric-title">群运营任务</div>
          <div class="metric-value">56</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="metric-card">
          <div class="metric-title">自动化命中率</div>
          <div class="metric-value">94%</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card class="panel" shadow="never">
          <div slot="header">
            <span>快速入口</span>
          </div>
          <div class="quick-grid">
            <el-button
              v-for="item in quickActions"
              :key="item.path"
              plain
              size="small"
              @click="$router.push(item.path)"
            >
              {{ item.label }}
            </el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="panel" shadow="never">
          <div slot="header">
            <span>版本进度</span>
          </div>
          <div class="progress-row">
            <span>V1 基础能力</span>
            <el-progress :percentage="100" :stroke-width="12" status="success" />
          </div>
          <div class="progress-row">
            <span>V2 运营效率</span>
            <el-progress :percentage="76" :stroke-width="12" />
          </div>
          <div class="progress-row">
            <span>V3 增长自动化</span>
            <el-progress :percentage="58" :stroke-width="12" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="panel" shadow="never">
      <div slot="header">
        <span>系统通知</span>
      </div>
      <el-timeline>
        <el-timeline-item
          v-for="(item, index) in notices"
          :key="index"
          :timestamp="item.time"
        >
          {{ item.content }}
        </el-timeline-item>
      </el-timeline>
    </el-card>
  </div>
</template>

<script>
export default {
  name: "DashboardView",
  data() {
    return {
      quickActions: [
        { label: "好友消息（V1）", path: "/chat" },
        { label: "会话中心（V2）", path: "/v2/workbench" },
        { label: "群运营（V2）", path: "/v2/groups" },
        { label: "标签运营（V3）", path: "/v3/tags" },
        { label: "朋友圈（V3）", path: "/v3/moments" },
        { label: "自动化（V3）", path: "/v3/automation" },
      ],
      notices: [
        { time: "2026-03-04 10:00", content: "系统升级完成，性能提升。" },
        { time: "2026-03-04 09:10", content: "V2 会话中心上线内测。" },
        { time: "2026-03-03 21:00", content: "V3 增长模块已开放配置入口。" },
      ],
    };
  },
};
</script>

<style scoped>
.metric-card {
  margin-bottom: 16px;
}

.metric-title {
  color: #909399;
  font-size: 13px;
}

.metric-value {
  margin-top: 8px;
  font-size: 32px;
  font-weight: 700;
  color: #303133;
}

.panel {
  margin-top: 12px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.progress-row {
  margin-bottom: 14px;
}

.progress-row:last-child {
  margin-bottom: 0;
}
</style>
