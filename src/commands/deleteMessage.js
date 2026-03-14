import { requireAdmin, sendTemporaryMessage } from "../utils/helper.js";

/**
 * Registers the `/delete` command with the Telegram bot.
 *
 * Allows authorised admins to delete a message by replying
 * to it with `/delete`.
 *
 * The command is restricted to user IDs listed in
 * `env.telegramAdminIds`. Anonymous admin mode is blocked.
 *
 * @param {import("node-telegram-bot-api").default} bot - The initialized Telegram bot instance.
 * @returns {void}
 */
export function registerDeleteCommand(bot) {
    bot.onText(/^\/delete(?:@[\w_]+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const reply = msg.reply_to_message;

        try {

            if (!(await requireAdmin(bot, msg))) return;

            if (!reply) {
                return sendTemporaryMessage(
                    bot,
                    chatId,
                    "Reply to the message you want to delete with /delete."
                );
            };

            await bot.deleteMessage(chatId, reply.message_id);
            await sendTemporaryMessage(bot, chatId, "✔️ Message deleted.");

            setTimeout(() => {
                bot.deleteMessage(chatId, msg.message_id).catch(() => {});
            }, 5000);

        } catch (err) {
            console.error("Delete failed:", err.message);
            sendTemporaryMessage(bot, chatId, "Failed to delete the message.");
        };
    });
};