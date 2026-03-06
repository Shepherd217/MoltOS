# Contributing to Trust Audit Framework

Thank you for your interest in contributing! This document provides guidelines for contributing to the framework.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Agent Implementations](#agent-implementations)
- [Questions?](#questions)

---

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) code of conduct:

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Started

### Prerequisites

- Python 3.8+ or Node.js 16+
- Git
- A POSIX-compatible shell (bash, zsh)

### Quick Start

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/trust-audit-framework.git
cd trust-audit-framework

# Run the demo
./demo.sh

# Run tests
python3 test-edge-cases.py
python3 test-cross-attestation-enhanced.py
```

## How to Contribute

### Types of Contributions

We welcome:

1. **Bug Reports** — Found an issue? Open an issue with reproduction steps
2. **Feature Requests** — Have an idea? Open an issue to discuss
3. **Documentation** — Typos, clarifications, examples
4. **Code** — Bug fixes, new features, agent implementations
5. **Testing** — Edge cases, stress tests, real-world scenarios

### Contribution Workflow

1. **Fork** the repository
2. **Create a branch** for your feature (`git checkout -b feature/amazing-feature`)
3. **Make changes** with clear commit messages
4. **Test** your changes
5. **Push** to your fork (`git push origin feature/amazing-feature`)
6. **Open a Pull Request** with detailed description

---

## Development Setup

### Python Agents

```bash
# Setup virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies (if we add requirements.txt)
pip install -r requirements.txt

# Run specific agent
python3 reference-implementations/agent_b.py --agent-id test --workspace /tmp/test
```

### Node.js Agents

```bash
# Install dependencies
cd reference-implementations
npm install

# Run agent
node agent_c.js --agent-id test --workspace /tmp/test
```

### Shell Scripts

```bash
# Make executable
chmod +x reference-implementations/agent-a-boot-audit.sh

# Run
./reference-implementations/agent-a-boot-audit.sh my-agent /workspace/path
```

---

## Testing

### Run All Tests

```bash
# Edge cases (6 tests)
python3 test-edge-cases.py

# Cross-attestation simulation
python3 test-cross-attestation-enhanced.py

# Quick demo
./demo.sh
```

### Test Coverage Requirements

- **Boot Audit Tests**: Verify compliance scoring, hash consistency
- **Trust Ledger Tests**: Verify entry creation, classification
- **Attestation Tests**: Verify consensus calculation, staking
- **Edge Cases**: Missing files, overrides, empty workspace

### Adding New Tests

```python
# In test-edge-cases.py or new file
def test_my_feature():
    """Test description."""
    # Setup
    workspace = create_test_workspace("test-feature")
    
    # Execute
    result = run_agent(workspace)
    
    # Verify
    assert result['compliance']['score'] == 100
    
    # Log
    self.log("✓ Feature works correctly", "success")
    self.results.append(("My Feature", "PASS", "Details"))
```

---

## Submitting Changes

### Commit Message Format

```
type: Brief description (50 chars or less)

Longer explanation if needed (wrap at 72 chars).
Can include multiple paragraphs.

- Bullet points are okay
- Reference issues: Fixes #123
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Adding/updating tests
- `refactor:` Code refactoring
- `perf:` Performance improvement
- `chore:` Maintenance tasks

### Example Commits

```bash
git commit -m "feat: Add TypeScript agent implementation

Implements Agent E with full type safety.
Includes boot audit, trust ledger, and basic attestation.

Closes #42"
```

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Agent implementation
- [ ] Test

## Testing
- [ ] All tests pass
- [ ] Added new tests for new functionality
- [ ] Tested on [agent type]

## Checklist
- [ ] Code follows project style
- [] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
```

---

## Agent Implementations

### Adding a New Agent

Want to implement the framework in a new language? Here's the checklist:

#### Minimum Requirements (Layer 1)

- [ ] Boot audit runs at agent spawn
- [ ] Checks for 6 core files (AGENTS.md, SOUL.md, USER.md, TOOLS.md, MEMORY.md, HEARTBEAT.md)
- [ ] Detects override files (.override, bypass.conf, etc.)
- [ ] Outputs JSON matching [attestation format](reference-implementations/attestation-format-spec.md)
- [ ] Generates consistent workspace hash

#### Layer 2 (Trust Ledger)

- [ ] Implements The 4 Questions
- [ ] Classifies actions by failure type
- [ ] Records to trust-ledger.json
- [ ] Supports weekly reports

#### Layer 3 (Cross-Attestation)

- [ ] Can request attestations from peers
- [ ] Can provide attestations to peers
- [ ] Calculates consensus (2+ confirms = confirmed)
- [ ] Records attestation history

#### Layer 4 (Third-Party Verification)

- [ ] Can request external verification
- [ ] Can provide verification results
- [ ] Supports evidence attachments

### Agent Template

Create `agent_X.[py|js|sh|...]`:

```python
#!/usr/bin/env python3
"""
Agent X — [Language] Implementation
[One-line description]

Usage: [command]
"""

import json
from pathlib import Path
from datetime import datetime

CORE_FILES = ['AGENTS.md', 'SOUL.md', 'USER.md', 'TOOLS.md', 'MEMORY.md', 'HEARTBEAT.md']

def boot_audit(agent_id: str, workspace: Path) -> dict:
    """Run Layer 1 boot audit."""
    # Check files
    # Detect overrides
    # Generate hash
    # Return JSON
    pass

def create_ledger_entry(action: str, **kwargs) -> dict:
    """Create Layer 2 Trust Ledger entry."""
    pass

def request_attestation(claim: str, peers: list) -> dict:
    """Request Layer 3 attestation."""
    pass

if __name__ == '__main__':
    # CLI interface
    pass
```

### Testing Your Agent

```bash
# Run edge cases against your agent
python3 test-edge-cases.py

# Test in cross-attestation ring
python3 test-cross-attestation-enhanced.py --agents 5

# Manual test
./your-agent.sh test-agent /tmp/test-workspace
cat /tmp/test-workspace/boot-audit-*.json
```

---

## Documentation

### README Updates

If you add a new agent:

1. Add to Examples section
2. Include one-line use case
3. Show installation command
4. Link to full implementation

### Architecture Docs

For significant changes, update [ARCHITECTURE.md](ARCHITECTURE.md):

- Add new diagrams
- Update data flow
- Document integration points

---

## Questions?

### Where to Ask

- **GitHub Issues**: Bug reports, feature requests
- **Moltbook m/builds**: Implementation discussions
- **Alpha Collective**: Production deployment questions

### Common Issues

**Q: My agent's hash changes every run**  
A: Hash should be based on file content, not timestamp or agent_id

**Q: Attestation consensus not reaching**  
A: Ensure 2+ peers are providing confirms with ≥80% confidence

**Q: Boot audit fails with no output**  
A: Check workspace path exists and contains at least one .md file

---

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Invited to Alpha Collective (for significant contributions)

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for helping make AI agents more trustworthy! 🦞
