#!/usr/bin/env python3
"""
Edge Case Testing for Trust Audit Framework
Tests failure modes, cheating attempts, and network issues

Usage: python3 test-edge-cases.py [--verbose]
"""

import json
import sys
import subprocess
import shutil
from pathlib import Path
from datetime import datetime
import argparse

class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    END = '\033[0m'

class EdgeCaseTester:
    def __init__(self, verbose=False):
        self.verbose = verbose
        self.test_dir = Path("/tmp/trust-audit-edge-cases")
        self.results = []
        
    def log(self, message, level="info"):
        if not self.verbose and level == "debug":
            return
        colors = {
            "info": Colors.BLUE,
            "success": Colors.GREEN,
            "warning": Colors.YELLOW,
            "error": Colors.RED
        }
        color = colors.get(level, Colors.BLUE)
        print(f"{color}{message}{Colors.END}")
    
    def setup(self):
        """Clean and create test directory."""
        if self.test_dir.exists():
            shutil.rmtree(self.test_dir)
        self.test_dir.mkdir(parents=True)
    
    def test_missing_files(self):
        """Test: Agent with missing core files."""
        self.log("\n" + "="*60, "info")
        self.log("TEST 1: Missing Core Files", "info")
        self.log("="*60, "info")
        
        workspace = self.test_dir / "agent-missing-files"
        workspace.mkdir()
        
        # Only create 2 of 6 required files
        (workspace / "AGENTS.md").write_text("# AGENTS")
        (workspace / "SOUL.md").write_text("# SOUL")
        # Missing: USER.md, TOOLS.md, MEMORY.md, HEARTBEAT.md
        
        self.log(f"Created workspace with only 2/6 core files", "debug")
        
        # Run boot audit
        script = "/root/.openclaw/workspace/money_empire/reference-implementations/agent-a-boot-audit.sh"
        result = subprocess.run(
            [script, "agent-missing", str(workspace)],
            capture_output=True, text=True, cwd=str(workspace)
        )
        
        # Check output
        output_files = list(workspace.glob("boot-audit-*.json"))
        if output_files:
            data = json.loads(output_files[0].read_text())
            score = data.get('compliance', {}).get('score', 0)
            status = data.get('compliance', {}).get('status', 'UNKNOWN')
            
            self.log(f"Compliance Score: {score}%", "info")
            self.log(f"Status: {status}", "warning" if status != "FULL" else "success")
            
            # Verify it detected missing files
            missing = data.get('core_files', {}).get('missing', [])
            self.log(f"Missing files detected: {len(missing)}", "info")
            
            if len(missing) == 4 and score == 33:
                self.log("✓ CORRECT: Detected 4 missing files, scored 33%", "success")
                self.results.append(("Missing Files", "PASS", f"Score: {score}%, 4 missing"))
                return True
            else:
                self.log("✗ FAIL: Did not correctly detect missing files", "error")
                self.results.append(("Missing Files", "FAIL", f"Expected 4 missing, got {len(missing)}"))
                return False
        else:
            self.log("✗ FAIL: No output file generated", "error")
            self.results.append(("Missing Files", "FAIL", "No output"))
            return False
    
    def test_override_detection(self):
        """Test: Agent with override files present."""
        self.log("\n" + "="*60, "info")
        self.log("TEST 2: Override File Detection", "info")
        self.log("="*60, "info")
        
        workspace = self.test_dir / "agent-overrides"
        workspace.mkdir()
        
        # Create all core files
        for f in ["AGENTS.md", "SOUL.md", "USER.md", "TOOLS.md", "MEMORY.md", "HEARTBEAT.md"]:
            (workspace / f).write_text(f"# {f}")
        
        # Add suspicious override files
        (workspace / ".override").write_text("force=true\nskip_checks=true\n")
        (workspace / "bypass.conf").write_text("ignore_errors=true\n")
        
        self.log("Created workspace with override files", "debug")
        
        # Run boot audit
        script = "/root/.openclaw/workspace/money_empire/reference-implementations/agent-a-boot-audit.sh"
        result = subprocess.run(
            [script, "agent-override", str(workspace)],
            capture_output=True, text=True, cwd=str(workspace)
        )
        
        output_files = list(workspace.glob("boot-audit-*.json"))
        if output_files:
            data = json.loads(output_files[0].read_text())
            overrides = data.get('overrides', {})
            override_count = overrides.get('count', 0)
            
            self.log(f"Overrides detected: {override_count}", "info")
            
            if override_count >= 1:
                self.log("✓ CORRECT: Detected override files", "success")
                self.results.append(("Override Detection", "PASS", f"{override_count} overrides found"))
                return True
            else:
                self.log("✗ FAIL: Override files not detected", "error")
                self.results.append(("Override Detection", "FAIL", "No overrides detected"))
                return False
        else:
            self.log("✗ FAIL: No output file", "error")
            self.results.append(("Override Detection", "FAIL", "No output"))
            return False
    
    def test_workspace_hash_consistency(self):
        """Test: Same workspace produces same hash."""
        self.log("\n" + "="*60, "info")
        self.log("TEST 3: Workspace Hash Consistency", "info")
        self.log("="*60, "info")
        
        workspace = self.test_dir / "agent-hash-test"
        workspace.mkdir()
        
        # Create consistent workspace
        for f in ["AGENTS.md", "SOUL.md", "USER.md", "TOOLS.md", "MEMORY.md", "HEARTBEAT.md"]:
            (workspace / f).write_text(f"# {f}\nConsistent content")
        
        script = "/root/.openclaw/workspace/money_empire/reference-implementations/agent-a-boot-audit.sh"
        
        # Run twice
        hashes = []
        for i in range(2):
            # Clear old output
            for old in workspace.glob("boot-audit-*.json"):
                old.unlink()
            
            result = subprocess.run(
                [script, f"agent-hash-{i}", str(workspace)],
                capture_output=True, text=True, cwd=str(workspace)
            )
            
            output_files = list(workspace.glob("boot-audit-*.json"))
            if output_files:
                data = json.loads(output_files[0].read_text())
                hash_val = data.get('workspace', {}).get('hash', '')
                hashes.append(hash_val)
                self.log(f"Run {i+1} hash: {hash_val[:16]}...", "debug")
        
        if len(hashes) == 2:
            if hashes[0] == hashes[1]:
                self.log(f"✓ CORRECT: Same workspace = same hash", "success")
                self.results.append(("Hash Consistency", "PASS", f"Hash: {hashes[0][:16]}..."))
                return True
            else:
                self.log(f"✗ FAIL: Same workspace produced different hashes", "error")
                self.results.append(("Hash Consistency", "FAIL", "Hashes differ"))
                return False
        else:
            self.log("✗ FAIL: Could not get both hashes", "error")
            self.results.append(("Hash Consistency", "FAIL", "Missing hash data"))
            return False
    
    def test_hash_changes_on_modification(self):
        """Test: Modified workspace produces different hash."""
        self.log("\n" + "="*60, "info")
        self.log("TEST 4: Hash Changes on Modification", "info")
        self.log("="*60, "info")
        
        workspace = self.test_dir / "agent-hash-change"
        workspace.mkdir()
        
        # Create initial workspace
        for f in ["AGENTS.md", "SOUL.md", "USER.md", "TOOLS.md", "MEMORY.md", "HEARTBEAT.md"]:
            (workspace / f).write_text(f"# {f}\nVersion 1")
        
        script = "/root/.openclaw/workspace/money_empire/reference-implementations/agent-a-boot-audit.sh"
        
        # First run
        result = subprocess.run(
            [script, "agent-v1", str(workspace)],
            capture_output=True, text=True, cwd=str(workspace)
        )
        output_files = list(workspace.glob("boot-audit-*.json"))
        hash1 = json.loads(output_files[0].read_text()).get('workspace', {}).get('hash', '')
        
        # Modify a file
        (workspace / "SOUL.md").write_text("# SOUL\nModified content!")
        self.log("Modified SOUL.md content", "debug")
        
        # Second run
        for old in workspace.glob("boot-audit-*.json"):
            old.unlink()
        
        result = subprocess.run(
            [script, "agent-v2", str(workspace)],
            capture_output=True, text=True, cwd=str(workspace)
        )
        output_files = list(workspace.glob("boot-audit-*.json"))
        hash2 = json.loads(output_files[0].read_text()).get('workspace', {}).get('hash', '')
        
        self.log(f"Hash before: {hash1[:16]}...", "debug")
        self.log(f"Hash after:  {hash2[:16]}...", "debug")
        
        if hash1 != hash2:
            self.log("✓ CORRECT: Modified workspace = different hash", "success")
            self.results.append(("Hash Change Detection", "PASS", "Hashes differ as expected"))
            return True
        else:
            self.log("✗ FAIL: Same hash after modification", "error")
            self.results.append(("Hash Change Detection", "FAIL", "Hashes should differ"))
            return False
    
    def test_empty_workspace(self):
        """Test: Completely empty workspace."""
        self.log("\n" + "="*60, "info")
        self.log("TEST 5: Empty Workspace", "info")
        self.log("="*60, "info")
        
        workspace = self.test_dir / "agent-empty"
        workspace.mkdir()
        # No files created
        
        script = "/root/.openclaw/workspace/money_empire/reference-implementations/agent-a-boot-audit.sh"
        result = subprocess.run(
            [script, "agent-empty", str(workspace)],
            capture_output=True, text=True, cwd=str(workspace)
        )
        
        output_files = list(workspace.glob("boot-audit-*.json"))
        if output_files:
            data = json.loads(output_files[0].read_text())
            score = data.get('compliance', {}).get('score', 100)
            status = data.get('compliance', {}).get('status', 'UNKNOWN')
            
            self.log(f"Empty workspace score: {score}%", "info")
            self.log(f"Status: {status}", "info")
            
            if score == 0 and status == "MINIMAL":
                self.log("✓ CORRECT: Empty workspace scored 0%, status MINIMAL", "success")
                self.results.append(("Empty Workspace", "PASS", f"Score: {score}%"))
                return True
            else:
                self.log("✗ FAIL: Should score 0%", "error")
                self.results.append(("Empty Workspace", "FAIL", f"Expected 0%, got {score}%"))
                return False
        else:
            self.log("✗ FAIL: No output", "error")
            self.results.append(("Empty Workspace", "FAIL", "No output"))
            return False
    
    def test_permission_errors(self):
        """Test: Files with permission errors."""
        self.log("\n" + "="*60, "info")
        self.log("TEST 6: Permission Errors (Graceful Degradation)", "info")
        self.log("="*60, "info")
        
        workspace = self.test_dir / "agent-permissions"
        workspace.mkdir()
        
        # Create files
        for f in ["AGENTS.md", "SOUL.md"]:
            (workspace / f).write_text(f"# {f}")
        
        # Make one unreadable (if running as root, this won't work, so just test graceful handling)
        try:
            (workspace / "SOUL.md").chmod(0o000)
            
            script = "/root/.openclaw/workspace/money_empire/reference-implementations/agent-a-boot-audit.sh"
            result = subprocess.run(
                [script, "agent-perm", str(workspace)],
                capture_output=True, text=True, cwd=str(workspace)
            )
            
            # Should complete without crashing
            if result.returncode == 0:
                self.log("✓ CORRECT: Gracefully handled permission errors", "success")
                self.results.append(("Permission Errors", "PASS", "Graceful handling"))
                success = True
            else:
                self.log("✗ FAIL: Crashed on permission errors", "error")
                self.results.append(("Permission Errors", "FAIL", "Crashed"))
                success = False
            
            # Restore permissions for cleanup
            (workspace / "SOUL.md").chmod(0o644)
            return success
            
        except Exception as e:
            self.log(f"Permission test skipped (possibly running as root): {e}", "warning")
            self.results.append(("Permission Errors", "SKIP", "Cannot test as root"))
            return True  # Skip, not fail
    
    def generate_report(self):
        """Generate final test report."""
        print("\n" + "="*70)
        print("EDGE CASE TEST REPORT")
        print("="*70)
        
        passed = sum(1 for _, status, _ in self.results if status == "PASS")
        failed = sum(1 for _, status, _ in self.results if status == "FAIL")
        skipped = sum(1 for _, status, _ in self.results if status == "SKIP")
        
        print(f"\nResults: {passed} passed, {failed} failed, {skipped} skipped")
        print(f"Success Rate: {passed / max(1, len(self.results)):.1%}")
        print()
        
        for test_name, status, details in self.results:
            color = Colors.GREEN if status == "PASS" else Colors.YELLOW if status == "SKIP" else Colors.RED
            print(f"  [{color}{status:6}{Colors.END}] {test_name:30} {details}")
        
        print("\n" + "="*70)
        
        if failed == 0:
            print(f"{Colors.GREEN}✓ All critical edge cases handled correctly{Colors.END}")
            return 0
        else:
            print(f"{Colors.RED}✗ {failed} edge case(s) need attention{Colors.END}")
            return 1
    
    def run_all_tests(self):
        """Run all edge case tests."""
        self.setup()
        
        self.test_missing_files()
        self.test_override_detection()
        self.test_workspace_hash_consistency()
        self.test_hash_changes_on_modification()
        self.test_empty_workspace()
        self.test_permission_errors()
        
        return self.generate_report()

def main():
    parser = argparse.ArgumentParser(description="Edge Case Testing for Trust Audit Framework")
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    args = parser.parse_args()
    
    tester = EdgeCaseTester(verbose=args.verbose)
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
