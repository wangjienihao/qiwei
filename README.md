## 企微协议 SAAS API 项目（基于 Apifox 文档）

文档来源：<https://wework.apifox.cn/>

这个仓库已经搭好一个可直接使用的 **TypeScript SDK**，用于对接文档中的接口。

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

示例运行：

```bash
WEWORK_GUID=你的guid npm run example
```

如果要自动发送文本，再补充：

```bash
WEWORK_CONVERSATION_ID=会话ID WEWORK_TEXT="你好" WEWORK_GUID=你的guid npm run example
```

---

## 用法示例

```ts
import { WeworkClient } from "./src/index.js";

const client = new WeworkClient({
  baseUrl: "http://127.0.0.1:7600",
});

// 获取登录二维码
const qr = await client.api.login.getLoginQrcode({
  guid: "string",
  verify_login: false,
});

// 发送文本消息
await client.api.msg.sendText({
  guid: "string",
  conversation_id: "S:788xxxxxx",
  content: "hello",
});
```

也可以直接调用路径：

```ts
await client.post("/msg/send_text", {
  guid: "string",
  conversation_id: "S:788xxxxxx",
  content: "hello",
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
- `npm run example`：运行示例脚本
