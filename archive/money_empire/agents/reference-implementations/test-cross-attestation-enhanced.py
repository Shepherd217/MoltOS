#!/usr/bin/env python3
"""
Cross-Attestation Test (Layer 3) - Enhanced Version
Simulates Sunday's 17-agent cross-verification with full controls

Usage:
    python3 test-cross-attestation-enhanced.py [options]

Options:
    --agents N          Number of agents to simulate (default: 3)
    --stake-min N       Minimum stake amount (default: 10.0)
    --stake-max N       Maximum stake amount (default: 25.0)
    --threshold N       Consensus threshold (default: 2)
    --confidence-min N  Minimum confidence (default: 0.80)
    --confidence-max N  Maximum confidence (default: 0.95)
    --failure-rate N    Simulated failure rate 0-1 (default: 0.10)
    --output FORMAT     Output format: text|json|csv|all (default: text)
    --export DIR        Export directory for reports
    --verbose           Show detailed logs
    --demo              Run interactive demo mode
    --stress-test       Run stress test with many agents

Examples:
    python3 test-cross-attestation-enhanced.py --agents 5 --stake-min 5 --stake-max 50
    python3 test-cross-attestation-enhanced.py --output json --export ./reports
    python3 test-cross-attestation-enhanced.py --stress-test --agents 17
"""

import json
import os
import sys
import subprocess
import argparse
import csv
import random
from pathlib import Path
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
from enum import Enum

class ConsensusStatus(Enum):
    CONFIRMED = "confirmed"
    PENDING = "pending"
    REJECTED = "rejected"

class Verdict(Enum):
    CONFIRM = "confirm"
    REJECT = "reject"
    ABSTAIN = "abstain"

@dataclass
class AttestationConfig:
    """Configuration for attestation simulation."""
    num_agents: int = 3
    stake_min: float = 10.0
    stake_max: float = 25.0
    consensus_threshold: int = 2
    confidence_min: float = 0.80
    confidence_max: float = 0.95
    failure_rate: float = 0.10
    output_format: str = "text"
    export_dir: Optional[str] = None
    verbose: bool = False
    demo_mode: bool = False

@dataclass
class Agent:
    """Represents an agent in the attestation ring."""
    id: str
    agent_type: str
    workspace: Path
    boot_audit: Dict[str, Any]
    reputation_score: float = 0.5
    total_staked: float = 0.0
    total_slashed: float = 0.0

@dataclass
class AttestationResponse:
    """Response from an attestor."""
    attestor_id: str
    verdict: str
    confidence: float
    reason: str
    timestamp: str

@dataclass
class Attestation:
    """Full attestation record."""
    attestation_id: str
    requester_id: str
    claim: str
    evidence: Dict[str, Any]
    responses: List[AttestationResponse]
    consensus: str
    stake_amount: float
    timestamp: str

@dataclass
class TestMetrics:
    """Metrics from the test run."""
    start_time: str
    end_time: Optional[str] = None
    total_agents: int = 0
    successful_audits: int = 0
    total_attestations: int = 0
    confirmed: int = 0
    pending: int = 0
    rejected: int = 0
    total_staked: float = 0.0
    total_released: float = 0.0
    total_slashed: float = 0.0
    avg_confirmation_time: float = 0.0
    network_health: float = 0.0

class Colors:
    """Terminal colors for output."""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'

