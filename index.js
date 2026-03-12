import "dotenv/config";
import { env } from "./src/config/env.js";
import { sleep } from "./src/utils/sleep.js";
import { tick } from "./src/services/poller.js";
import { xClient } from "./src/clients/twitter.js";
import { telegram } from "./src/clients/telegram.js";

/**
 * Verifies that the X API credentials are valid and that the configured
 * user ID can be accessed.
 */
async function verifyXConnection() {
  try {
    const user = await xClient.v2.user(env.xUserId, {
      "user.fields": ["id", "name", "username"]
    });

    const profile = user?.data;

    if (!profile?.id) {
      throw new Error("X API returned no user data.");
    }

    console.log(
      `X connection verified: @${profile.username} (${profile.name}) [${profile.id}]`
    );
  } catch (error) {
    throw new Error(
      `Failed to verify X API connection: ${error?.data?.detail || error.message}`
    );
  }
}

/**
 * Verifies that the Telegram bot token is valid and reachable.
 */
async function verifyTelegramConnection() {
  try {
    const botInfo = await telegram.getMe();

    if (!botInfo?.id) {
      throw new Error("Telegram API returned no bot data.");
    }

    console.log(
      `Telegram connection verified: @${botInfo.username} (${botInfo.first_name})`
    );
  } catch (error) {
    throw new Error(
      `Failed to verify Telegram connection: ${error.response?.body?.description || error.message}`
    );
  }
}

async function main() {
  console.log("Watcher starting...");

  await verifyXConnection();
  await verifyTelegramConnection();

  console.log(`Polling every ${env.pollMs}ms`);

  while (true) {
    try {
      await tick();
    } catch (error) {
      console.error("Check failed:", error?.data ?? error.message);
    }

    await sleep(env.pollMs);
  }
}

main().catch((error) => {
  console.error("Fatal:", error.message || error);
  process.exit(1);
});