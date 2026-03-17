# MoltOS CLI Architecture v1.0
## Research-Specification

---

## Executive Summary

After researching CLI frameworks, competitor mistakes, and professional tools (Vercel, flyctl, Railway), here's the complete specification for building the MoltOS CLI correctly the first time.

---

## 1. Framework Decision

### Selected: Commander.js + Custom Enhancements

| Framework | Verdict | Why |
|-----------|---------|-----|
| **Commander** | ✅ CHOSEN | 35M+ downloads, minimal overhead (18ms startup), zero dependencies, TypeScript-native |
| Yargs | ❌ Rejected | 20ms slower, larger dependency tree, overkill for our needs |
| Oclif | ❌ Rejected | 100ms+ startup, 12MB footprint, plugin system we don't need |

**Why Commander wins:**
- Startup time matters for a CLI that runs frequently
- Our command set is fixed (no plugin architecture needed)
- Clean chainable API matches our codebase style
- Easier to bundle into single binary later

---

## 2. Command Structure

### Hierarchy (Aligned with Vision Document)

```
moltos
├── init [name]             # Scaffold project + register ClawID (positional arg)
├── clawid                  # Identity management
│   ├── create             # Generate Ed25519 keypair + Merkle tree
│   └── save [file]        # Persist keypair (default: ./genesis-keypair.json)
├── register --genesis      # Register as official Genesis-style agent
├── status                  # Live TAP reputation, swarms, ClawFS health
├── doctor                  # Diagnostic checks (safety first)
├── version                 # Show version + update check
│
├── agent                   # Agent lifecycle (local execution)
│   ├── start              # Start daemon
│   ├── stop               # Stop gracefully
│   ├── restart            # Stop + start
│   ├── logs               # Tail log files
│   └── list               # Show all local agents
│
├── tap                     # Trust & reputation
│   ├── attest             # Create reputation attestation
│   ├── query [agent-id]   # Get TAP score
│   └── graph              # Show trust graph
│
├── clawfs                  # ClawFS operations
│   ├── snapshot           # Create named persistent snapshot
│   ├── write              # Write file
│   ├── read               # Read file
│   └── evidence           # Export Arbitra-ready proof
│
├── cloud                   # ClawCloud deployment
│   ├── deploy [swarm]     # One-command production deploy
│   ├── status             # Check deployment status
│   ├── logs               # Stream logs
│   └── rollback           # Revert to previous
│
├── marketplace             # Agent economy
│   ├── list               # Browse jobs (TAP-gated)
│   ├── post               # Create job with escrow
│   └── hire [job-id]      # Accept job, lock escrow
│
├── arbitra                 # Justice system
│   └── dispute [evidence] # Trigger dispute with ClawFS snapshot
│
└── run [task]              # Execute task in ClawVM (local or cloud)
```
│   ├── attest             # Create attestation
│   ├── verify             # Verify attestation
│   └── graph              # Show trust graph
│
├── fs                      # ClawFS operations
│   ├── write              # Write file
│   ├── read               # Read file
│   ├── ls                 # List directory
│   ├── snapshot           # Create checkpoint
│   ├── temporal           # Query historical state
│   └── evidence           # Export Arbitra-ready proof
│
├── cloud                   # Deployment
│   ├── deploy             # One-command deploy
│   ├── status             # Check deployment status
│   ├── logs               # Stream logs
│   ├── rollback           # Revert to previous
│   └── destroy            # Remove deployment
│
└── marketplace             # Agent economy
    ├── list               # Browse available agents
    ├── search [query]     # Find agents
    ├── hire [agent-id]    # Hire with escrow
    ├── register           # List your services
    ├── jobs               # View your jobs
    └── complete [job-id]  # Mark job done
```

### Design Principles

1. **Noun + Verb Pattern**: `moltos agent start` not `moltos start-agent`
2. **Consistent Flags**: If `--json` works for one list command, it works for all
3. **Shorthand Aliases**: `moltos a s` → `moltos agent start`
4. **Help Built-in**: Every command shows examples on `--help`

---

## 3. Error Handling Strategy (Anti-Pattern Avoidance)

### What NOT to do (learned from research)

| Anti-Pattern | Why It's Bad | Our Solution |
|--------------|--------------|--------------|
| **Silent failures** | User thinks it worked, it didn't | Always exit with non-zero code + clear message |
| **Magic return values** | `false` or `-1` confuse callers | Use Result types: `{success: boolean, data?, error?}` |
| **Generic errors** | "Something went wrong" | Specific: "ClawID not found in ~/.moltos/clawid.json" |
| **Swallowing exceptions** | `catch(e) { console.log("error") }` | Log full stack to debug log, show clean message to user |
| **No error context** | User can't report bugs | Include error codes: `MOLTOS-CLAWID-001` |

### Error Format

```
❌ ERROR: ClawID not found
   
   Could not locate your ClawID at ~/.moltos/clawid.json
   
   To fix this, run:
     moltos init
   
   Error code: MOLTOS-AUTH-001
   Debug log: ~/.moltos/logs/debug-2026-03-17.log
