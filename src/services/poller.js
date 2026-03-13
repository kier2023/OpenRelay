import { fetchLatestPosts } from "../clients/twitter.js";
import { normalizePosts, sendToTelegram } from "./telegramRelay.js";

let latestSeenId = null;

/**
 * Polls X for new posts and relays unseen posts to Telegram.
 * On first run, it primes the watcher without sending old posts.
 */
export async function tick() {
    const now = new Date().toISOString();

    const response = await fetchLatestPosts();
    const posts = normalizePosts(response);

    if (!posts.length) {
        console.log(`[${now}] No posts returned from X`);
        return;
    };

    const sortedAscending = [...posts].reverse();

    if (!latestSeenId) {
        latestSeenId = posts[0].id;
        console.log(`[${now}] Watcher primed → latest post ID ${latestSeenId}`);
        return;
    };

    const newPosts = sortedAscending.filter(
        (post) => BigInt(post.id) > BigInt(latestSeenId)
    );

    if (!newPosts.length) {
        console.log(`[${now}] No new posts`);
        return;
    };

    console.log(`\n[${now}] ${newPosts.length} new post(s) detected`);

    for (const post of newPosts) {
        const preview =
            post.text?.replace(/\n/g, " ").slice(0, 120) || "[no text]";

        const mediaCount = Array.isArray(post.media) ? post.media.length : 0;

        let typeLabel = "POST";
        if (post.kind === "repost") typeLabel = "REPOST";
        if (post.kind === "quote") typeLabel = "QUOTE";

        console.log("--------------------------------------------------");
        console.log(`Type: ${typeLabel}`);
        console.log(`ID: ${post.id}`);
        console.log(`Media: ${mediaCount}`);
        console.log(`Preview: ${preview}`);

        if (post.referencedPost) {
            console.log(
                `Source: @${post.referencedPost.authorUsername} → "${post.referencedPost.text?.slice(0, 80) || "[no text]"}"`
            );
        };

        console.log("Relaying to Telegram...");

        await sendToTelegram(post);

        console.log("Sent ✓\n");
    };

    if (posts[0]?.id) {
        latestSeenId = posts[0].id;
    };
};