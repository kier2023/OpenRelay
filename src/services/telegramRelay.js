import { telegram } from "../clients/telegram.js";
import { env } from "../config/env.js";
import { cleanCaption, splitText, TELEGRAM_CAPTION_LIMIT, TELEGRAM_MESSAGE_LIMIT } from "../utils/text.js";

/**
 * Picks the highest bitrate MP4 video variant from an X media object.
 * @param {Array} variants
 * @returns {object|null}
 */
function getBestVideoVariant(variants = []) {
    const mp4s = variants.filter(
        (v) => v.content_type === "video/mp4" && v.url
    );

    if (!mp4s.length) return null;

    mp4s.sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0));
    return mp4s[0];
};

/**
 * Converts raw X timeline data into simplified post objects.
 * @param {object} response
 * @returns {Array}
 */
export function normalizePosts(response) {
    const tweets = response?.data?.data ?? [];
    const mediaIncludes = response?.data?.includes?.media ?? [];

    const mediaByKey = new Map(
        mediaIncludes.map((m) => [m.media_key, m])
    );

    return tweets.map((tweet) => {
        const mediaKeys = tweet.attachments?.media_keys ?? [];

        const media = mediaKeys
        .map((key) => mediaByKey.get(key))
        .filter(Boolean)
        .map((m) => {
            if (m.type === "photo" && m.url) {
                return { type: "photo", url: m.url };
            }

            if (m.type === "video" || m.type === "animated_gif") {
                const best = getBestVideoVariant(m.variants || []);
                if (best?.url) {
                    return { type: "video", url: best.url };
                }

                if (m.preview_image_url) {
                    return { type: "photo", url: m.preview_image_url };
                }
            }

            return null;
        })
        .filter(Boolean);

        return {
            id: tweet.id,
            text: tweet.note_tweet?.text || tweet.text,
            media
        };
    });
};

/**
 * Builds the Telegram caption and any overflow text messages for a post.
 * @param {object} post
 * @returns {{ caption: string, overflow: string[] }}
 */
function buildTelegramParts(post) {
    const clean = cleanCaption(post.text) || "";
    const sourceLine = "📨 Sent on X";
    const body = `${clean}\n\n${sourceLine}`;

    if (body.length <= TELEGRAM_CAPTION_LIMIT) {
        return {
            caption: body,
            overflow: []
        };
    }

    const remaining = body.slice(TELEGRAM_CAPTION_LIMIT).trim();

    return {
        caption: body.slice(0, TELEGRAM_CAPTION_LIMIT).trim(),
        overflow: remaining ? splitText(remaining, TELEGRAM_MESSAGE_LIMIT) : []
    };
};

/**
 * Sends a post to Telegram, preserving media where possible and
 * falling back to plain text if media delivery fails.
 * @param {object} post
 * @returns {Promise<void>}
 */
export async function sendToTelegram(post) {
    const media = Array.isArray(post.media) ? post.media : [];
    const { caption, overflow } = buildTelegramParts(post);

    try {
        if (media.length === 0) {
            const fullText = `${cleanCaption(post.text) || "[no text]"}\n\n📨 Sent on X`;
            const chunks = splitText(fullText, TELEGRAM_MESSAGE_LIMIT);

            for (const chunk of chunks) {
                await telegram.sendMessage(TELEGRAM_CHAT_ID, chunk, {
                    disable_web_page_preview: false
                });
            }
            return;
        }

        if (media.length === 1) {
            const item = media[0];

            if (item.type === "photo") {
                await telegram.sendPhoto(TELEGRAM_CHAT_ID, item.url, {
                    caption
                });
            } else if (item.type === "video") {
                await telegram.sendVideo(TELEGRAM_CHAT_ID, item.url, {
                    caption,
                    supports_streaming: true
                });
            } else {
                await telegram.sendMessage(TELEGRAM_CHAT_ID, caption, {
                    disable_web_page_preview: false
                });
            };

            for (const chunk of overflow) {
                await telegram.sendMessage(TELEGRAM_CHAT_ID, chunk, {
                    disable_web_page_preview: true
                });
            };
            return;
        }

        const mediaGroup = media.map((item, index) => ({
            type: item.type === "video" ? "video" : "photo",
            media: item.url,
            ...(index === 0 ? { caption } : {})
        }));

        await telegram.sendMediaGroup(TELEGRAM_CHAT_ID, mediaGroup);

        for (const chunk of overflow) {
            await telegram.sendMessage(TELEGRAM_CHAT_ID, chunk, {
                disable_web_page_preview: true
            });
        }
    } catch (err) {
        console.error("Telegram send failed:", err.message);

        const fallbackText = `${cleanCaption(post.text) || "[no text]"}\n\n📨 Sent on X`;
        const chunks = splitText(fallbackText, TELEGRAM_MESSAGE_LIMIT);

        for (const chunk of chunks) {
            await telegram.sendMessage(TELEGRAM_CHAT_ID, chunk, {
                disable_web_page_preview: false
            });
        };
    };
};