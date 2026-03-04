## 企微协议 SAAS API 项目（基于 Apifox 文档）

文档来源：<https://wework.apifox.cn/>

这个仓库已经搭好一个可直接使用的 **TypeScript SDK**，用于对接文档中的接口。

当前同时支持两种请求模式：

- `direct`：直连 API（例如 `http://127.0.0.1:7600/msg/send_text`）
- `guid_request`：通过网关统一转发（你给的方式）
  - `POST https://chat-api.juhebot.com/open/GuidRequest`
  - body: `app_key + app_secret + path + data`

### 当前能力

- 自动解析并生成接口常量（当前 111 个接口）
- 统一封装 `POST` 请求、超时、业务错误处理
- 按模块生成调用方法（如 `client.api.login.getLoginQrcode(...)`）
- 提供登录 + 发文本消息示例

已覆盖分组：

- `client`
- `login`
- `user`
- `msg`
- `contact`
- `room`
- `cloud`
- `label`
- `sns`
- `sync`
- `cdn`

---

## 快速开始

```bash
npm install
npm run check
```

复制环境变量：

```bash
cp .env.example .env
```

按你现在的网关方式，请先配置 `.env` 里的 `WEWORK_APP_KEY / WEWORK_APP_SECRET / WEWORK_GUID`，然后运行：

```bash
npm run example:profile
```

发送消息示例（登录 + 轮询 + 可选发文本）：

```bash
WEWORK_CONVERSATION_ID=会话ID WEWORK_TEXT="你好" npm run example
```

---

## 用法示例

```ts
import { WeworkClient } from "./src/index.js";

const client = new WeworkClient({
  baseUrl: "https://chat-api.juhebot.com",
  mode: "guid_request",
  guidRequest: {
    appKey: process.env.WEWORK_APP_KEY!,
    appSecret: process.env.WEWORK_APP_SECRET!,
    endpoint: "/open/GuidRequest",
  },
});

const guid = "ea4f83af-b0ef-3b48-be6a-27af71e01628";
const profile = await client.post("/user/get_profile", { guid });
console.log(profile);
```

这段代码会自动转换成你给的请求结构：

```ts
await fetch("https://chat-api.juhebot.com/open/GuidRequest", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    app_key: "...",
    app_secret: "...",
    path: "/user/get_profile",
    data: {
      guid: "ea4f83af-b0ef-3b48-be6a-27af71e01628",
    },
  }),
});
```

---

## 同步最新接口

如果文档有更新，执行：

```bash
npm run sync:endpoints
```

该命令会从 Apifox 页面重新提取 endpoint 并更新：

- `src/endpoints.ts`

---

## 文档里的注意事项（已整理）

- 调用频率：一分钟超过 100 次会被限制，约半小时后解封（消息回调不占用频率）。
- 新登录账号前 3 天，不建议群发、发朋友圈、主加好友，避免风控。
- ID 规则（文档说明）：
  - 微信外部联系人通常以 `788` 开头
  - 企微用户通常以 `168` 开头
  - 外部群通常以 `10` 开头

---

## 常用命令

- `npm run sync:endpoints`：同步接口列表
- `npm run check`：TypeScript 类型检查
- `npm run build`：编译到 `dist`
- `npm run example:profile`：按网关方式请求 `/user/get_profile`
- `npm run example`：登录 + 轮询 + 可选发送文本
