const DEFAULT_BASE_URL = "https://chat-api.juhebot.com";
const DEFAULT_ENDPOINT = "/open/GuidRequest";

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) {
    return DEFAULT_BASE_URL;
  }
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export async function callGuidRequest({
  baseUrl = DEFAULT_BASE_URL,
  endpoint = DEFAULT_ENDPOINT,
  appKey,
  appSecret,
  path,
  data,
}) {
  if (!appKey || !appSecret) {
    throw new Error("appKey/appSecret 不能为空");
  }

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      app_key: appKey,
      app_secret: appSecret,
      path,
      data,
    }),
  });

  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error("服务端返回的不是 JSON");
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return payload;
}

export function getErrorMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const obj = payload;
  if (typeof obj.error_message === "string" && obj.error_message) {
    return obj.error_message;
  }
  if (typeof obj.msg === "string" && obj.msg) {
    return obj.msg;
  }
  if (typeof obj.message === "string" && obj.message) {
    return obj.message;
  }
  return "";
}

export function getErrorCode(payload) {
  if (!payload || typeof payload !== "object") {
    return 0;
  }
  const obj = payload;
  if (typeof obj.error_code === "number") {
    return obj.error_code;
  }
  if (typeof obj.code === "number") {
    return obj.code;
  }
  return 0;
}

export function hasBusinessError(payload) {
  return getErrorCode(payload) !== 0;
}
