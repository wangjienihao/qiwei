import Vue from "vue";
import VueRouter from "vue-router";
import store from "../store";

import AdminLayout from "../layouts/AdminLayout.vue";
import LoginView from "../views/LoginView.vue";
import DashboardView from "../views/DashboardView.vue";
import ContactsChatView from "../views/ContactsChatView.vue";

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
        meta: { title: "好友消息" },
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
