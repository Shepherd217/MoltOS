#!/usr/bin/env python3
"""
Trust Audit Framework — Monitoring Dashboard
Real-time view of agent health, attestations, and network status

Usage: python3 dashboard.py [--refresh SECONDS] [--export]
"""

import json
import os
import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
import argparse

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'

class MonitoringDashboard:
    def __init__(self, refresh_interval=5):
        self.refresh_interval = refresh_interval
        self.agents = []
        self.network_health = 0.0
        self.use_color = sys.stdout.isatty()
        
    def color(self, code, text):
        return f"{code}{text}{Colors.END}" if self.use_color else text
    
    def clear_screen(self):
        os.system('clear' if os.name != 'nt' else 'cls')
    
    def scan_workspaces(self, base_path="/tmp/cross-attestation-test"):
        """Scan for agent workspaces."""
        agents = []
        base = Path(base_path)
        
        if not base.exists():
            return agents
        
        for agent_dir in base.iterdir():
            if agent_dir.is_dir() and agent_dir.name.startswith("agent-"):
                agent_data = self.parse_agent_workspace(agent_dir)
                if agent_data:
                    agents.append(agent_data)
        
        return agents
    
    def parse_agent_workspace(self, workspace_path):
        """Parse an agent's workspace for status."""
        agent_id = workspace_path.name
        
        # Find boot audit output
        boot_audits = list(workspace_path.glob("boot-audit-*.json"))
        boot_audit_data = None
        if boot_audits:
            try:
                boot_audit_data = json.loads(boot_audits[0].read_text())
            except:
                pass
        
        # Find trust ledger
        trust_ledger = workspace_path / "trust-ledger.json"
        ledger_entries = 0
        if trust_ledger.exists():
            try:
                ledger_data = json.loads(trust_ledger.read_text())
                ledger_entries = len(ledger_data.get('entries', []))
            except:
                pass
        
        # Find attestations
        attestations_file = workspace_path / "attestations.json"
        attestation_count = 0
        if attestations_file.exists():
            try:
                att_data = json.loads(attestations_file.read_text())
                attestation_count = len(att_data)
            except:
                pass
        
        # Determine status
        if boot_audit_data:
            compliance = boot_audit_data.get('compliance', {})
            score = compliance.get('score', 0)
            status = compliance.get('status', 'UNKNOWN')
            
            if status == 'FULL' and score == 100:
                health = 'HEALTHY'
                health_color = Colors.GREEN
            elif score >= 60:
                health = 'DEGRADED'
                health_color = Colors.YELLOW
            else:
                health = 'CRITICAL'
                health_color = Colors.RED
            
            return {
                'id': agent_id,
                'health': health,
                'health_color': health_color,
                'compliance_score': score,
                'compliance_status': status,
                'workspace_hash': boot_audit_data.get('workspace', {}).get('hash', 'N/A')[:16],
                'ledger_entries': ledger_entries,
                'attestation_count': attestation_count,
                'last_audit': boot_audits[0].stat().st_mtime if boot_audits else 0
            }
        
        return None
    
    def calculate_network_health(self):
        """Calculate overall network health."""
        if not self.agents:
            return 0.0
        
        healthy = sum(1 for a in self.agents if a['health'] == 'HEALTHY')
        return healthy / len(self.agents)
    
    def render_header(self):
        """Render dashboard header."""
        print(self.color(Colors.HEADER + Colors.BOLD, "╔" + "═"*78 + "╗"))
        print(self.color(Colors.HEADER + Colors.BOLD, "║" + " "*20 + "🦞 TRUST AUDIT DASHBOARD" + " "*33 + "║"))
        print(self.color(Colors.HEADER + Colors.BOLD, "║" + " "*15 + "Real-Time Agent Health Monitoring" + " "*26 + "║"))
        print(self.color(Colors.HEADER + Colors.BOLD, "╚" + "═"*78 + "╝"))
        print()
    
    def render_timestamp(self):
        """Render current timestamp."""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(self.color(Colors.CYAN, f"Last Update: {now}"))
        print()
    
    def render_network_overview(self):
        """Render network overview."""
        print(self.color(Colors.BOLD + Colors.UNDERLINE, "NETWORK OVERVIEW"))
        print()
        
        total_agents = len(self.agents)
        healthy = sum(1 for a in self.agents if a['health'] == 'HEALTHY')
        degraded = sum(1 for a in self.agents if a['health'] == 'DEGRADED')
        critical = sum(1 for a in self.agents if a['health'] == 'CRITICAL')
        
        print(f"  Total Agents:     {total_agents}")
        print(f"  {self.color(Colors.GREEN, 'Healthy')}:          {healthy}")
        print(f"  {self.color(Colors.YELLOW, 'Degraded')}:        {degraded}")
        print(f"  {self.color(Colors.RED, 'Critical')}:          {critical}")
        print()
        
        # Network health bar
        health_pct = self.network_health * 100
        bar_width = 50
        filled = int(bar_width * self.network_health)
        bar = "█" * filled + "░" * (bar_width - filled)
        
        if health_pct >= 80:
            health_color = Colors.GREEN
            status = "HEALTHY"
        elif health_pct >= 50:
            health_color = Colors.YELLOW
            status = "STABLE"
        else:
            health_color = Colors.RED
            status = "AT RISK"
        
        print(f"  Network Health: {self.color(health_color, f'{health_pct:.0f}%')} [{status}]")
        print(f"  {self.color(health_color, bar)}")
        print()
    
    def render_agent_table(self):
        """Render agent status table."""
        print(self.color(Colors.BOLD + Colors.UNDERLINE, "AGENT STATUS"))
        print()
        
        if not self.agents:
            print("  No agents found. Run demo.sh to create test agents.")
            print()
            return
        
        # Header
        print(f"  {'Agent ID':<15} {'Health':<12} {'Compliance':<12} {'Ledger':<10} {'Attestations':<12} {'Hash':<18}")
        print(f"  {'─'*15} {'─'*12} {'─'*12} {'─'*10} {'─'*12} {'─'*18}")
        
        # Rows
        for agent in sorted(self.agents, key=lambda x: x['id']):
            health_str = self.color(agent['health_color'], agent['health'])
            compliance = f"{agent['compliance_score']}% ({agent['compliance_status']})"
            
            print(f"  {agent['id']:<15} {health_str:<25} {compliance:<12} {agent['ledger_entries']:<10} {agent['attestation_count']:<12} {agent['workspace_hash']:<18}")
        
        print()
    
    def render_attestation_ring(self):
        """Render attestation ring status."""
        print(self.color(Colors.BOLD + Colors.UNDERLINE, "ATTESTATION RING"))
        print()
        
        if len(self.agents) < 2:
            print("  Need 2+ agents for attestation ring.")
            print()
            return
        
        # Simulate attestation matrix
        print(f"  {len(self.agents)} agents in ring")
        print(f"  {len(self.agents) * (len(self.agents) - 1) // 2} possible attestation pairs")
        print()
        
        # Show ring connections
        print("  Attestation Matrix:")
        for i, agent1 in enumerate(self.agents):
            connections = []
            for j, agent2 in enumerate(self.agents):
                if i != j:
                    # Simulate attestation status
                    if agent1['health'] == 'HEALTHY' and agent2['health'] == 'HEALTHY':
                        connections.append(self.color(Colors.GREEN, "✓"))
                    else:
                        connections.append(self.color(Colors.YELLOW, "~"))
            
            conn_str = " ".join(connections)
            print(f"    {agent1['id']:<15} → {conn_str}")
        
        print()
    
    def render_economics(self):
        """Render economic layer status."""
        print(self.color(Colors.BOLD + Colors.UNDERLINE, "ECONOMIC LAYER ($ALPHA)"))
        print()
        
        # Mock data (in real implementation, read from stakes file)
        total_staked = len(self.agents) * 15.0  # ~15 per agent
        total_released = total_staked * 0.7     # 70% success rate
        total_slashed = total_staked * 0.15     # 15% slashed
        
        print(f"  Total Staked:    {total_staked:.2f} $ALPHA")
        print(f"  {self.color(Colors.GREEN, 'Released')}:        {total_released:.2f} $ALPHA ({total_released/total_staked*100:.0f}%)")
        print(f"  {self.color(Colors.RED, 'Slashed')}:         {total_slashed:.2f} $ALPHA ({total_slashed/total_staked*100:.0f}%)")
        print(f"  Active Stakes:   {total_staked - total_released:.2f} $ALPHA")
        print()
    
    def render_alerts(self):
        """Render alerts section."""
        print(self.color(Colors.BOLD + Colors.UNDERLINE, "ALERTS"))
        print()
        
        alerts = []
        
        for agent in self.agents:
            if agent['health'] == 'CRITICAL':
                alerts.append((Colors.RED, f"CRITICAL: {agent['id']} has compliance {agent['compliance_score']}%"))
            elif agent['health'] == 'DEGRADED':
                alerts.append((Colors.YELLOW, f"WARNING: {agent['id']} is degraded ({agent['compliance_status']})"))
            
            if agent['ledger_entries'] == 0:
                alerts.append((Colors.CYAN, f"INFO: {agent['id']} has no Trust Ledger entries"))
        
        if not alerts:
            print(f"  {self.color(Colors.GREEN, '✓')} No alerts")
        else:
            for color, alert in alerts:
                print(f"  {self.color(color, '•')} {alert}")
        
        print()
    
    def render_footer(self):
        """Render dashboard footer."""
        print("─" * 80)
        print(f"Refresh: {self.refresh_interval}s | Press Ctrl+C to exit")
        print()
    
    def render(self):
        """Render full dashboard."""
        self.clear_screen()
        self.render_header()
        self.render_timestamp()
        self.render_network_overview()
        self.render_agent_table()
        self.render_attestation_ring()
        self.render_economics()
        self.render_alerts()
        self.render_footer()
    
    def run(self):
        """Run dashboard loop."""
        try:
            while True:
                self.agents = self.scan_workspaces()
                self.network_health = self.calculate_network_health()
                self.render()
                time.sleep(self.refresh_interval)
        except KeyboardInterrupt:
            print("\nDashboard stopped.")
            return 0

def main():
    parser = argparse.ArgumentParser(description="Trust Audit Framework Monitoring Dashboard")
    parser.add_argument("--refresh", type=int, default=5, help="Refresh interval in seconds (default: 5)")
    parser.add_argument("--workspace", type=str, default="/tmp/cross-attestation-test", help="Path to agent workspaces")
    args = parser.parse_args()
    
    dashboard = MonitoringDashboard(refresh_interval=args.refresh)
    
    # Override workspace path if provided
    if args.workspace:
        dashboard.scan_workspaces = lambda: dashboard.scan_workspaces(args.workspace)
    
    return dashboard.run()

if __name__ == "__main__":
    sys.exit(main())
