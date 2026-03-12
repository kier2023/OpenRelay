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

export const env = {
  xBearerToken: process.env.X_BEARER_TOKEN,
  xUserId: process.env.X_USER_ID,
  xUsername: process.env.X_USERNAME,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  pollMs
};