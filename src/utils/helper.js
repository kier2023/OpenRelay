import { env } from "../config/env.js";

const TELEGRAM_ANONYMOUS_ADMIN_ID = 1087968824;

/**
 * Sends a message to a Telegram chat and automatically deletes it after a delay.
 *
 * Useful for temporary bot responses such as confirmations, warnings,
 * or moderation notices that should not clutter the chat history.
 *
 * @param {import("node-telegram-bot-api")} bot The Telegram bot instance used to send and delete the message.
 * @param {number|string} chatId The unique identifier for the target chat.
 * @param {string} text The message text to send.
 * @param {number} [delay=5000] Time in milliseconds before the message is deleted.
 * @returns {Promise<void>}
 */
export async function sendTemporaryMessage(bot, chatId, text, delay = 5000) {
    const sent = await bot.sendMessage(chatId, text);

    setTimeout(() => {
        bot.deleteMessage(chatId, sent.message_id).catch(() => {});
    }, delay);
};

/**
 * Verifies whether a user is allowed to execute admin commands.
 *
 * This helper checks:
 * 1. Anonymous admin mode (Telegram masks identity)
 * 2. Whether the user ID exists in the configured admin allowlist
 *
 * If the user is not permitted, a temporary message is sent explaining why.
 *
 * @param {import("node-telegram-bot-api").default} bot Telegram bot instance
 * @param {object} msg The incoming Telegram message object
 * @returns {Promise<boolean>} Returns true if the user is authorised
 */
export async function requireAdmin(bot, msg) {
    const chatId = msg.chat.id;
    const fromId = String(msg.from?.id ?? "");

    if (!fromId) {
        await sendTemporaryMessage(bot, chatId, "Unable to identify the sender.");
        return false;
    };

    if (Number(fromId) === TELEGRAM_ANONYMOUS_ADMIN_ID) {
        await sendTemporaryMessage(
            bot,
            chatId,
            "Disable anonymous admin mode before using this command."
        );
        return false;
    };

    const isAllowedUser = env.telegramAdminIds.includes(fromId);

    if (!isAllowedUser) {
        await sendTemporaryMessage(bot, chatId, "You are not allowed to use this command.");
        return false;
    };

    return true;
};