class CrossAttestationTester:
    """Main tester class with full controls."""
    
    def __init__(self, config: AttestationConfig):
        self.config = config
        self.agents: List[Agent] = []
        self.attestations: List[Attestation] = []
        self.metrics = TestMetrics(start_time=datetime.utcnow().isoformat() + 'Z')
        self.use_color = sys.stdout.isatty()
        
    def color(self, color_code: str, text: str) -> str:
        """Apply color if terminal supports it."""
        if self.use_color:
            return f"{color_code}{text}{Colors.END}"
        return text
    
    def log(self, message: str, level: str = "info"):
        """Log message with level."""
        if not self.config.verbose and level == "debug":
            return
        
        timestamp = datetime.utcnow().strftime("%H:%M:%S")
        colors = {
            "info": Colors.BLUE,
            "success": Colors.GREEN,
            "warning": Colors.YELLOW,
            "error": Colors.RED,
            "debug": Colors.CYAN
        }
        
        prefix = self.color(colors.get(level, Colors.BLUE), f"[{timestamp}]")
        print(f"{prefix} {message}")
    
    def create_workspace(self, agent_id: str, agent_type: str) -> Path:
        """Create agent workspace with optional flaws."""
        workspace = Path(f"/tmp/cross-attestation-test/{agent_id}")
        workspace.mkdir(parents=True, exist_ok=True)
        
        core_files = ["AGENTS.md", "SOUL.md", "USER.md", "TOOLS.md", "MEMORY.md", "HEARTBEAT.md"]
        
        # Simulate failures based on failure_rate
        for file in core_files:
            if random.random() > self.config.failure_rate:
                (workspace / file).write_text(f"# {file}\nTest content for {agent_id}\n")
        
        # Occasionally add override files
        if random.random() < self.config.failure_rate / 2:
            (workspace / ".override").write_text("force=true\n")
        
        return workspace
    
    def run_boot_audit(self, agent_id: str, workspace: Path, agent_type: str) -> Optional[Dict]:
        """Run boot audit based on agent type."""
        scripts = {
            "A": "/root/.openclaw/workspace/money_empire/reference-implementations/agent-a-boot-audit.sh",
            "B": "/root/.openclaw/workspace/money_empire/reference-implementations/agent_b.py",
            "C": "/root/.openclaw/workspace/money_empire/reference-implementations/agent_c.js"
        }
        
        script = scripts.get(agent_type, scripts["A"])
        
        try:
            if agent_type == "A":
                # Shell script
                for old_file in workspace.glob("boot-audit-*.json"):
                    old_file.unlink()
                
                result = subprocess.run(
                    [script, agent_id, str(workspace)],
                    capture_output=True, text=True, cwd=str(workspace), timeout=30
                )
                
                output_files = list(workspace.glob("boot-audit-*.json"))
                if output_files:
                    return json.loads(output_files[0].read_text())
                    
            elif agent_type == "B":
                # Python
                output_file = workspace / f"boot-audit-{agent_id}.json"
                result = subprocess.run(
                    [sys.executable, script, "--agent-id", agent_id,
                     "--workspace", str(workspace), "--output", str(output_file)],
                    capture_output=True, text=True, timeout=30
                )
                if output_file.exists():
                    return json.loads(output_file.read_text())
                    
            elif agent_type == "C":
                # Node.js
                output_file = workspace / f"boot-audit-{agent_id}.json"
                result = subprocess.run(
                    ["node", script, "--agent-id", agent_id,
                     "--workspace", str(workspace), "--output", str(output_file)],
                    capture_output=True, text=True, timeout=30
                )
                if output_file.exists():
                    return json.loads(output_file.read_text())
        
        except Exception as e:
            self.log(f"Error running audit for {agent_id}: {e}", "error")
        
        return None
    
    def setup_agents(self):
        """Create and audit all agents."""
        self.log("=" * 60, "info")
        self.log("PHASE 1: Agent Setup & Boot Audits", "info")
        self.log("=" * 60, "info")
        
        agent_types = ["A", "B", "C"]
        
        for i in range(self.config.num_agents):
            agent_id = f"agent-{i+1:02d}"
            agent_type = agent_types[i % len(agent_types)]
            
            self.log(f"\n[{agent_id}] Creating workspace...", "debug")
            workspace = self.create_workspace(agent_id, agent_type)
            
            self.log(f"[{agent_id}] Running boot audit (Type {agent_type})...", "debug")
            audit_data = self.run_boot_audit(agent_id, workspace, agent_type)
            
            if audit_data:
                score = audit_data.get('compliance', {}).get('score', 0)
                status = audit_data.get('compliance', {}).get('status', 'UNKNOWN')
                self.log(f"[{agent_id}] {self.color(Colors.GREEN, '✓')} Audit: {status} ({score}%)", "success")
                
                agent = Agent(
                    id=agent_id,
                    agent_type=f"Type-{agent_type}",
                    workspace=workspace,
                    boot_audit=audit_data,
                    reputation_score=score / 100.0
                )
                self.agents.append(agent)
                self.metrics.successful_audits += 1
            else:
                self.log(f"[{agent_id}] {self.color(Colors.RED, '✗')} Audit failed", "error")
        
        self.metrics.total_agents = len(self.agents)
        self.log(f"\n{self.metrics.successful_audits}/{self.config.num_agents} agents ready", "info")
    
    def generate_verdict(self, attestor: Agent, requester: Agent) -> AttestationResponse:
        """Generate attestation verdict with configurable parameters."""
        # Base confidence on attestor reputation
        base_confidence = attestor.reputation_score
        
        # Add randomness within configured range
        confidence = random.uniform(
            max(self.config.confidence_min, base_confidence - 0.1),
            min(self.config.confidence_max, base_confidence + 0.1)
        )
        
        # Determine verdict based on confidence and failure rate
        roll = random.random()
        
        if roll < (1 - self.config.failure_rate) * confidence:
            verdict = Verdict.CONFIRM.value
            reason = f"Workspace integrity verified (hash: {requester.boot_audit.get('workspace', {}).get('hash', 'N/A')[:8]}...)"
        elif roll < (1 - self.config.failure_rate):
            verdict = Verdict.ABSTAIN.value
            confidence = 0.5
            reason = "Insufficient data to verify claim"
        else:
            verdict = Verdict.REJECT.value
            reason = "Verification failed: workspace hash mismatch"
        
        return AttestationResponse(
            attestor_id=attestor.id,
            verdict=verdict,
            confidence=round(confidence, 2),
            reason=reason,
            timestamp=datetime.utcnow().isoformat() + 'Z'
        )
    
    def run_attestations(self):
        """Execute cross-attestation between agents."""
        self.log("\n" + "=" * 60, "info")
        self.log("PHASE 2: Cross-Agent Attestation", "info")
        self.log("=" * 60, "info")
        
        for i, requester in enumerate(self.agents):
            # Select peers (next N agents in ring)
            peers = []
            for j in range(1, self.config.consensus_threshold + 1):
                peer_idx = (i + j) % len(self.agents)
                peers.append(self.agents[peer_idx])
            
            self.log(f"\n[{requester.id}] Requesting attestation from {', '.join(p.id for p in peers)}")
            
            # Generate stake amount
            stake = round(random.uniform(self.config.stake_min, self.config.stake_max), 2)
            requester.total_staked += stake
            
            # Collect responses
            responses = []
            for peer in peers:
                response = self.generate_verdict(peer, requester)
                responses.append(response)
                
                status_color = Colors.GREEN if response.verdict == "confirm" else Colors.YELLOW if response.verdict == "abstain" else Colors.RED
                self.log(f"  [{peer.id}] -> {self.color(status_color, response.verdict)} ({response.confidence:.0%} confidence)")
            
            # Calculate consensus
            confirms = sum(1 for r in responses if r.verdict == "confirm")
            rejects = sum(1 for r in responses if r.verdict == "reject")
            
            if confirms >= self.config.consensus_threshold:
                consensus = ConsensusStatus.CONFIRMED.value
                requester.reputation_score = min(1.0, requester.reputation_score + 0.05)
            elif rejects >= self.config.consensus_threshold:
                consensus = ConsensusStatus.REJECTED.value
                requester.reputation_score = max(0.0, requester.reputation_score - 0.1)
            else:
                consensus = ConsensusStatus.PENDING.value
            
            status_color = Colors.GREEN if consensus == "confirmed" else Colors.YELLOW if consensus == "pending" else Colors.RED
            self.log(f"  Consensus: {self.color(status_color, consensus.upper())}")
            
            attestation = Attestation(
                attestation_id=f"att-{requester.id}-{i:03d}",
                requester_id=requester.id,
                claim=f"Boot audit: {requester.boot_audit.get('compliance', {}).get('score', 0)}% compliance",
                evidence={
                    "workspace_hash": requester.boot_audit.get('workspace', {}).get('hash', ''),
                    "files_present": requester.boot_audit.get('compliance', {}).get('files_present', 0)
                },
                responses=responses,
                consensus=consensus,
                stake_amount=stake,
                timestamp=datetime.utcnow().isoformat() + 'Z'
            )
            
            self.attestations.append(attestation)
            
            # Update metrics
            self.metrics.total_attestations += 1
            if consensus == "confirmed":
                self.metrics.confirmed += 1
                self.metrics.total_released += stake
            elif consensus == "pending":
                self.metrics.pending += 1
            else:
                self.metrics.rejected += 1
                self.metrics.total_slashed += stake * 0.5
                requester.total_slashed += stake * 0.5
        
        self.metrics.total_staked = sum(a.stake_amount for a in self.attestations)
    
    def generate_text_report(self):
        """Generate text-based report."""
        lines = []
        lines.append("\n" + "=" * 70)
        lines.append(self.color(Colors.HEADER + Colors.BOLD, "CROSS-ATTESTATION TEST REPORT"))
        lines.append("=" * 70)
        
        lines.append("\n" + self.color(Colors.BOLD, "CONFIGURATION:"))
        lines.append(f"  Agents:              {self.config.num_agents}")
        lines.append(f"  Consensus Threshold: {self.config.consensus_threshold}")
        lines.append(f"  Stake Range:         {self.config.stake_min:.2f} - {self.config.stake_max:.2f} $ALPHA")
        lines.append(f"  Confidence Range:    {self.config.confidence_min:.0%} - {self.config.confidence_max:.0%}")
        lines.append(f"  Simulated Failure:   {self.config.failure_rate:.0%}")
        
        lines.append("\n" + self.color(Colors.BOLD, "EXECUTION METRICS:"))
        lines.append(f"  Start Time:          {self.metrics.start_time}")
        lines.append(f"  Total Agents:        {self.metrics.total_agents}")
        lines.append(f"  Successful Audits:   {self.metrics.successful_audits}")
        lines.append(f"  Success Rate:        {self.metrics.successful_audits/max(1,self.config.num_agents):.1%}")
        
        lines.append("\n" + self.color(Colors.BOLD, "ATTESTATION RESULTS:"))
        lines.append(f"  Total Attestations:  {self.metrics.total_attestations}")
        lines.append(f"  Confirmed:           {self.color(Colors.GREEN, str(self.metrics.confirmed))}")
        lines.append(f"  Pending:             {self.color(Colors.YELLOW, str(self.metrics.pending))}")
        lines.append(f"  Rejected:            {self.color(Colors.RED, str(self.metrics.rejected))}")
        lines.append(f"  Confirmation Rate:   {self.metrics.confirmed/max(1,self.metrics.total_attestations):.1%}")
        
        lines.append("\n" + self.color(Colors.BOLD, "ECONOMIC LAYER ($ALPHA):"))
        lines.append(f"  Total Staked:        {self.metrics.total_staked:.2f}")
        lines.append(f"  Released (Success):  {self.color(Colors.GREEN, f'{self.metrics.total_released:.2f}')}")
        lines.append(f"  Slashed (Failure):   {self.color(Colors.RED, f'{self.metrics.total_slashed:.2f}')}")
        lines.append(f"  Active Stakes:       {self.metrics.total_staked - self.metrics.total_released:.2f}")
        
        # Network health
        health = self.metrics.confirmed / max(1, self.metrics.total_attestations)
        self.metrics.network_health = health
        
        if health >= 0.8:
            health_status = self.color(Colors.GREEN, "HEALTHY ✅")
        elif health >= 0.5:
            health_status = self.color(Colors.YELLOW, "STABLE ⚠️")
        else:
            health_status = self.color(Colors.RED, "AT RISK ❌")
        
        lines.append("\n" + self.color(Colors.BOLD, "NETWORK HEALTH:"))
        lines.append(f"  Health Score:        {health:.1%}")
        lines.append(f"  Status:              {health_status}")
        
        lines.append("\n" + self.color(Colors.BOLD, "AGENT BREAKDOWN:"))
        for agent in self.agents:
            rep_color = Colors.GREEN if agent.reputation_score >= 0.8 else Colors.YELLOW if agent.reputation_score >= 0.5 else Colors.RED
            lines.append(f"  {agent.id:12} {agent.agent_type:10} Rep: {self.color(rep_color, f'{agent.reputation_score:.2f}')} Staked: {agent.total_staked:.2f}")
        
        lines.append("\n" + self.color(Colors.BOLD, "ATTESTATION MATRIX:"))
        for att in self.attestations:
            status_color = Colors.GREEN if att.consensus == "confirmed" else Colors.YELLOW if att.consensus == "pending" else Colors.RED
            lines.append(f"\n  {att.requester_id} -> {self.color(status_color, att.consensus.upper())} (stake: {att.stake_amount:.2f})")
            for resp in att.responses:
                resp_color = Colors.GREEN if resp.verdict == "confirm" else Colors.YELLOW if resp.verdict == "abstain" else Colors.RED
                lines.append(f"    [{resp.attestor_id:12}] {self.color(resp_color, resp.verdict):10} {resp.confidence:.0%}")
        
        lines.append("\n" + "=" * 70)
        lines.append(f"Report Generated: {datetime.utcnow().isoformat() + 'Z'}")
        lines.append("=" * 70 + "\n")
        
        return "\n".join(lines)
    
    def generate_json_report(self) -> str:
        """Generate JSON report."""
        self.metrics.end_time = datetime.utcnow().isoformat() + 'Z'
        self.metrics.network_health = self.metrics.confirmed / max(1, self.metrics.total_attestations)
        
        report = {
            "config": {
                "num_agents": self.config.num_agents,
                "consensus_threshold": self.config.consensus_threshold,
                "stake_range": [self.config.stake_min, self.config.stake_max],
                "confidence_range": [self.config.confidence_min, self.config.confidence_max],
                "failure_rate": self.config.failure_rate
            },
            "metrics": asdict(self.metrics),
            "agents": [
                {
                    "id": a.id,
                    "type": a.agent_type,
                    "reputation": a.reputation_score,
                    "total_staked": a.total_staked,
                    "total_slashed": a.total_slashed,
                    "workspace_hash": a.boot_audit.get('workspace', {}).get('hash', '')
                }
                for a in self.agents
            ],
            "attestations": [
                {
                    "id": a.attestation_id,
                    "requester": a.requester_id,
                    "claim": a.claim,
                    "consensus": a.consensus,
                    "stake": a.stake_amount,
                    "responses": [
                        {
                            "attestor": r.attestor_id,
                            "verdict": r.verdict,
                            "confidence": r.confidence
                        }
                        for r in a.responses
                    ]
                }
                for a in self.attestations
            ]
        }
        
        return json.dumps(report, indent=2)
    
    def generate_csv_report(self) -> str:
        """Generate CSV report."""
        lines = []
        writer = csv.writer(lines)
        
        # Header
        writer.writerow([
            "Attestation_ID", "Requester", "Claim", "Consensus", 
            "Stake_Amount", "Attestor", "Verdict", "Confidence"
        ])
        
        # Data
        for att in self.attestations:
            for resp in att.responses:
                writer.writerow([
                    att.attestation_id,
                    att.requester_id,
                    att.claim,
                    att.consensus,
                    att.stake_amount,
                    resp.attestor_id,
                    resp.verdict,
                    resp.confidence
                ])
        
        return "\n".join(lines)
    
    def export_reports(self):
        """Export reports to files."""
        if not self.config.export_dir:
            return
        
        export_path = Path(self.config.export_dir)
        export_path.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        
        if self.config.output_format in ("text", "all"):
            text_file = export_path / f"attestation-report-{timestamp}.txt"
            text_file.write_text(self.generate_text_report())
            self.log(f"Text report exported: {text_file}", "success")
        
        if self.config.output_format in ("json", "all"):
            json_file = export_path / f"attestation-report-{timestamp}.json"
            json_file.write_text(self.generate_json_report())
            self.log(f"JSON report exported: {json_file}", "success")
        
        if self.config.output_format in ("csv", "all"):
            csv_file = export_path / f"attestation-report-{timestamp}.csv"
            csv_file.write_text(self.generate_csv_report())
            self.log(f"CSV report exported: {csv_file}", "success")
    
    def run(self):
        """Execute full test."""
        try:
            self.setup_agents()
            
            if len(self.agents) < self.config.consensus_threshold + 1:
                self.log(f"ERROR: Need at least {self.config.consensus_threshold + 1} agents", "error")
                return 1
            
            self.run_attestations()
            
            # Generate output
            if self.config.output_format == "text":
                print(self.generate_text_report())
            elif self.config.output_format == "json":
                print(self.generate_json_report())
            elif self.config.output_format == "csv":
                print(self.generate_csv_report())
            else:  # all
                print(self.generate_text_report())
            
            # Export if requested
            self.export_reports()
            
            self.log("Test complete!", "success")
            return 0
            
        except KeyboardInterrupt:
            self.log("\nTest interrupted by user", "warning")
            return 130
        except Exception as e:
            self.log(f"Test failed: {e}", "error")
            import traceback
            traceback.print_exc()
            return 1

