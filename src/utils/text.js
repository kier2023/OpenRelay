export const TELEGRAM_CAPTION_LIMIT = 1024;
export const TELEGRAM_MESSAGE_LIMIT = 4096;
export const DISCORD_MESSAGE_LIMIT = 2048;

/**
 * Removes X shortlinks and collapses excessive empty lines.
 * @param {string} text
 * @returns {string}
 */
export function cleanCaption(text = "") {
    return text.replace(/https:\/\/t\.co\/\S+/g, "").replace(/\n{3,}/g, "\n\n").trim();
};

/**
 * Escapes text for Telegram HTML parse mode.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text = "") {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

/**
 * Splits text into chunks that fit within Telegram message limits.
 * Prefers splitting on line breaks, then spaces.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string[]}
 */
export function splitText(text, maxLength) {
    if (!text || !text.trim()) return [];
    if (text.length <= maxLength) return [text];

    const parts = [];
    let remaining = text.trim();

    while (remaining.length > maxLength) {
        const slice = remaining.slice(0, maxLength);

        let splitAt = slice.lastIndexOf("\n");
        if (splitAt < maxLength * 0.6) {
            splitAt = slice.lastIndexOf(" ");
        };

        if (splitAt < maxLength * 0.6) {
            splitAt = maxLength;
        };

        parts.push(remaining.slice(0, splitAt).trim());
        remaining = remaining.slice(splitAt).trim();
    }

    if (remaining) parts.push(remaining);
    return parts;
};