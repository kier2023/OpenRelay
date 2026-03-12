import { env } from "../config/env.js";
import TelegramBot from "node-telegram-bot-api";

export const telegram = new TelegramBot(env.telegramBotToken, { polling: false });