import { TwitterApi } from "twitter-api-v2";
import { env } from "../config/env.js";

export const xClient = new TwitterApi(env.xBearerToken).readOnly;

/**
 * Fetches the latest posts from the configured X account.
 * Replies and reposts are excluded.
 */
export async function fetchLatestPosts() {
    return xClient.v2.userTimeline(env.xUserId, {
            max_results: 5,
            exclude: ["replies", "retweets"],
            expansions: ["attachments.media_keys"],
            "tweet.fields": ["created_at", "author_id", "text", "attachments", "note_tweet"],
            "media.fields": [
            "media_key",
            "type",
            "url",
            "preview_image_url",
            "variants",
            "duration_ms"
        ]
    });
}