
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