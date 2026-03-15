import { env } from "../config/env.js";
import { sleep } from "../utils/sleep.js";
import { cleanCaption, splitText, DISCORD_MESSAGE_LIMIT } from "../utils/text.js";

/**
 * Cleans tweet text and removes t.co links for Discord descriptions.
 * @param {string} text
 * @returns {string}
 */
function cleanCaptionForDiscord(text = "") {
    return cleanCaption(text).replace(/https:\/\/t\.co\/\S+/g, "").replace(/\n{3,}/g, "\n\n").trim();
};

/**
 * Escapes Discord special characters in plain text.
 * @param {string} text
 * @returns {string}
 */
function escapeHtmlForDiscord(text = "") {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

/**
 * Builds a quote block string for a referenced post.
 * @param {{ authorUsername?: string, text?: string }} referencedPost
 * @returns {string}
 */
function buildQuotedBlock(referencedPost) {
    if (!referencedPost) return "";

    const authorLine = `\`@${escapeHtmlForDiscord(referencedPost.authorUsername)}\``;
    const quoteText = escapeHtmlForDiscord(cleanCaptionForDiscord(referencedPost.text) || "[no text]");
    return `> ${authorLine}\n> ${quoteText.replace(/\n/g, "\n> ")}`;
};

/**
 * Converts a role string to a Discord mention format.
 * @param {string} role
 * @returns {string}
 */
export function roleMention(role = "") {
    const trimmed = String(role || "").trim();
    if (!trimmed) return "";
    if (/^<@&\d+>$/.test(trimmed)) return trimmed;
    if (/^\d+$/.test(trimmed)) return `<@&${trimmed}>`;
    return trimmed;
};

/**
 * Builds the raw Discord caption and overflow segments from a post.
 * @param {{ kind?: string, text?: string, referencedPost?: object }} post
 * @returns {{ caption: string, overflow: string[] }}
 */
export function buildDiscordParts(post) {
    const clean = cleanCaptionForDiscord(post.text || "");
    const safeText = escapeHtmlForDiscord(clean);

    let body = "";

    if (post.kind === "repost" && post.referencedPost) {
        body = [
        buildQuotedBlock(post.referencedPost)
        ].filter(Boolean).join("\n\n");
    } else if (post.kind === "quote" && post.referencedPost) {
        body = [
        safeText,
        buildQuotedBlock(post.referencedPost),
        `📨 **Sent on X**`
        ].filter(Boolean).join("\n\n");
    } else {
        body = [safeText, `📨 **Sent on X**`].filter(Boolean).join("\n\n");
    };

    if (body.length <= DISCORD_MESSAGE_LIMIT) {
        return { caption: body, overflow: [] };
    };

    const remaining = body.slice(DISCORD_MESSAGE_LIMIT).trim();

    return {
        caption: body.slice(0, DISCORD_MESSAGE_LIMIT).trim(),
        overflow: remaining ? splitText(remaining, DISCORD_MESSAGE_LIMIT) : []
    };
};

/**
 * Sends a simple JSON webhook payload to Discord.
 * @param {string} content
 * @param {object} payload
 */
async function sendDiscordWebhook(content, payload = {}) {
    const response = await fetch(env.discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, ...payload })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Discord webhook failed (${response.status}): ${text}`);
    };
};

/**
 * Sends a Discord webhook with file attachments using multipart/form-data.
 * @param {string} content
 * @param {object} payload
 * @param {{ blob: Blob, filename: string }[]} attachments
 */
async function sendDiscordWebhookWithAttachments(content, payload = {}, attachments = []) {
    const formData = new FormData();
    formData.append("payload_json", JSON.stringify({ content, ...payload }));

    for (let i = 0; i < attachments.length; i++) {
        const file = attachments[i];
        if (!file?.blob) continue;
        formData.append(`files[${i}]`, file.blob, file.filename);
    };

    const response = await fetch(env.discordWebhookUrl, {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Discord webhook failed (${response.status}): ${text}`);
    };
};

/**
 * Builds the Discord embed object from a post payload.
 * @param {object} post
 * @returns {object}
 */
function buildDiscordEmbed(post) {
    const author = env.xUsername ? `\`@${env.xUsername}\`` : "X";
    const title = post.kind === "quote" ? `🔁 Quote post from ${author}` : post.kind === "repost" ? `🔁 Repost from ${author}` : `📝 New post from ${author}`;

    const cleanText = cleanCaptionForDiscord(post.text || "[empty post]");
    const safeText = escapeHtmlForDiscord(cleanText);
    const quoteBlock = post.referencedPost ? buildQuotedBlock(post.referencedPost) : "";

    let description = "";
    if (post.kind === "repost" && post.referencedPost) {
        description = [
            `🔁 **Reposted from X**`,
            quoteBlock,
            `📨 **Sent on X**`
        ].filter(Boolean).join("\n\n");
    } else if (post.kind === "quote" && post.referencedPost) {
        description = [
            safeText,
            quoteBlock,
            `📨 **Sent on X**`
        ].filter(Boolean).join("\n\n");
    } else {
        description = [safeText, `📨 **Sent on X**`].filter(Boolean).join("\n\n");
    };

    const embed = {
        title,
        description: description.slice(0, 2048),
        color: 10181046,
        footer: { text: "Open Relay" },
        timestamp: new Date().toISOString(),
        fields: []
    };

    return embed;
};

/**
 * Downloads media from a URL and returns a Blob file object.
 * Retries JSON fetch failures up to 3 times with backoff.
 * @param {string} url
 * @param {number} index
 * @param {number} attempt
 * @returns {Promise<{ blob: Blob, filename: string } | null>}
 */
async function downloadMediaAsFile(url, index, attempt = 1) {
    try {
        const res = await fetch(url);

        if (!res.ok) {
            if (attempt < 3) {
                await sleep(300 * attempt);
                return downloadMediaAsFile(url, index, attempt + 1);
            };
            return null;
        };

        const arrayBuffer = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") || "application/octet-stream";
        const extension = contentType.split("/")[1] || "dat";
        const filename = `media-${index}.${extension.split(";")[0]}`;
        const blob = new Blob([arrayBuffer], { type: contentType });

        return { blob, filename };
    } catch {
        if (attempt < 3) {
            await sleep(300 * attempt);
            return downloadMediaAsFile(url, index, attempt + 1);
        };
        
        return null;
    };
};

/**
 * Sends a Twitter post to Discord via webhook, including optional media attachments.
 * @param {object} post
 */
export async function sendToDiscord(post) {
    if (!env.discordEnabled) return;
    const mentionText = roleMention(env.discordRole);
    const embed = buildDiscordEmbed(post);

    const media = Array.isArray(post.media) ? post.media : [];
    const attachments = [];

    for (let i = 0; i < Math.min(media.length, 5); i++) {
        const item = media[i];
        if (!item?.url) continue;
        const file = await downloadMediaAsFile(item.url, i);
        if (file) attachments.push(file);
    };

    try {
        const payload = { embeds: [embed] };
        if (attachments.length) {
            await sendDiscordWebhookWithAttachments(mentionText || "", payload, attachments);
        } else {
            await sendDiscordWebhook(mentionText || "", payload);
        };
    } catch (err) {
        console.error("Discord send failed:", err.message || err);
    };
};