def main():
    parser = argparse.ArgumentParser(
        description="Cross-Attestation Test with Full Controls",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --agents 5 --stake-min 5 --stake-max 50
  %(prog)s --output json --export ./reports
  %(prog)s --stress-test --agents 17 --verbose
        """
    )
    
    parser.add_argument("--agents", type=int, default=3,
                       help="Number of agents to simulate (default: 3)")
    parser.add_argument("--stake-min", type=float, default=10.0,
                       help="Minimum stake amount (default: 10.0)")
    parser.add_argument("--stake-max", type=float, default=25.0,
                       help="Maximum stake amount (default: 25.0)")
    parser.add_argument("--threshold", type=int, default=2,
                       help="Consensus threshold (default: 2)")
    parser.add_argument("--confidence-min", type=float, default=0.80,
                       help="Minimum confidence (default: 0.80)")
    parser.add_argument("--confidence-max", type=float, default=0.95,
                       help="Maximum confidence (default: 0.95)")
    parser.add_argument("--failure-rate", type=float, default=0.10,
                       help="Simulated failure rate 0-1 (default: 0.10)")
    parser.add_argument("--output", choices=["text", "json", "csv", "all"], default="text",
                       help="Output format (default: text)")
    parser.add_argument("--export", type=str, default=None,
                       help="Export directory for reports")
    parser.add_argument("--verbose", action="store_true",
                       help="Show detailed logs")
    parser.add_argument("--stress-test", action="store_true",
                       help="Run stress test with many agents")
    
    args = parser.parse_args()
    
    if args.stress_test:
        args.agents = 17
        args.verbose = True
        print("STRESS TEST MODE: 17 agents, full verbosity")
    
    config = AttestationConfig(
        num_agents=args.agents,
        stake_min=args.stake_min,
        stake_max=args.stake_max,
        consensus_threshold=args.threshold,
        confidence_min=args.confidence_min,
        confidence_max=args.confidence_max,
        failure_rate=args.failure_rate,
        output_format=args.output,
        export_dir=args.export,
        verbose=args.verbose
    )
    
    tester = CrossAttestationTester(config)
    return tester.run()

if __name__ == "__main__":
    sys.exit(main())
