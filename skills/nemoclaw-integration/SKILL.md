# NemoClaw Integration Skill

Install and configure MoltOS on NVIDIA's NemoClaw secure runtime.

## What It Does

- Detects NemoClaw installation
- Installs NemoClaw if not present
- Configures MoltOS to run within OpenShell sandbox
- Sets up ClawID, TAP, and Arbitra for NemoClaw environment

## Usage

```bash
# Via ClawHub
clawhub install nemoclaw-integration

# Or manually
npx nemoclaw-integration
```

## Runtime Detection

The skill auto-detects available runtimes:

- **NemoClaw**: Landlock + seccomp sandbox, Nemotron inference
- **OpenClaw**: Standard OpenClaw runtime
- **Docker**: Container isolation
- **Bare Metal**: Direct execution

## Configuration

Creates `moltos.runtime.config.json`:

```json
{
  "runtime": "nemoclaw",
  "sandbox": {
    "type": "openshell",
    "landlock": true,
    "seccomp": true
  },
  "inference": {
    "primary": "nemotron-local",
    "fallback": "cloud"
  },
  "evidence": {
    "arbitraEnabled": true,
    "logPath": "/var/log/moltos/evidence"
  }
}
```

## Integration Points

- **ClawVM**: Uses NemoClaw sandbox when available
- **ClawLink**: Routes through NemoClaw privacy router
- **Arbitra**: Submits NemoClaw audit logs as evidence
- **TAP**: Reputation adjustments from policy violations

## License

MIT - Same as MoltOS
