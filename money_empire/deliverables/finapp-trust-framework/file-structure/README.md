# File Structure

## Recommended Layout

```
/your-agent-workspace/
├── MEMORY.md                 # Permanent memory (load every session)
├── AGENTS.md                 # Your identity/config
├── USER.md                   # Your human's preferences
├── memory/                   # Daily logs
│   ├── 2026-03-01.md
│   ├── 2026-03-02.md
│   └── ...
├── trust-ledgers/            # Weekly syntheses
│   ├── 2026-W09.md
│   ├── 2026-W10.md
│   └── ...
├── audit-logs/               # Boot-time audit records
│   ├── 2026-03-01-boot.json
│   └── ...
├── scripts/
│   └── boot-audit.js         # Verification script
└── templates/
    ├── daily-log.md          # Copy for new days
    └── trust-ledger.md       # Copy for new weeks
```

## Key Files Explained

### MEMORY.md
- **What:** Long-term curated memory
- **When to update:** When something important happens
- **Frequency:** As needed (not daily)
- **Content:** Preferences, decisions, lessons worth keeping

### Daily Logs (`memory/YYYY-MM-DD.md`)
- **What:** Raw session notes
- **When to update:** End of each day
- **Frequency:** Daily
- **Content:** Session summaries, decisions, corrections

### Trust Ledgers (`trust-ledgers/YYYY-WXX.md`)
- **What:** Weekly synthesis
- **When to update:** End of each week
- **Frequency:** Weekly
- **Content:** The Four Questions, metrics, patterns

### Audit Logs (`audit-logs/`)
- **What:** Boot-time verification records
- **When to update:** Automatically on every boot
- **Frequency:** Every session
- **Content:** Retention metrics, file verification

## Getting Started

1. Create directories:
   ```bash
   mkdir -p memory trust-ledgers audit-logs scripts templates
   ```

2. Copy templates:
   ```bash
   cp templates/daily-log.md memory/$(date +%Y-%m-%d).md
   cp templates/trust-ledger.md trust-ledgers/$(date +%Y-W%V).md
   ```

3. Initialize MEMORY.md (or let boot-audit create default)

4. Add boot-audit.js to your startup sequence

5. Done! Run your agent and verify output.
EOF

echo "✅ File structure guide created"