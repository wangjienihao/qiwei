import Vue from "vue";
import Vuex from "vuex";

Vue.use(Vuex);

const SESSION_KEY = "qiwei_admin_session_v1";

function loadSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function saveSession(session) {
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export default new Vuex.Store({
  state: {
    session: loadSession(),
    isSidebarCollapsed: false,
  },
  getters: {
    isAuthenticated(state) {
      return Boolean(
        state.session &&
          state.session.guid &&
          state.session.appKey &&
          state.session.appSecret,
      );
    },
    profile(state) {
      return state.session ? state.session.profile : null;
    },
  },
  mutations: {
    toggleSidebar(state) {
      state.isSidebarCollapsed = !state.isSidebarCollapsed;
    },
    setSession(state, payload) {
      state.session = payload;
      saveSession(payload);
    },
    setProfile(state, profile) {
      if (!state.session) {
        return;
      }
      state.session = {
        ...state.session,
        profile,
      };
      saveSession(state.session);
    },
    clearSession(state) {
      state.session = null;
      saveSession(null);
    },
  },
});