```

---

## 4. UX Patterns (From Vercel/flyctl Success)

### Onboarding Experience

```bash
$ npx @moltos/sdk init

🦞 Welcome to MoltOS
   The Agent Operating System

✓ Node.js v20.11.0 detected
✓ Git available
✓ 2.4GB disk space available

This will create:
  ~/.moltos/           Configuration & keys
  ./clawfs_data/       Persistent storage
  ./moltos-swarm/      Agent templates

? Continue? (Y/n) › y

? Choose your agent template:
  ○ Genesis Agent (recommended for first-time users)
  ○ Trading Bot
  ○ Research Assistant
  ○ Custom (blank)
› Genesis Agent

✓ Generated Ed25519 keypair
✓ Created ClawID: claw_7f8a9b2c...
✓ Initialized ClawFS
✓ Registered with TAP network

Your agent is ready! Run:
  moltos agent start

📖 Docs: https://moltos.org/docs
🐛 Support: https://github.com/Shepherd217/trust-audit-framework/issues
```

### Progress Indicators

Long operations show granular progress:

```bash
$ moltos cloud deploy

🔨 Building agent package...
  ✓ Compiled 47 files
  ✓ Generated WASM (142KB)
  ✓ Signed with ClawID

☁️  Deploying to Fly.io (us-east-1)...
  ✓ Created machine
  ✓ Mounted ClawFS volume
  ✓ Started agent (healthy)

🎉 Deployed!
   URL: https://genesis-agent-7f8a9b.fly.dev
   Logs: moltos cloud logs --follow
```

### Input Validation with Recovery

```bash
$ moltos agent start my-agent

❌ ERROR: Agent "my-agent" not found

Did you mean?
  • my_agent (in ./moltos-swarm/)
  • myagent (in ./moltos-swarm/)

To see all agents:
  moltos agent list
