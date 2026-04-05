# switchbot-battery-monitor

SwitchBot デバイスのバッテリー残量を監視し、閾値を下回ったら Slack に通知する Cloudflare Worker。

## 概要

- Cloudflare Workers の Cron トリガーで毎日定時に SwitchBot API をポーリング
- 指定したデバイスのバッテリーが閾値以下になったら Slack Incoming Webhook で通知
- `/trigger` エンドポイントで手動実行も可能

## セットアップ

### 1. 依存インストール

```bash
npm install
```

### 2. SwitchBot API キーの取得

SwitchBot アプリ → プロフィール → 一番下「開発者向けオプション」からトークンとシークレットを取得。

### 3. 監視対象デバイス ID の確認

SwitchBot アプリのデバイス詳細画面、または API のデバイス一覧から確認できる。

### 4. Slack Incoming Webhook URL の取得

1. [Slack API](https://api.slack.com/apps) → 「Create New App」→「From scratch」
2. 「Incoming Webhooks」を有効化
3. 「Add New Webhook to Workspace」で通知先チャンネルを選択
4. 表示された Webhook URL をコピー

### 5. シークレット登録

```bash
wrangler secret put SWITCHBOT_TOKEN
wrangler secret put SWITCHBOT_SECRET
wrangler secret put SLACK_WEBHOOK_URL
wrangler secret put MONITORED_DEVICE_IDS  # カンマ区切りで複数指定可
wrangler secret put BATTERY_THRESHOLD     # 省略時は 20 (%) がデフォルト
```

`MONITORED_DEVICE_IDS` の例：

```
**:**:**:**:**:**,**:**:**:**:**:**
```

### 6. デプロイ

```bash
npm run deploy
```

### 7. 動作確認

```bash
# 手動トリガー
curl https://<your-worker>.workers.dev/trigger

# ログ確認
wrangler tail
```

## Cron スケジュール

`wrangler.toml` の `crons` で変更可能。デフォルトは毎日 9:00 JST。

```toml
[triggers]
crons = ["0 0 * * *"]  # 0:00 UTC = 9:00 JST
```

## 通知例

```
🔋 SwitchBot バッテリー低下 🔴
デバイス: ロックUltra 5B
残量: 15%
閾値: 20% 以下
早めに充電してください！
```

## 環境変数

| 変数名 | 説明 | デフォルト |
|---|---|---|
| `SWITCHBOT_TOKEN` | SwitchBot API トークン | 必須 |
| `SWITCHBOT_SECRET` | SwitchBot API シークレット | 必須 |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL | 必須 |
| `MONITORED_DEVICE_IDS` | 監視対象のデバイス ID（カンマ区切り） | 必須 |
| `BATTERY_THRESHOLD` | 通知する残量の閾値 (%) | `20` |
