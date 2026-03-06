#!/bin/bash
# Money Empire Service - Headless Mode (No Telegram Bot)
# Reports to OpenClaw via logs/notifications

cd /root/.openclaw/workspace/money_empire

# Run without Telegram bot - headless mode
exec npx ts-node src/index.ts
