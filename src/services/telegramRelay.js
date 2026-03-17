import { telegram } from "../clients/telegram.js";
import { env } from "../config/env.js";
import { sleep } from "../utils/sleep.js";
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
 * Checks if an error is related to a Telegram URL issue.
 * @param {Error} err
 * @returns {boolean}
 */
function isTelegramUrlError(err) {
    if (!err) return false;
    const msg = (err.message || "").toString();
    return msg.includes("Wrong file identifier/HTTP URL specified") || msg.includes("400 Bad Request") || msg.includes("file identifier");
};

/**
 * Downloads media from a URL, returning a buffer and filename for re-uploading to Telegram if direct URL sending fails.
 * Retries on failure up to 3 times with backoff. Returns null if all attempts fail.
 * @param {string} url - the media URL to download
 * @param {number} attempt - the current attempt number for retries (default 1)
 * @returns {Promise<{ buffer: Buffer, filename: string, contentType: string } | null>} 
 */
async function downloadMediaFromUrl(url, attempt = 1) {
    try {
        const res = await fetch(url);
        if (!res.ok) {
            if (attempt < 3) {
                await sleep(200 * attempt);
                return downloadMediaFromUrl(url, attempt + 1);
            };
            return null;
        };

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = res.headers.get("content-type") || "application/octet-stream";
        const extension = (contentType.split("/")[1] || "dat").split(";")[0];
        const filename = `media-${Date.now()}.${extension}`;

        return { buffer, filename, contentType };
    } catch {
        if (attempt < 3) {
            await sleep(200 * attempt);
            return downloadMediaFromUrl(url, attempt + 1);
        };
        return null;
    };
};

/**
 * Sends a photo to Telegram, falling back to downloading and re-uploading if the URL is rejected (e.g. due to unsupported domains).
 * @param {string} chatId - the Telegram chat ID to send the photo to
 * @param {string} url - the URL of the photo to send
 * @param {object} options - additional options for sending the photo (e.g. caption, parse_mode)
 * @returns {Promise<void>}
 */
async function safeSendPhoto(chatId, url, options = {}) {
    try {
        return await telegram.sendPhoto(chatId, url, options);
    } catch (err) {
        if (!isTelegramUrlError(err)) throw err;

        const file = await downloadMediaFromUrl(url);
        if (!file) throw err;

        return telegram.sendPhoto(chatId, file.buffer, {
            ...options,
            filename: file.filename
        });
    };
};

/**
 * Sends a video to Telegram, falling back to downloading and re-uploading if the URL is rejected (e.g. due to unsupported domains).
 * @param {string} chatId - the Telegram chat ID to send the video to
 * @param {string} url - the URL of the video to send
 * @param {object} options - additional options for sending the video (e.g. caption, parse_mode, supports_streaming)
 * @returns {Promise<void>}
 */
async function safeSendVideo(chatId, url, options = {}) {
    try {
        return await telegram.sendVideo(chatId, url, options);
    } catch (err) {
        if (!isTelegramUrlError(err)) throw err;

        const file = await downloadMediaFromUrl(url);
        if (!file) throw err;

        return telegram.sendVideo(chatId, file.buffer, {
            ...options,
            filename: file.filename,
            supports_streaming: options.supports_streaming || true
        });
    };
};

/**
 * Sends a media group to Telegram, falling back to individual sends if the group fails (e.g. due to unsupported URLs).
 * @param {string} chatId - the Telegram chat ID to send the media group to
 * @param {Array<{type: "photo"|"video", url: string}>} mediaItems - the media items to include in the group
 * @param {string} caption - the caption for the media group
 * @returns {Promise<void>}
 */
async function sendMediaGroupWithFallback(chatId, mediaItems, caption) {
    if (!mediaItems.length) return;

    try {
        const mediaGroup = mediaItems.map((item, index) => ({
            type: item.type === "video" ? "video" : "photo",
            media: item.url,
            ...(index === 0 ? { caption, parse_mode: "HTML" } : {}),
            ...(item.type === "video" ? { supports_streaming: true } : {})
        }));
        await telegram.sendMediaGroup(chatId, mediaGroup);
        return;
    } catch (err) {
        if (!isTelegramUrlError(err)) throw err;
    };

    const fallbackMediaGroup = [];

    for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        const downloaded = await downloadMediaFromUrl(item.url);
        if (!downloaded) continue;

        const mediaEntry = {
            type: item.type === "video" ? "video" : "photo",
            media: downloaded.buffer,
            filename: downloaded.filename,
            ...(i === 0 ? { caption, parse_mode: "HTML" } : {}),
            ...(item.type === "video" ? { supports_streaming: true } : {})
        };

        fallbackMediaGroup.push(mediaEntry);
    };

    if (!fallbackMediaGroup.length) {
        throw new Error("Failed to download fallback media for media group.");
    };

    await telegram.sendMediaGroup(chatId, fallbackMediaGroup);
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
                await safeSendPhoto(env.telegramChatId, item.url, {
                    caption,
                    parse_mode: "HTML"
                });
            } else if (item.type === "video") {
                await safeSendVideo(env.telegramChatId, item.url, {
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

        await sendMediaGroupWithFallback(env.telegramChatId, media, caption);

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