import { requireAdmin, sendTemporaryMessage } from "../utils/helper.js";

/**
 * Registers the `/pin` command with the Telegram bot.
 *
 * This command allows authorized users to pin a message in the chat
 * by replying to that message with `/pin`.
 *
 * The command is restricted to users whose Telegram IDs are listed
 * in `env.telegramAdminIds`. It also blocks usage when the sender
 * is using Telegram's anonymous admin mode.
 *
 * @param {import("node-telegram-bot-api").default} bot - The initialized Telegram bot instance.
 * @returns {void}
 */
export function registerPinCommand(bot) {
    bot.onText(/^\/pin(?:@[\w_]+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const reply = msg.reply_to_message;

        try {

            if (!(await requireAdmin(bot, msg))) return;

            if (!reply) {
                return sendTemporaryMessage(bot, chatId, "Reply to a message with /pin to pin it.");
            };

            await bot.pinChatMessage(chatId, reply.message_id, {
                disable_notification: true
            });

            await sendTemporaryMessage(bot, chatId, "📌 Message pinned.");

            setTimeout(() => {
                bot.deleteMessage(chatId, msg.message_id).catch(() => {});
            }, 5000);

        } catch (err) {
            console.error("Pin failed:", err.message);
            sendTemporaryMessage(bot, chatId, "Failed to pin the message.");
        }
    });
}