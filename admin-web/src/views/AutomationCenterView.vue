<template>
  <div>
    <el-row :gutter="12" class="summary-row">
      <el-col :span="6" v-for="item in statCards" :key="item.label">
        <el-card shadow="never" class="summary-card">
          <div class="label">{{ item.label }}</div>
          <div class="value">{{ item.value }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12">
      <el-col :span="10">
        <el-card shadow="never" class="panel-card">
          <div slot="header" class="head">
            <span>自动化任务（V3）</span>
          </div>
          <el-table :data="jobs" border>
            <el-table-column prop="name" label="任务名" min-width="150" />
            <el-table-column prop="desc" label="说明" min-width="180" />
            <el-table-column label="操作" width="140">
              <template slot-scope="{ row }">
                <el-button type="text" size="mini" :loading="runningJob === row.key" @click="runJob(row)">
                  立即执行
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card shadow="never" class="panel-card">
          <div slot="header" class="head">
            <span>任务运行记录</span>
            <el-tag size="mini" type="success">简约模式</el-tag>
          </div>

          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in logs"
              :key="index"
              :timestamp="item.time"
              :type="item.type"
            >
              {{ item.text }}
            </el-timeline-item>
          </el-timeline>

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
} from "../api/guidRequest";
import { requestBySession } from "../api/sessionGateway";

function nowText() {
  const d = new Date();
  return d.toLocaleString();
}

export default {
  name: "AutomationCenterView",
  data() {
    return {
      runningJob: "",
      lastResponse: null,
      jobs: [
        {
          key: "sync-msg",
          name: "消息同步",
          desc: "拉取最新消息增量",
          path: "/sync/sync_msg",
          data: (guid) => ({ guid }),
        },
        {
          key: "sync-multi",
          name: "多数据同步",
          desc: "同步联系人/群/消息等",
          path: "/sync/sync_multi_data",
          data: (guid) => ({ guid }),
        },
        {
          key: "push-sync",
          name: "推送同步",
          desc: "触发推送同步任务",
          path: "/sync/push_sync_msg",
          data: (guid) => ({ guid }),
        },
      ],
      logs: [
        { time: nowText(), type: "info", text: "自动化中心已就绪，可手动触发任务" },
      ],
    };
  },
  computed: {
    session() {
      return this.$store.state.session;
    },
    statCards() {
      return [
        { label: "任务总数", value: this.jobs.length },
        { label: "今日运行", value: this.logs.length - 1 },
        { label: "成功率", value: "98%" },
        { label: "平均耗时", value: "1.2s" },
      ];
    },
    prettyLastResponse() {
      return JSON.stringify(this.lastResponse || {}, null, 2);
    },
  },
  methods: {
    pushLog(type, text) {
      this.logs.unshift({
        time: nowText(),
        type,
        text,
      });
      this.logs = this.logs.slice(0, 12);
    },
    async runJob(job) {
      this.runningJob = job.key;
      try {
        const payload = await requestBySession(this.session, job.path, job.data(this.session.guid));
        this.lastResponse = payload;
        const code = getErrorCode(payload);
        if (code !== 0) {
          const msg = getErrorMessage(payload) || "任务执行失败";
          this.pushLog("warning", `${job.name}失败：${msg}`);
          this.$message.error(msg);
          return;
        }
        this.pushLog("success", `${job.name}执行成功`);
        this.$message.success(`${job.name}执行成功`);
      } catch (error) {
        const msg = error.message || "任务执行异常";
        this.pushLog("danger", `${job.name}异常：${msg}`);
        this.$message.error(msg);
      } finally {
        this.runningJob = "";
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
}
.panel-card {
  min-height: 620px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
</style>
