<template>
  <el-container class="admin-layout">
    <el-aside :width="isSidebarCollapsed ? '64px' : '220px'" class="layout-aside">
      <div class="brand">{{ isSidebarCollapsed ? "管" : "管理后台" }}</div>
      <el-menu
        :default-active="$route.path"
        class="menu"
        :collapse="isSidebarCollapsed"
        background-color="#001529"
        text-color="#bfcbd9"
        active-text-color="#409eff"
        @select="onSelectMenu"
      >
        <el-menu-item index="/dashboard">
          <i class="el-icon-data-analysis" />
          <span slot="title">仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/chat">
          <i class="el-icon-chat-dot-round" />
          <span slot="title">好友消息</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="layout-header">
        <div class="header-left">
          <el-button
            type="text"
            icon="el-icon-s-fold"
            class="collapse-btn"
            @click="toggleSidebar"
          />
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>后台管理</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <el-dropdown @command="onCommand">
          <span class="el-dropdown-link">
            {{ profileName }}
            <i class="el-icon-arrow-down el-icon--right" />
          </span>
          <el-dropdown-menu slot="dropdown">
            <el-dropdown-item command="profile">个人信息</el-dropdown-item>
            <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </el-dropdown>
      </el-header>

      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script>
export default {
  name: "AdminLayout",
  computed: {
    isSidebarCollapsed() {
      return this.$store.state.isSidebarCollapsed;
    },
    currentTitle() {
      return this.$route.meta.title || "页面";
    },
    profileName() {
      const profile = this.$store.getters.profile;
      if (!profile || typeof profile !== "object") {
        return "管理员";
      }
      return profile.nickname || profile.name || profile.username || "管理员";
    },
  },
  methods: {
    onSelectMenu(path) {
      if (this.$route.path !== path) {
        this.$router.push(path);
      }
    },
    onCommand(command) {
      if (command === "logout") {
        this.$store.commit("clearSession");
        this.$router.replace("/login");
        return;
      }
      if (command === "profile") {
        this.$message.info("个人信息功能可继续扩展");
      }
    },
    toggleSidebar() {
      this.$store.commit("toggleSidebar");
    },
  },
};
</script>

<style scoped>
.admin-layout {
  min-height: 100vh;
}

.layout-aside {
  background: #001529;
  transition: all 0.2s ease-in-out;
}

.brand {
  height: 56px;
  line-height: 56px;
  color: #fff;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.menu {
  border-right: none;
}

.layout-header {
  height: 56px !important;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-btn {
  font-size: 18px;
}

.layout-main {
  background: #f5f7fa;
}

.el-dropdown-link {
  cursor: pointer;
  color: #606266;
}
</style>
