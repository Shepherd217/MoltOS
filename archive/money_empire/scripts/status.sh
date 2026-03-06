#!/bin/bash
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                 MONEY EMPIRE STATUS                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Process Status:"
if pgrep -f "ts-node src/telegram-start" > /dev/null; then
    echo "  ✅ Money Empire: RUNNING"
    PID=$(pgrep -f "ts-node src/telegram-start" | head -1)
    echo "  📊 PID: $PID"
    echo "  ⏱️  Uptime: $(ps -o etime= -p $PID 2>/dev/null || echo 'N/A')"
else
    echo "  ❌ Money Empire: STOPPED"
fi
echo ""
echo "Recent Activity:"
tail -5 /root/.openclaw/workspace/money_empire/logs/empire.log 2>/dev/null | grep -E "(\[.*\]|💰|🚨)" || echo "  (No recent activity)"
echo ""
echo "Last Restart:"
tail -1 /root/.openclaw/workspace/money_empire/logs/monitor.log 2>/dev/null || echo "  N/A"
