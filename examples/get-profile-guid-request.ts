import { WeworkClient } from "../src/index.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const baseUrl = process.env.WEWORK_BASE_URL ?? "https://chat-api.juhebot.com";
  const guid = requireEnv("WEWORK_GUID");
  const appKey = requireEnv("WEWORK_APP_KEY");
  const appSecret = requireEnv("WEWORK_APP_SECRET");
  const guidRequestPath = process.env.WEWORK_GUID_REQUEST_PATH ?? "/open/GuidRequest";

  const client = new WeworkClient({
    baseUrl,
    mode: "guid_request",
    guidRequest: {
      appKey,
      appSecret,
      endpoint: guidRequestPath,
    },
    timeoutMs: 20_000,
  });

  const profile = await client.post("/user/get_profile", { guid });
  console.log(JSON.stringify(profile, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
