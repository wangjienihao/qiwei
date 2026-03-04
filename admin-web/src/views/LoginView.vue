<template>
  <div class="login-page">
    <el-card class="login-card" shadow="hover">
      <div slot="header" class="card-header">
        <span>企微网关登录</span>
      </div>

      <el-form :model="form" label-width="120px" size="small">
        <el-form-item label="网关地址">
          <el-input v-model.trim="form.baseUrl" placeholder="/juhebot-api（本地代理）" />
          <div class="help-text">
            本地开发建议使用 <code>/juhebot-api</code>，避免浏览器跨域导致 Failed to fetch。
          </div>
        </el-form-item>
        <el-form-item label="网关路径">
          <el-input v-model.trim="form.endpoint" placeholder="/open/GuidRequest" />
        </el-form-item>
        <el-form-item label="App Key">
          <el-input v-model.trim="form.appKey" placeholder="请输入 app_key" />
        </el-form-item>
        <el-form-item label="App Secret">
          <el-input
            v-model.trim="form.appSecret"
            placeholder="请输入 app_secret"
            show-password
          />
        </el-form-item>
        <el-form-item label="Guid">
          <el-input v-model.trim="form.guid" placeholder="登录实例 guid" />
          <el-button type="text" @click="generateGuid">随机生成</el-button>
        </el-form-item>
      </el-form>

      <div class="action-row">
        <el-button type="primary" :loading="loadingQrcode" @click="fetchLoginQrcode">
          获取登录二维码
        </el-button>
        <el-button :disabled="!qrcodeImage" @click="startPolling">
          {{ polling ? "轮询中..." : "检查登录状态" }}
        </el-button>
        <el-button :loading="loadingEnter" @click="enterSystem">进入系统</el-button>
      </div>

      <div v-if="qrcodeImage" class="qrcode-box">
        <img :src="qrcodeImage" alt="登录二维码" />
        <div class="qrcode-link">{{ qrcodeContent || "请使用企微扫码登录" }}</div>
      </div>

      <el-alert
        v-if="lastStatusText"
        :title="lastStatusText"
        type="info"
        :closable="false"
        show-icon
        class="status-alert"
      />
    </el-card>
  </div>
</template>

<script>
import { callGuidRequest, getErrorCode, getErrorMessage } from "../api/guidRequest";

function createUuidV4Like() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function pickQrcodeImage(data) {
  if (!data || typeof data !== "object") {
    return "";
  }
  if (typeof data.qrcode === "string" && data.qrcode) {
    if (data.qrcode.startsWith("http")) {
      return data.qrcode;
    }
    return `data:image/jpeg;base64,${data.qrcode}`;
  }
  if (typeof data.qrcode_url === "string") {
    return data.qrcode_url;
  }
  return "";
}

