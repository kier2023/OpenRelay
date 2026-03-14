import { telegram } from "../clients/telegram.js";
import { registerUnpinCommand } from "./unpin.js";

export function registerCommands() {
    telegram.on("polling_error", (err) => {
        console.error("Telegram polling error:", err.message);
    });

    registerUnpinCommand(telegram);
}