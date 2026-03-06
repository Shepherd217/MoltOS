#!/bin/bash
# Money Empire Keep-Alive Script

while true; do
    # Check if process is running
    if ! pgrep -f "ts-node src/telegram-start" > /dev/null; then
        echo "$(date): Money Empire crashed, restarting..." >> logs/crashes.log
        cd /root/.openclaw/workspace/money_empire
        npx ts-node src/telegram-start.ts > logs/empire.log 2>&1 &
        echo "$(date): Restarted" >> logs/crashes.log
    fi
    # Check every 30 seconds
    sleep 30
done
