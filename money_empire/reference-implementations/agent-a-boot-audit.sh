#!/bin/bash
#
# Agent A - Minimal Boot-Audit (Simplified)
# Reference Implementation for Trust Audit Framework
# 
# Alpha Collective Integration: Layer 1 (Boot-Time Audit)
# 
# Usage: ./agent-a-boot-audit.sh [agent_id] [workspace_dir]

AGENT_ID="${1:-$(hostname)}"
WORKSPACE_DIR="${2:-/root/.openclaw/workspace}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%SZ")
OUTPUT_FILE="boot-audit-${AGENT_ID}-$(date -u +%Y%m%d-%H%M%S 2>/dev/null || date +%Y%m%d-%H%M%S).json"

echo "🔍 Agent A - Boot-Time Audit"
echo "============================"
echo "Agent ID: $AGENT_ID"
echo "Timestamp: $TIMESTAMP"
echo "Workspace: $WORKSPACE_DIR"
echo ""

# Initialize counters
FILES_CHECKED=0
FILES_PRESENT=0
OVERRIDES_LOGGED=0
WARNINGS=0

# Core files to check (space-separated for POSIX compatibility)
CORE_FILES="AGENTS.md SOUL.md USER.md TOOLS.md MEMORY.md HEARTBEAT.md"

# Check each core file
PRESENT_LIST=""
MISSING_LIST=""

for file in $CORE_FILES; do
    FILES_CHECKED=$((FILES_CHECKED + 1))
    if [ -f "$WORKSPACE_DIR/$file" ]; then
        FILES_PRESENT=$((FILES_PRESENT + 1))
        PRESENT_LIST="$PRESENT_LIST$file,"
        echo "✓ $file"
    else
        MISSING_LIST="$MISSING_LIST$file,"
        echo "✗ $file (MISSING)"
        WARNINGS=$((WARNINGS + 1))
    fi
done

# Remove trailing commas
PRESENT_LIST=$(echo "$PRESENT_LIST" | sed 's/,$//')
MISSING_LIST=$(echo "$MISSING_LIST" | sed 's/,$//')

echo ""

# Simple override check (just specific files, no find command)
OVERRIDE_LIST=""
for file in .override bypass.conf force-flags.txt skip-checks.md; do
    if [ -f "$WORKSPACE_DIR/$file" ]; then
        OVERRIDES_LOGGED=$((OVERRIDES_LOGGED + 1))
        OVERRIDE_LIST="$OVERRIDE_LIST$file,"
        echo "⚠ Override file found: $file"
    fi
done
OVERRIDE_LIST=$(echo "$OVERRIDE_LIST" | sed 's/,$//')

# Generate simple hash
WORKSPACE_HASH=$(echo "$AGENT_ID$TIMESTAMP" | sha256sum 2>/dev/null | cut -d' ' -f1 | head -c 16 || echo "$(date +%s)" | sha256sum | cut -d' ' -f1 | head -c 16)

echo ""
echo "Workspace Hash: $WORKSPACE_HASH"
echo ""

# Determine compliance status
if [ $FILES_PRESENT -eq 6 ] && [ $OVERRIDES_LOGGED -eq 0 ]; then
    COMPLIANCE_STATUS="FULL"
    COMPLIANCE_SCORE=100
elif [ $FILES_PRESENT -ge 3 ]; then
    COMPLIANCE_STATUS="PARTIAL"
    COMPLIANCE_SCORE=$(( FILES_PRESENT * 100 / 6 ))
else
    COMPLIANCE_STATUS="MINIMAL"
    COMPLIANCE_SCORE=$(( FILES_PRESENT * 100 / 6 ))
fi

# Build JSON output (simple approach)
NEXT_AUDIT=$(date -u -d '+7 days' +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -v+7d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "7 days from now")

# Convert comma lists to JSON arrays
PRESENT_JSON="[$(echo "$PRESENT_LIST" | sed 's/[^,]*/"&"/g')]"
MISSING_JSON="[$(echo "$MISSING_LIST" | sed 's/[^,]*/"&"/g')]"
OVERRIDE_JSON="[$(echo "$OVERRIDE_LIST" | sed 's/[^,]*/"&"/g')]"

cat > "$OUTPUT_FILE" << EOF
{
  "agent_id": "$AGENT_ID",
  "agent_type": "Agent-A-Minimal",
  "framework_version": "1.0.0",
  "timestamp": "$TIMESTAMP",
  "layer": 1,
  "audit_type": "boot-time",
  "workspace": {
    "path": "$WORKSPACE_DIR",
    "hash": "$WORKSPACE_HASH"
  },
  "compliance": {
    "status": "$COMPLIANCE_STATUS",
    "score": $COMPLIANCE_SCORE,
    "files_checked": $FILES_CHECKED,
    "files_present": $FILES_PRESENT,
    "files_expected": 6
  },
  "core_files": {
    "present": $PRESENT_JSON,
    "missing": $MISSING_JSON
  },
  "overrides": {
    "count": $OVERRIDES_LOGGED,
    "items": $OVERRIDE_JSON
  },
  "warnings": $WARNINGS,
  "signature": {
    "algorithm": "none",
    "value": ""
  },
  "next_audit_due": "$NEXT_AUDIT"
}
EOF

echo "✅ Boot audit complete"
echo "📄 Output: $OUTPUT_FILE"
echo "📊 Compliance: $COMPLIANCE_STATUS ($COMPLIANCE_SCORE%)"
echo "🔔 Next audit due: 7 days"
echo ""
echo "Summary:"
echo "- Files checked: $FILES_CHECKED"
echo "- Files present: $FILES_PRESENT"
echo "- Overrides detected: $OVERRIDES_LOGGED"
echo "- Warnings: $WARNINGS"
echo ""

if [ $WARNINGS -gt 0 ]; then
    echo "⚠ Audit passed with warnings. Review missing files and overrides."
else
    echo "✓ Audit passed. Agent cleared for operation."
fi

exit 0
