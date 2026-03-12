import { fetchLatestPosts } from "../clients/twitter.js";
import { normalizePosts, sendToTelegram } from "./telegramRelay.js";

let latestSeenId = null;

/**
 * Polls X for new posts and relays unseen posts to Telegram.
 * On first run, it primes the watcher without sending old posts.
 */
export async function tick() {
    const response = await fetchLatestPosts();
    const posts = normalizePosts(response);

    if (!posts.length) {
        console.log(`[${new Date().toISOString()}] No posts found`);
        return;
    };

    const sortedAscending = [...posts].reverse();

    if (!latestSeenId) {
        latestSeenId = posts[0].id;
        console.log(`[${new Date().toISOString()}] Primed with latest post ${latestSeenId}`);
        return;
    };

    const newPosts = sortedAscending.filter((post) => BigInt(post.id) > BigInt(latestSeenId));

    for (const post of newPosts) {
        console.log("\n--- NEW POST ---");
        console.log(`ID: ${post.id}`);
        console.log(post.text);
        console.log(post.media);
        await sendToTelegram(post);
    };

    if (posts[0]?.id) {
        latestSeenId = posts[0].id;
    };
}