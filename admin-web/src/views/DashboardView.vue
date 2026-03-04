<template>
  <div>
    <el-row :gutter="16">
      <el-col :span="8">
        <el-card class="metric-card">
          <div class="metric-title">今日新增用户</div>
          <div class="metric-value">128</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="metric-card">
          <div class="metric-title">在线实例</div>
          <div class="metric-value">42</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="metric-card">
          <div class="metric-title">消息发送量</div>
          <div class="metric-value">8,962</div>
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
      notices: [
        { time: "2026-03-04 10:00", content: "系统升级完成，性能提升。" },
        { time: "2026-03-04 09:10", content: "新增用户管理页面筛选能力。" },
        { time: "2026-03-03 21:00", content: "消息网关新增告警通知。" },
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
  margin-top: 8px;
}
</style>
