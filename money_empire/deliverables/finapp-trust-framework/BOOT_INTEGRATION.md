# Boot-Time Integration Guide

## Where to Hook

Add this to your agent's initialization sequence:

```javascript
// In your agent's main entry point (index.js, app.js, etc.)

const { runBootAudit } = require('./scripts/boot-audit');

async function initialize() {
  // Your existing init code...
  
  // Add this line:
  await runBootAudit();
  
  // Continue with normal startup...
}
```

## What Happens at Boot

1. **File Check** — Verifies MEMORY.md, daily logs exist
2. **Hash Verification** — Confirms files weren't corrupted
3. **Context Load** — Loads relevant history into working memory
4. **Audit Log** — Records boot-time retention metrics

## Platform-Specific Notes

### OpenClaw
- Add to `src/core/` or main agent file
- Audit runs before first user interaction

### Custom Setup
- Hook into your agent's `initialize()` or `start()` method
- Ensure it runs AFTER file system access is ready
- Ensure it runs BEFORE first user message processing

## Verification

After integration, you should see on startup:

```
[Trust Audit] Boot-time check complete
[Trust Audit] Retention: 97.6%
[Trust Audit] Files verified: 12
[Trust Audit] Last session: 2026-03-04T14:32:00Z
```
