const requiredEnv = [
  "X_BEARER_TOKEN",
  "X_USER_ID",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "X_USERNAME",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const pollMs = Number(process.env.POLL_MS ?? "60000");

if (Number.isNaN(pollMs) || pollMs <= 0) {
  throw new Error("POLL_MS must be a positive number.");
}

const discordEnabled = String(process.env.DISCORD_ENABLED ?? "false").toLowerCase() === "true";

if (discordEnabled && !process.env.DISCORD_WEBHOOK_TOKEN) {
  throw new Error(
    "DISCORD_WEBHOOK_TOKEN is required when DISCORD_ENABLED is true."
  );
};

export const env = {
  xBearerToken: process.env.X_BEARER_TOKEN,
  xUserId: process.env.X_USER_ID,
  xUsername: process.env.X_USERNAME,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  pollMs,
  discord: {
    enabled: discordEnabled,
    webhookToken: process.env.DISCORD_WEBHOOK_TOKEN ?? null,
    roleId: process.env.DISCORD_ROLE_ID ?? null,
  },
};