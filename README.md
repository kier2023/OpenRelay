# Open Relay

![Node](https://img.shields.io/badge/node-%3E=18-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-active-success)

Open Relay is a simple Node.js service that watches an X account and forwards newly published posts to a Telegram chat or channel.

It uses the X API to poll for recent posts and the Telegram Bot API to send text, photos, and videos into Telegram. X provides developer access through its Developer Platform, and Telegram bots are created and managed through @BotFather.

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
        Telegram Bot API
               │
        ┌──────▼───────┐
        │   Telegram   │
        │  Channel /   │
        │  Group / DM  │
        └──────────────┘

## Features

- Polls an X account for newly published posts
- Ignores older posts on startup
- Forwards text-only posts to Telegram
- Forwards photos and videos where available
- Splits long captions and messages to stay within Telegram limits
- Uses environment variables for configuration

## Requirements

- Node.js 18 or newer
- An X developer app / API access
- A Telegram bot created with @BotFather
- A Telegram chat ID or channel ID for the destination chat

## Installation

Clone the repository:

```bash
git clone <your-repo-url>
cd open_relay
```

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

If you are on Windows PowerShell, use:

```bash
Copy-Item .env.example .env
```

Then fill in your `.env` values.

## Environment Variables

Create a `.env` file in the project root:

```env
# Do NOT share your credentials with anyone.
# This file contains private API keys.

# X (Twitter) API
X_BEARER_TOKEN=
X_USER_ID=
X_USERNAME=

# Telegram Bot API
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Polling interval in milliseconds
POLL_MS=60000
```

### What each variable means

`X_BEARER_TOKEN`:
Your X API bearer token from your developer app. X’s Developer Platform provides API credentials and developer console access for apps and projects.

`X_USER_ID`:
The numeric user ID of the X account you want to monitor.
To get your User ID, you can use the helper script by runing:

```bash
node getUserId.js
```

`TELEGRAM_BOT_TOKEN`:
Your Telegram bot token created through @BotFather.

`TELEGRAM_CHAT_ID`:
The target Telegram chat ID or channel ID where posts should be sent.

`POLL_MS`:
How often the script checks X for new posts, in milliseconds.
Example: `60000` = 60 seconds.

## Setting up X API access

Create an app and get your API credentials from the official X Developer Platform. X’s platform provides the Developer Console, app management, authentication resources, quickstart material, and API access documentation.

Official documentation: [X Developer Platform](https://developer.x.com/)

## Setting up a Telegram bot

Telegram bots are created through @BotFather, and Telegram’s official docs point developers there for bot setup and token generation.

Official documentation: [Telegram API](https://core.telegram.org/api)

## Getting your Telegram chat ID
Obtain the chat ID using your preferred method or helper script and place it in `TELEGRAM_CHAT_ID`. You can use the @raw_data_bot to get the id of a group, channel or user. 

## Running the project

Start the relay with:

```bash
Start the relay with:
```
A successful startup should verify both APIs before entering the polling loop. If authentication succeeds, the service will begin checking X at the interval defined by `POLL_MS`.

### How it works

- On startup, the app verifies the X connection
- It verifies the Telegram bot connection
- It polls the configured X account for recent posts
- On first run, it stores the newest post ID without forwarding older posts
- On later checks, it forwards only posts newer than the last seen ID

### Development Notes
- Never commit your real `.env` file
- Commit a `.env.example` instead
- Keep your API keys and bot token private