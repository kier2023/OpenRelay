import { telegram } from "../clients/telegram.js";
import { env } from "../config/env.js";
import { cleanCaption, splitText, escapeHtml, TELEGRAM_CAPTION_LIMIT, TELEGRAM_MESSAGE_LIMIT } from "../utils/text.js";

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
 * Extracts Telegram-safe media objects from X media includes.
 * @param {string[]} mediaKeys
 * @param {Map<string, object>} mediaByKey
 * @returns {Array<{type: "photo"|"video", url: string}>}
 */
function extractMedia(mediaKeys = [], mediaByKey) {
    return mediaKeys
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
};

/**
 * Converts raw X timeline data into simplified post objects.
 * Supports normal posts, reposts, and quote posts.
 * @param {object} response
 * @returns {Array}
 */
export function normalizePosts(response) {
    const tweets = response?.data?.data ?? [];
    const includes = response?.data?.includes ?? {};

    const mediaIncludes = includes.media ?? [];
    const tweetIncludes = includes.tweets ?? [];
    const userIncludes = includes.users ?? [];

    const mediaByKey = new Map(mediaIncludes.map((m) => [m.media_key, m]));
    const tweetById = new Map(tweetIncludes.map((t) => [t.id, t]));
    const userById = new Map(userIncludes.map((u) => [u.id, u]));

    return tweets.map((tweet) => {
        const mediaKeys = tweet.attachments?.media_keys ?? [];
        const media = extractMedia(mediaKeys, mediaByKey);

        const ref = Array.isArray(tweet.referenced_tweets)
            ? tweet.referenced_tweets[0]
            : null;

        const referencedTweet = ref ? tweetById.get(ref.id) : null;
        const referencedAuthor = referencedTweet?.author_id
            ? userById.get(referencedTweet.author_id)
            : null;

        const referencedMedia = referencedTweet
            ? extractMedia(referencedTweet.attachments?.media_keys ?? [], mediaByKey)
            : [];

        let kind = "post";
        if (ref?.type === "retweeted") kind = "repost";
        if (ref?.type === "quoted") kind = "quote";

        const finalMedia = media.length ? media : referencedMedia;

        return {
            id: tweet.id,
            kind,
            text: tweet.note_tweet?.text || tweet.text || "",
            media: finalMedia,
            referencedPost: referencedTweet
            ? {
                    id: referencedTweet.id,
                    text: referencedTweet.note_tweet?.text || referencedTweet.text || "",
                    authorName: referencedAuthor?.name || "Unknown",
                    authorUsername: referencedAuthor?.username || "unknown",
                    media: referencedMedia
                }
            : null
        };
    });
}

/**
 * Builds a styled blockquote for a quoted/reposted X post.
 * @param {object|null} referencedPost
 * @returns {string}
 */
function buildQuotedBlock(referencedPost) {
    if (!referencedPost) return "";

    const authorLine = `@${escapeHtml(referencedPost.authorUsername)}`;
    const quoteText = escapeHtml(cleanCaption(referencedPost.text) || "[no text]");

    return `<blockquote><b>${authorLine}</b>\n${quoteText}</blockquote>`;
};

/**
 * Builds the Telegram caption and any overflow text messages for a post.
 * @param {object} post
 * @returns {{ caption: string, overflow: string[] }}
 */
function buildTelegramParts(post) {
    const clean = cleanCaption(post.text) || "";
    const safeText = escapeHtml(clean);

    let body = "";

    if (post.kind === "repost" && post.referencedPost) {
        body = [
            `🔁 <b>Reposted from X</b>`,
            buildQuotedBlock(post.referencedPost)
        ].filter(Boolean).join("\n\n");
    } else if (post.kind === "quote" && post.referencedPost) {
        body = [
            safeText,
            buildQuotedBlock(post.referencedPost),
            `📨 <b>Sent on X</b>`
        ].filter(Boolean).join("\n\n");
    } else {
        body = [
            safeText,
            `📨 <b>Sent on X</b>`
        ].filter(Boolean).join("\n\n");
    }

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
            const chunks = splitText(caption, TELEGRAM_MESSAGE_LIMIT);

            for (const chunk of chunks) {
                await telegram.sendMessage(env.telegramChatId, chunk, {
                    parse_mode: "HTML",
                    disable_web_page_preview: false
                });
            }
            return;
        }

        if (media.length === 1) {
            const item = media[0];

            if (item.type === "photo") {
                await telegram.sendPhoto(env.telegramChatId, item.url, {
                    caption,
                    parse_mode: "HTML"
                });
            } else if (item.type === "video") {
                await telegram.sendVideo(env.telegramChatId, item.url, {
                    caption,
                    parse_mode: "HTML",
                    supports_streaming: true
                });
            } else {
                await telegram.sendMessage(env.telegramChatId, caption, {
                    parse_mode: "HTML",
                    disable_web_page_preview: false
                });
            }

            for (const chunk of overflow) {
                await telegram.sendMessage(env.telegramChatId, chunk, {
                    parse_mode: "HTML",
                    disable_web_page_preview: true
                });
            }

            return;
        }

        const mediaGroup = media.map((item, index) => ({
            type: item.type === "video" ? "video" : "photo",
            media: item.url,
            ...(index === 0 ? { caption, parse_mode: "HTML" } : {})
        }));

        await telegram.sendMediaGroup(env.telegramChatId, mediaGroup);

        for (const chunk of overflow) {
            await telegram.sendMessage(env.telegramChatId, chunk, {
                parse_mode: "HTML",
                disable_web_page_preview: true
            });
        }
    } catch (err) {
        console.error("Telegram send failed:", err.message);

        const fallbackText = escapeHtml(cleanCaption(post.text) || "[no text]");
        const chunks = splitText(fallbackText, TELEGRAM_MESSAGE_LIMIT);

        for (const chunk of chunks) {
            await telegram.sendMessage(env.telegramChatId, chunk, {
                parse_mode: "HTML",
                disable_web_page_preview: false
            });
        };
    };
};