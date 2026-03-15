# Open Relay

![Node](https://img.shields.io/badge/node-%3E=18-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-active-success)

A small Node.js relay service that polls an X account and forwards posts to Telegram and optional Discord.
```

        ┌──────────────┐
        │      X       │
        │   (@account) │
        └──────┬───────┘
               │
         X API │ Polling
               │
        ┌──────▼───────┐
        │  Open Relay  │
        │   Node.js    │
        └──────┬───────┘
               │
        ┌──────┴───────────────┐
        │                      │
 Telegram Bot API        Discord Webhook
        │                      │
 ┌──────▼───────┐       ┌──────▼───────┐
 │   Telegram   │       │   Discord    │
 │  Channel /   │       │   Server /   │
 │  Group / DM  │       │   Channel    │
 └──────────────┘       └──────────────┘
```

## Features

- Polls an X user timeline for new posts
- Forwards text, photos, and videos to Telegram
- Optional Discord webhook forwarding with embed + attachment support
- Reposts and quote posts styled for Discord
- Rate-limited splitting for long text
- Optional Telegram admin commands (`/pin`, `/unpin`, `/delete`, `/unpinall`)

## Requirements

- Node.js 18+
- X developer credentials
- Telegram bot token and chat ID
- Optional: Discord webhook URL and role mention

## Install

```bash
git clone https://github.com/kier2023/OpenRelay.git
cd twitterGram
npm install
```

## Environment

Copy and edit `.env` from `.env.example`:

```bash
cp .env.example .env
```

Then fill these values:

```env
# X
X_BEARER_TOKEN=
X_USER_ID=
X_USERNAME=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_ADMIN_IDS=

# Optional Discord
DISCORD_ENABLED=false
DISCORD_WEBHOOK_URL=
DISCORD_ROLE=
DISCORD_ROLE_ID=

# Polling
POLL_MS=60000
```

### Discord variables

- `DISCORD_ENABLED=true` to enable Discord integration
- `DISCORD_WEBHOOK_URL` must be set when enabled
- `DISCORD_ROLE` or `DISCORD_ROLE_ID` can be used for a role mention

## Run

```bash
npm start
```

The app verifies X and Telegram, then polls at `POLL_MS`.

## Development and tests

Run unit tests:

```bash
npm test
```

## How it works

1. Startup loads `.env` and validates required vars.
2. Main loop polls X via `fetchLatestPosts`.
3. New posts are normalized in `src/services/telegramRelay.js`.
4. Telegram sends messages using `node-telegram-bot-api`.
5. If Discord enabled, it sends embed + attachments in `src/services/discordRelay.js`.

## Discord behavior

- Sends one embed per post with title, body, and quote blocks.
- Optional role mentions are added as message content.
- Media is downloaded and sent as actual webhook attachments.
- Reposts/quotes are styled with blockquotes and source fields.

## Telegram commands

In groups, allowed IDs from `TELEGRAM_ADMIN_IDS` can run:
- `/pin`, `/unpin`, `/delete`, `/unpinall`, `/help`

## Notes

- Do not commit real API keys.
- Keep `.env` private.
- If Discord is enabled, ensure webhook URL is valid and has permission in the channel.
