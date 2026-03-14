import { env } from "../config/env.js";
import { sendTemporaryMessage } from "../utils/helper.js";

const ANONYMOUS_ADMIN_BOT_ID = 1087968824;

/**
 * Registers the `/unpin` command for the Telegram bot.
 *
 * This command removes all pinned messages from the current chat.
 * It performs several safety checks before executing:
 * - Ensures the sender can be identified.
 * - Prevents usage while the sender is posting as an anonymous admin.
 * - Verifies the sender is listed in the configured Telegram admin IDs.
 * - Confirms the bot itself has administrator privileges in the chat.
 *
 * If the checks pass, the bot will call `unpinAllChatMessages` to remove
 * all pinned messages in the chat and send a temporary confirmation message.
 * Any errors during execution are logged and a user-friendly message is returned.
 *
 * @param {import('node-telegram-bot-api')} bot - The initialized Telegram bot instance.
 * @returns {void}
 */
export function registerUnpinCommand(bot) {
    bot.onText(/^\/unpin(?:@[\w_]+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const fromId = String(msg.from?.id ?? "");

        try {
            if (!fromId) {
                return sendTemporaryMessage(bot, chatId, "Unable to identify the sender.");
            }

            if (Number(fromId) === ANONYMOUS_ADMIN_BOT_ID) {
                return sendTemporaryMessage(
                    bot,
                    chatId,
                    "This command cannot be used while posting anonymously. Please disable anonymous admin mode and try again."
                );
            }

            const isAllowedUser = env.telegramAdminIds.includes(fromId);

            if (!isAllowedUser) {
                return sendTemporaryMessage(bot, chatId, "You are not allowed to use this command.");
            }

            const botMe = await bot.getMe();
            const botMember = await bot.getChatMember(chatId, botMe.id);

            const isBotAdmin = botMember.status === "administrator" || botMember.status === "creator";

            if (!isBotAdmin) {
                return sendTemporaryMessage(
                    bot,
                    chatId,
                    "I am not an admin in this chat, so I can't remove pinned messages."
                );
            }

            await bot.unpinAllChatMessages(chatId);
            await sendTemporaryMessage(bot, chatId, "✔️ All pinned messages have been removed.");

        } catch (err) {
            console.error("Unpin failed:", err.message);

            await sendTemporaryMessage(
                bot,
                chatId,
                "I couldn't remove pinned messages. Check bot permissions."
            );
        };
    });
};