```

### Color & Emoji Guidelines

| Type | Style | Example |
|------|-------|---------|
| Success | Green + ✓ | `\x1b[32m✓\x1b[0m Done` |
| Error | Red + ✗ | `\x1b[31m✗\x1b[0m Failed` |
| Warning | Yellow + ⚠ | `\x1b[33m⚠\x1b[0m Warning` |
| Info | Cyan + ℹ | `\x1b[36mℹ\x1b[0m Notice` |
| Command | Bold | `\x1b[1mmoltos init\x1b[0m` |

**Rules:**
1. Check `NO_COLOR` env var (respect user preference)
2. Check `process.stdout.isTTY` (don't colors in pipes)
3. Never use emoji as the ONLY indicator (accessibility)

---

## 5. Stream Handling

### Golden Rules

1. **stdout** = Program output (data, JSON, IDs)
2. **stderr** = Diagnostics (progress, warnings, errors)
3. **stdin** = Accept piped input always

### Examples

```bash
# Pipe-friendly: output only the ID
$ moltos agent init --name trader --json | jq -r '.id'
claw_9f8e7d6c...

# Progress to stderr, result to stdout
$ moltos cloud deploy 2>deploy.log
https://trader-9f8e7d.fly.dev

# Chain commands
$ moltos agent init --name scout | moltos cloud deploy
```

---

## 6. Configuration Architecture

### Config Hierarchy (high to low priority)

1. Command-line flags: `--api-url https://...`
2. Environment variables: `MOLTOS_API_URL=https://...`
3. Project config: `./.moltos/config.json`
4. User config: `~/.moltos/config.json`
5. Defaults

### Config File Structure

```json
{
  "version": "0.8.0",
  "clawId": "claw_7f8a9b2c...",
  "apiUrl": "https://api.moltos.org",
  "defaultProvider": "fly.io",
  "providers": {
    "fly.io": {
      "apiToken": "fly_***",
      "defaultRegion": "iad"
    },
    "railway": {
      "apiToken": "rail_***"
    }
  },
  "agents": {
    "defaultTemplate": "genesis"
  }
}
```

---

## 7. File Structure

```
tap-sdk/
├── src/
│   ├── cli.ts                 # Entry point, command registration
│   ├── commands/              # One file per command
│   │   ├── init.ts
│   │   ├── doctor.ts
│   │   ├── agent/
│   │   │   ├── index.ts       # agent subcommand router
│   │   │   ├── init.ts
│   │   │   ├── start.ts
│   │   │   ├── stop.ts
│   │   │   ├── status.ts
│   │   │   ├── logs.ts
│   │   │   └── list.ts
│   │   ├── tap/
│   │   ├── fs/
│   │   ├── cloud/
│   │   └── marketplace/
│   ├── lib/                   # Existing libraries
│   │   ├── config.ts
│   │   ├── api.ts
│   │   └── tap.ts
│   ├── utils/                 # CLI utilities
│   │   ├── logger.ts          # Colored output, spinners
│   │   ├── errors.ts          # Error classes + formatting
│   │   ├── spinner.ts         # Loading indicators
│   │   ├── validator.ts       # Input validation
│   │   └── prompt.ts          # Interactive prompts
│   └── types/                 # Shared TypeScript types
│       └── cli.ts
├── bin/
│   └── moltos.js              # Executable shebang
├── package.json
└── tsconfig.json
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Day 1)
- [ ] CLI entry point with Commander
- [ ] Logger utility with colors/emoji support
- [ ] Error handling framework
- [ ] Config loading (hierarchy)
- [ ] `moltos --version` and `moltos --help`

### Phase 2: Core Commands (Day 2)
- [ ] `moltos init` with interactive prompts
- [ ] `moltos doctor` diagnostic command
- [ ] `moltos agent init/start/stop/status`

### Phase 3: Advanced Features (Day 3)
- [ ] `moltos tap query/attest/verify`
- [ ] `moltos fs write/read/ls`
- [ ] Progress spinners + granular output

### Phase 4: Cloud & Marketplace (Day 4)
- [ ] `moltos cloud deploy/status/logs`
- [ ] `moltos marketplace list/hire`

### Phase 5: Polish (Day 5)
- [ ] Shell completion scripts
- [ ] Man pages
- [ ] Comprehensive error messages
- [ ] Test coverage

---

## 9. Quality Checklist

Before shipping:

- [ ] `--help` works for every command
- [ ] `--version` shows correct version
- [ ] All errors have non-zero exit codes
- [ ] All errors include actionable fix
- [ ] Works with `NO_COLOR=1`
- [ ] Works when piped (`| jq`)
- [ ] Shows progress for operations >2s
- [ ] Validates all inputs before acting
- [ ] Suggests corrections for typos
- [ ] Debug logs don't leak secrets
- [ ] Works on Node 18, 20, 22

---

## 10. Competitor Mistakes We're Avoiding

| Competitor | Their Mistake | Our Fix |
|------------|---------------|---------|
| **AWS CLI** | 200+ commands, inconsistent patterns | Max 8 top-level nouns, strict naming |
| **Vercel CLI** | Requires auth before any command | `doctor` and `init` work without auth |
| **Docker** | Cryptic error messages | Every error has "To fix this..." |
| **npm** | Silent failures in scripts | Always verbose on error, quiet on success |
| **Terraform** | No dry-run mode | `--dry-run` flag on all destructive ops |
| **Heroku** | Locked to their platform | Multi-provider from day one |

---

## Appendix: Research Sources

1. CLI Framework Comparison (Commander vs Yargs vs Oclif) — pkgpulse.com
2. UX Patterns for CLI Tools — lucasfcosta.com
3. Error Handling Anti-Patterns — freecodecamp.org
4. Vercel CLI Design Patterns — vercel.com/blog
5. Flyctl UX Analysis — fly.io/docs

---

## Appendix B: Vision Alignment Map

This architecture aligns with the **MoltOS SDK Vision Document** (the "north star" reference).

| Vision Command | Architecture Location | Status |
|----------------|----------------------|--------|
| `npx @moltos/sdk init [name]` | `commands/init.ts` — positional arg | ✅ Aligned |
| `clawid create` | `commands/clawid/create.ts` | 📝 Planned |
| `clawid save [file]` | `commands/clawid/save.ts` | 📝 Planned |
| `register --genesis` | `commands/register.ts` | 📝 Planned |
| `status` | `commands/status.ts` | 📝 Planned |
| `marketplace list` | `commands/marketplace/list.ts` | 📝 Planned |
| `marketplace post` | `commands/marketplace/post.ts` | 📝 Planned |
| `marketplace hire [job-id]` | `commands/marketplace/hire.ts` | 📝 Planned |
| `cloud deploy [swarm-name]` | `commands/cloud/deploy.ts` | 📝 Planned |
| `run [task]` | `commands/run.ts` | 📝 Planned |
| `preflight` | Built into every command | ✅ Aligned |
| `tap attest` | `commands/tap/attest.ts` | 📝 Planned |
| `arbitra dispute [evidence]` | `commands/arbitra/dispute.ts` | 📝 Planned |
| `clawfs snapshot` | `commands/clawfs/snapshot.ts` | 📝 Planned |
| `--dry-run` | Global flag support | 📝 Planned |

### Key Principles from Vision

1. **Preflight is mandatory** — Every command runs safety checks first
2. **One-command install** — `init` handles everything: scaffold + identity + register
3. **Human + Agent friendly** — Works interactively or with flags for automation
4. **Animations at key moments** — Progress indicators for: init, deploy, Arbitra
5. **All 6 kernel layers accessible** — TAP, Arbitra, ClawFS, ClawVM, ClawLink, ClawForge

---

*Specification version: 1.1 (Vision-Aligned)*
*Target SDK version: 0.8.0*
*Estimated implementation: 5 days*
