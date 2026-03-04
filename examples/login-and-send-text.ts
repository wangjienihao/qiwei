import { WeworkClient, type WeworkClientOptions } from "../src/index.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const useGuidRequest = process.env.WEWORK_USE_GUID_REQUEST === "true";
  const baseUrl = process.env.WEWORK_BASE_URL
    ? process.env.WEWORK_BASE_URL
    : useGuidRequest
      ? "https://chat-api.juhebot.com"
      : "http://127.0.0.1:7600";
  const guid = requireEnv("WEWORK_GUID");
  const conversationId = process.env.WEWORK_CONVERSATION_ID;
  const message = process.env.WEWORK_TEXT ?? "Hello from wework sdk";

  const clientOptions: WeworkClientOptions = useGuidRequest
    ? {
        baseUrl,
        mode: "guid_request",
        guidRequest: {
          appKey: requireEnv("WEWORK_APP_KEY"),
          appSecret: requireEnv("WEWORK_APP_SECRET"),
          endpoint:
            process.env.WEWORK_GUID_REQUEST_PATH ?? "/open/GuidRequest",
        },
        timeoutMs: 20_000,
      }
    : {
        baseUrl,
        mode: "direct",
        timeoutMs: 20_000,
      };

  const client = new WeworkClient(clientOptions);

  const qr = await client.post("/login/get_login_qrcode", {
    guid,
    verify_login: false,
  });

  const qrData = qr.data as Record<string, unknown> | undefined;
  console.log("get_login_qrcode =>", {
    error_code: qr.error_code,
    error_message: qr.error_message,
    qrcode_content: qrData?.qrcode_content,
    key: qrData?.key,
  });

  console.log("Polling login status for up to 60 seconds...");
  for (let i = 0; i < 20; i += 1) {
    const status = await client.post("/login/check_login_qrcode", { guid });
    console.log(
      `check_login_qrcode attempt ${i + 1}:`,
      JSON.stringify(status.data),
    );
    await sleep(3_000);
  }

  if (conversationId) {
    const sendResult = await client.post("/msg/send_text", {
      guid,
      conversation_id: conversationId,
      content: message,
    });
    console.log("send_text =>", sendResult);
  } else {
    console.log(
      "Skip send_text: set WEWORK_CONVERSATION_ID to send a message automatically.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