export default {
  name: "LoginView",
  data() {
    const saved = this.$store.state.session;
    return {
      form: {
        // Use local dev proxy by default to avoid browser CORS issues.
        baseUrl: (saved && saved.baseUrl) || "/juhebot-api",
        endpoint: (saved && saved.endpoint) || "/open/GuidRequest",
        appKey: (saved && saved.appKey) || "",
        appSecret: (saved && saved.appSecret) || "",
        guid: (saved && saved.guid) || createUuidV4Like(),
      },
      qrcodeImage: "",
      qrcodeContent: "",
      loadingQrcode: false,
      loadingEnter: false,
      polling: false,
      pollTimer: null,
      lastStatusText: "",
    };
  },
  beforeDestroy() {
    this.stopPolling();
  },
  methods: {
    generateGuid() {
      this.form.guid = createUuidV4Like();
    },
    ensureFormValid() {
      if (!this.form.appKey || !this.form.appSecret || !this.form.guid) {
        this.$message.error("请先填写 appKey / appSecret / guid");
        return false;
      }
      return true;
    },
    async request(path, data) {
      return callGuidRequest({
        baseUrl: this.form.baseUrl,
        endpoint: this.form.endpoint || "/open/GuidRequest",
        appKey: this.form.appKey,
        appSecret: this.form.appSecret,
        path,
        data,
      });
    },
    async fetchLoginQrcode() {
      if (!this.ensureFormValid()) {
        return;
      }
      this.loadingQrcode = true;
      try {
        const payload = await this.request("/login/get_login_qrcode", {
          guid: this.form.guid,
          verify_login: false,
        });
        const errorCode = getErrorCode(payload);
        if (errorCode !== 0) {
          this.$message.error(getErrorMessage(payload) || "获取二维码失败");
          return;
        }

        const data = payload.data || {};
        this.qrcodeImage = pickQrcodeImage(data);
        this.qrcodeContent = data.qrcode_content || "";
        this.lastStatusText = "二维码已获取，请扫码登录。";
        this.$message.success("二维码获取成功");
      } catch (error) {
        this.$message.error(this.toFriendlyError(error));
      } finally {
        this.loadingQrcode = false;
      }
    },
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
      }
      this.pollTimer = null;
      this.polling = false;
    },
    startPolling() {
      if (!this.ensureFormValid()) {
        return;
      }
      if (this.polling) {
        this.stopPolling();
        return;
      }
      this.polling = true;
      this.checkAndTryEnter();
      this.pollTimer = setInterval(this.checkAndTryEnter, 3000);
    },
    async checkAndTryEnter() {
      try {
        const statusPayload = await this.request("/login/check_login_qrcode", {
          guid: this.form.guid,
        });
        this.lastStatusText = `登录状态：${JSON.stringify(statusPayload.data || {})}`;
      } catch (error) {
        this.lastStatusText = `状态检查失败：${this.toFriendlyError(error)}`;
      }

      const success = await this.enterSystem({ silent: true });
      if (success) {
        this.stopPolling();
      }
    },
    async enterSystem(options = {}) {
      const silent = Boolean(options.silent);
      if (!this.ensureFormValid()) {
        return false;
      }
      if (!silent) {
        this.loadingEnter = true;
      }

      try {
        const profilePayload = await this.request("/user/get_profile", {
          guid: this.form.guid,
        });
        const errorCode = getErrorCode(profilePayload);
        if (errorCode !== 0) {
          if (!silent) {
            this.$message.error(getErrorMessage(profilePayload) || "登录未完成");
          }
          return false;
        }

        this.$store.commit("setSession", {
          baseUrl: this.form.baseUrl,
          endpoint: this.form.endpoint || "/open/GuidRequest",
          appKey: this.form.appKey,
          appSecret: this.form.appSecret,
          guid: this.form.guid,
          profile: profilePayload.data || null,
        });
        if (!silent) {
          this.$message.success("登录成功");
        }
        this.$router.replace("/chat");
        return true;
      } catch (error) {
        if (!silent) {
          this.$message.error(this.toFriendlyError(error));
        }
        return false;
      } finally {
        if (!silent) {
          this.loadingEnter = false;
        }
      }
    },
    toFriendlyError(error) {
      const message = (error && error.message) || "";
      if (message.includes("Failed to fetch")) {
        return "请求失败（可能是跨域/CORS）。开发环境请把网关地址填为 /juhebot-api。";
      }
      return message || "请求失败";
    },
  },
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #f5f7fa;
}

.login-card {
  width: 720px;
}

.card-header {
  font-weight: 700;
}

.action-row {
  margin-top: 12px;
}

.qrcode-box {
  margin-top: 16px;
  text-align: center;
}

.qrcode-box img {
  width: 220px;
  height: 220px;
  border: 1px solid #ebeef5;
}

.qrcode-link {
  margin-top: 8px;
  color: #909399;
  word-break: break-all;
}

.status-alert {
  margin-top: 12px;
}

.help-text {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
