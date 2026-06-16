-- Add Slack, Discord, and Telegram alert channel fields to User
ALTER TABLE "User" ADD COLUMN "slackWebhookUrl"   TEXT;
ALTER TABLE "User" ADD COLUMN "discordWebhookUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramBotToken"  TEXT;
ALTER TABLE "User" ADD COLUMN "telegramChatId"    TEXT;
