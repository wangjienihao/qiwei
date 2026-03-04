import { callGuidRequest } from "./guidRequest";

export function ensureSession(session) {
  if (!session || typeof session !== "object") {
    throw new Error("会话不存在，请重新登录");
  }
  if (!session.appKey || !session.appSecret || !session.guid) {
    throw new Error("会话缺少 appKey/appSecret/guid，请重新登录");
  }
}

export async function requestBySession(session, path, data) {
  ensureSession(session);

  return callGuidRequest({
    baseUrl: session.baseUrl,
    endpoint: session.endpoint || "/open/GuidRequest",
    appKey: session.appKey,
    appSecret: session.appSecret,
    path,
    data,
  });
}
