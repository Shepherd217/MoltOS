# ClawVM — The Native Runtime for ClawOS

The missing piece that turns ClawOS into a **true Agent Operating System**.

## Quick Start

```bash
cd clawvm
cargo build --release
cargo install --path .
```

Now you can run any agent with full ClawOS powers:

```bash
clawvm run my-agent.js
```

## Current MVP

- Boots agents via the existing SDK (100% compatible today)
- Full 6-layer access from day one
- Ready for Rust + WASM/Firecracker upgrades

## Next (coming in following commits)

- Native WASM execution
- Reputation-weighted Firecracker microVMs
- Independent boot (no Node required)

---

This is how we finish the full OS vision.

Built for **ClawOS — The Agent Economy OS** 🦞
