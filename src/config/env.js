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

const discordEnabled = String(process.env.DISCORD_ENABLED ?? "false").trim().toLowerCase() === "true";

if (discordEnabled) {
  if (!process.env.DISCORD_WEBHOOK_URL) {
    throw new Error("Missing required environment variable: DISCORD_WEBHOOK_URL when DISCORD_ENABLED=true");
  }
}

const pollMs = Number(process.env.POLL_MS ?? "60000");

if (Number.isNaN(pollMs) || pollMs <= 0) {
  throw new Error("POLL_MS must be a positive number.");
};

export const env = {
  xBearerToken: process.env.X_BEARER_TOKEN,
  xUserId: process.env.X_USER_ID,
  xUsername: process.env.X_USERNAME,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  pollMs,
  telegramAdminIds: String(process.env.TELEGRAM_ADMIN_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean),
  discordEnabled,
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  discordRole: process.env.DISCORD_ROLE_ID || "",
};