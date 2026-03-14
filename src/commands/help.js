/**
 * Registers the `/help` command with the Telegram bot.
 *
 * Sends a styled help message listing the available commands.
 *
 * @param {import("node-telegram-bot-api").default} bot - The initialized Telegram bot instance.
 * @returns {void}
 */
export function registerHelpCommand(bot) {
    bot.onText(/^\/help(?:@[\w_]+)?$/, async (msg) => {
        const chatId = msg.chat.id;

        const helpText = `
<b>Available commands</b>

<blockquote><b>⚠️ Admin Commands</b>
These commands can only be used by authorised administrators.</blockquote>
• <code>/pin</code> — pin the replied message  
• <code>/unpin</code> — unpin the replied message  
• <code>/unpinall</code> — remove all pinned messages
• <code>/delete</code> — delete the replied message

<i>Tip:</i> Reply to a message with <code>/pin</code> or <code>/unpin</code>.  
<code>/unpinall</code> works directly.
`.trim();

        await bot.sendMessage(chatId, helpText, {
            parse_mode: "HTML",
            disable_web_page_preview: true
        });
    });
}