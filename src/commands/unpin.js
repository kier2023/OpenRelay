import { requireAdmin, sendTemporaryMessage } from "../utils/helper.js";

/**
 * Registers the `/unpin` command with the Telegram bot.
 *
 * This command removes the pin from a message when a user replies
 * to the pinned message with `/unpin`.
 *
 * The command is restricted to users whose Telegram IDs are listed
 * in `env.telegramAdminIds`. It also blocks usage when the sender
 * is using Telegram's anonymous admin mode.
 *
 * @param {import("node-telegram-bot-api").default} bot - The initialized Telegram bot instance.
 * @returns {void}
 */
export function registerUnpinCommand(bot) {
    bot.onText(/^\/unpin(?:@[\w_]+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const reply = msg.reply_to_message;

        try {

            if (!(await requireAdmin(bot, msg))) return;

            if (!reply) {
                return sendTemporaryMessage(bot, chatId, "Reply to a pinned message with /unpin.");
            };

            await bot.unpinChatMessage(chatId, { message_id: reply.message_id });

            await sendTemporaryMessage(bot, chatId, "📌 Message unpinned.");

            setTimeout(() => {
                bot.deleteMessage(chatId, msg.message_id).catch(() => {});
            }, 5000);

        } catch (err) {
            console.error("Unpin failed:", err.message);
            sendTemporaryMessage(bot, chatId, "Failed to unpin the message.");
        };
    });
};