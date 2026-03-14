import { telegram } from "../clients/telegram.js";
import { registerDeleteCommand } from "./deleteMessage.js";
import { registerHelpCommand } from "./help.js";
import { registerPinCommand } from "./pin.js";
import { registerUnpinCommand } from "./unpin.js";
import { registerUnpinAllCommand } from "./unpinAll.js";

export function registerCommands() {
    telegram.on("polling_error", (err) => {
        console.error("Telegram polling error:", err.message);
    });

    registerUnpinAllCommand(telegram);
    registerPinCommand(telegram);
    registerUnpinCommand(telegram);
    registerHelpCommand(telegram);
    registerDeleteCommand(telegram);
};