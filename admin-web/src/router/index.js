import Vue from "vue";
import VueRouter from "vue-router";
import store from "../store";

import AdminLayout from "../layouts/AdminLayout.vue";
import LoginView from "../views/LoginView.vue";
import DashboardView from "../views/DashboardView.vue";
import ContactsChatView from "../views/ContactsChatView.vue";
import SessionWorkbenchView from "../views/SessionWorkbenchView.vue";
import GroupOpsView from "../views/GroupOpsView.vue";
import TagOpsView from "../views/TagOpsView.vue";
import MomentsOpsView from "../views/MomentsOpsView.vue";
import AutomationCenterView from "../views/AutomationCenterView.vue";

Vue.use(VueRouter);

const routes = [
  {
    path: "/login",
    name: "Login",
    component: LoginView,
    meta: { public: true, title: "登录" },
  },
  {
    path: "/",
    redirect: "/chat",
  },
  {
    path: "/",
    component: AdminLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: "dashboard",
        name: "Dashboard",
        component: DashboardView,
        meta: { title: "仪表盘" },
      },
      {
        path: "chat",
        name: "ContactsChat",
        component: ContactsChatView,
        meta: { title: "好友消息（V1）" },
      },
      {
        path: "v2/workbench",
        name: "SessionWorkbench",
        component: SessionWorkbenchView,
        meta: { title: "会话中心（V2）" },
      },
      {
        path: "v2/groups",
        name: "GroupOps",
        component: GroupOpsView,
        meta: { title: "群运营（V2）" },
      },
      {
        path: "v3/tags",
        name: "TagOps",
        component: TagOpsView,
        meta: { title: "标签运营（V3）" },
      },
      {
        path: "v3/moments",
        name: "MomentsOps",
        component: MomentsOpsView,
        meta: { title: "朋友圈运营（V3）" },
      },
      {
        path: "v3/automation",
        name: "AutomationCenter",
        component: AutomationCenterView,
        meta: { title: "自动化中心（V3）" },
      },
    ],
  },
];

const router = new VueRouter({
  mode: "hash",
  routes,
});

router.beforeEach((to, from, next) => {
  const isPublic = Boolean(to.meta && to.meta.public);
  const isAuthed = store.getters.isAuthenticated;

  if (!isPublic && to.matched.some((record) => record.meta.requiresAuth)) {
    if (!isAuthed) {
      next({ path: "/login" });
      return;
    }
  }

  if (to.path === "/login" && isAuthed) {
    next({ path: "/chat" });
    return;
  }

  next();
});

export default router;
