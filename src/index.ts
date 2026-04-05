import { createHmac } from "node:crypto";

export interface Env {
  SWITCHBOT_TOKEN: string;
  SWITCHBOT_SECRET: string;
  SLACK_WEBHOOK_URL: string;
  BATTERY_THRESHOLD: string; // 例: "20"
  MONITORED_DEVICE_IDS: string; // カンマ区切り 例: "B0:E9:FE:A4:77:89,B0:E9:FE:9D:68:5B"
}

// SwitchBot API 認証ヘッダー生成
function buildAuthHeaders(token: string, secret: string) {
  const t = Date.now().toString();
  const nonce = crypto.randomUUID();
  const sign = createHmac("sha256", secret)
    .update(token + t + nonce)
    .digest("base64");

  return {
    Authorization: token,
    t,
    nonce,
    sign,
    "Content-Type": "application/json",
  };
}

// デバイス一覧取得
async function getDevices(token: string, secret: string) {
  const res = await fetch("https://api.switch-bot.com/v1.1/devices", {
    headers: buildAuthHeaders(token, secret),
  });
  const json = (await res.json()) as any;
  return json.body?.deviceList ?? [];
}

// デバイスのステータス取得
async function getDeviceStatus(
  token: string,
  secret: string,
  deviceId: string,
) {
  const res = await fetch(
    `https://api.switch-bot.com/v1.1/devices/${deviceId}/status`,
    { headers: buildAuthHeaders(token, secret) },
  );
  const json = (await res.json()) as any;
  return json.body ?? null;
}

// Slack に通知
async function notifySlack(webhookUrl: string, message: string) {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
}

async function checkBatteries(env: Env) {
  const threshold = parseInt(env.BATTERY_THRESHOLD ?? "20", 10);
  const monitoredIds = env.MONITORED_DEVICE_IDS.split(",").map((id) =>
    id.trim(),
  );
  const devices = await getDevices(env.SWITCHBOT_TOKEN, env.SWITCHBOT_SECRET);

  const targetDevices = devices.filter((d: any) =>
    monitoredIds.includes(d.deviceId),
  );

  if (targetDevices.length === 0) {
    console.log("対象デバイスが見つかりませんでした");
    return;
  }

  for (const device of targetDevices) {
    const status = await getDeviceStatus(
      env.SWITCHBOT_TOKEN,
      env.SWITCHBOT_SECRET,
      device.deviceId,
    );

    if (!status) continue;

    const battery: number | undefined = status.battery;
    console.log(`${device.deviceName}: battery=${battery ?? "N/A"}`);

    if (battery !== undefined && battery <= threshold) {
      const message =
        `🔋 *SwitchBot バッテリー低下* 🔴\n` +
        `*デバイス:* ${device.deviceName}\n` +
        `*残量:* ${battery}%\n` +
        `*閾値:* ${threshold}% 以下\n` +
        `早めに充電してください！`;

      await notifySlack(env.SLACK_WEBHOOK_URL, message);
      console.log(`通知送信: ${device.deviceName} (${battery}%)`);
    }
  }
}

export default {
  // Cron トリガー（毎日 9:00 JST = 0:00 UTC）
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    await checkBatteries(env);
  },

  // 手動テスト用エンドポイント
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/trigger") {
      await checkBatteries(env);
      return new Response("OK: バッテリーチェック完了", { status: 200 });
    }
    return new Response("SwitchBot Battery Monitor", { status: 200 });
  },
};
