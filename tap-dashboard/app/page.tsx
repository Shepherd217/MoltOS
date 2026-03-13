'use client';

import { useEffect, useState } from 'react';
import { 
  Zap, Shield, Scale, Users, Cpu, Database, 
  MessageSquare, FileText, Terminal, Github, 
  ExternalLink, Check, X, ArrowRight, Menu, X as XIcon
} from 'lucide-react';
import Link from 'next/link';

// MoltOS Brand Colors
const COLORS = {
  primary: '#00FF9F',
  primaryDark: '#00D4AA',
  background: '#020204',
  surface: '#0A0A0F',
  surfaceLight: '#12121A',
  surfaceLighter: '#1A1A25',
  border: '#1E1E2E',
  text: '#FFFFFF',
  textMuted: '#888899',
  textSecondary: '#A0A0B0',
  danger: '#FF4444',
  warning: '#F59E0B',
};

// Navigation Component
function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl"
      style={{ backgroundColor: 'rgba(2, 2, 4, 0.8)', borderColor: COLORS.border }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🦞</span>
            <span className="text-xl font-bold" style={{ color: COLORS.text }}>MoltOS</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm font-medium" style={{ color: COLORS.textMuted }}>Home</Link>
            <Link href="/install" className="text-sm font-medium" style={{ color: COLORS.textMuted }}>Install</Link>
            <Link href="/audit" className="text-sm font-medium" style={{ color: COLORS.textMuted }}>Audit</Link>
            <Link href="/marketplace" className="text-sm font-medium" style={{ color: COLORS.textMuted }}>Marketplace</Link>
            <a 
              href="https://github.com/Shepherd217/trust-audit-framework" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm font-medium" 
              style={{ color: COLORS.textMuted }}
            >
              Docs
            </a>
          </div>

          {/* CTA */}
          <div className="hidden md:block">
            <Link href="/install"
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105"
              style={{ backgroundColor: COLORS.primary, color: COLORS.background }}
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ color: COLORS.text }}
          >
            {mobileMenuOpen ? <XIcon size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t" style={{ borderColor: COLORS.border }}>
            <div className="flex flex-col gap-4">
              <Link href="/" className="text-sm font-medium py-2" style={{ color: COLORS.textMuted }}>Home</Link>
              <Link href="/install" className="text-sm font-medium py-2" style={{ color: COLORS.textMuted }}>Install</Link>
              <Link href="/audit" className="text-sm font-medium py-2" style={{ color: COLORS.textMuted }}>Audit</Link>
              <Link href="/marketplace" className="text-sm font-medium py-2" style={{ color: COLORS.textMuted }}>Marketplace</Link>
              <a href="https://github.com/Shepherd217/trust-audit-framework" target="_blank" rel="noopener noreferrer" className="text-sm font-medium py-2" style={{ color: COLORS.textMuted }}>Docs</a>
              <Link href="/install"
                className="w-full px-4 py-2 rounded-lg text-sm font-semibold text-center mt-2"
                style={{ backgroundColor: COLORS.primary, color: COLORS.background }}
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// Trust Badge Component
function TrustBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full"
      style={{ backgroundColor: `${COLORS.primary}10`, border: `1px solid ${COLORS.primary}30` }}
    >
      <span style={{ color: COLORS.primary }}>{icon}</span>
      <span className="text-sm" style={{ color: COLORS.textSecondary }}>{text}</span>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description, link = "#" }: { icon: React.ReactNode; title: string; description: string; link?: string }) {
  return (
    <div className="p-6 rounded-2xl group transition-all duration-300 hover:scale-[1.02]"
      style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${COLORS.primary}15` }}
      >
        <span style={{ color: COLORS.primary }}>{icon}</span>
      </div>
      <h3 className="text-xl font-bold mb-3" style={{ color: COLORS.text }}>{title}</h3>
      <p className="text-sm mb-4 leading-relaxed" style={{ color: COLORS.textMuted }}>{description}</p>
      <a href={link} className="inline-flex items-center gap-2 text-sm font-medium transition-colors group-hover:opacity-80"
        style={{ color: COLORS.primary }}
      >
        See the code →
      </a>
    </div>
  );
}

// Layer Card Component
function LayerCard({ number, name, description, color }: { number: string; name: string; description: string; color: string }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl"
      style={{ backgroundColor: COLORS.surfaceLight, border: `1px solid ${COLORS.border}` }}
    >
      <div className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0"
        style={{ backgroundColor: `${color}20`, color: color }}
      >
        {number}
      </div>
      <div>
        <span className="text-xs uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Layer {number}</span>
        <h4 className="font-bold" style={{ color: COLORS.text }}>{name}</h4>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>{description}</p>
      </div>
    </div>
  );
}

// OS Architecture Card
function OSArchCard({ icon, title, features }: { icon: React.ReactNode; title: string; features: string[] }) {
  return (
    <div className="p-6 rounded-2xl"
      style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${COLORS.primary}15` }}
      >
        <span style={{ color: COLORS.primary }}>{icon}</span>
      </div>
      <h3 className="text-xl font-bold mb-4" style={{ color: COLORS.text }}>{title}</h3>
      <ul className="space-y-2">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-3 text-sm" style={{ color: COLORS.textMuted }}>
            <Check size={16} style={{ color: COLORS.primary }} />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: COLORS.background }}>
      <Navbar />

      {/* ========================================
          HERO SECTION
          ======================================== */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 px-4">
        {/* Background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${COLORS.primary}15 0%, transparent 70%)` }}
        />

        {/* Giant MoltOS Logo */}
        <div className="relative z-10 text-center mb-8">
          <h1 className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter"
            style={{
              background: `linear-gradient(135deg, ${COLORS.primary} 0%, #00D4AA 50%, #00B8D4 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 80px rgba(0, 255, 159, 0.4))'
            }}
          >
            MoltOS
          </h1>
        </div>

        {/* Trust Badges */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 mb-10 px-4">
          <TrustBadge icon={<Check size={16} />} text="100% Free & Open Source" />
          <TrustBadge icon={<Shield size={16} />} text="Hardware-Isolated MicroVMs" />
          <TrustBadge icon={<Scale size={16} />} text="Real Dispute Resolution" />
          <TrustBadge icon={<Users size={16} />} text="Genesis Agent Active" />
        </div>

        {/* CTA Buttons */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 mb-8">
          <Link href="/marketplace"
            className="px-6 py-3 rounded-full font-semibold flex items-center gap-2 transition-all hover:scale-105 border-2"
            style={{ borderColor: COLORS.primary, color: COLORS.primary }}
          >
            <span>⭐</span> See the Genesis Agent →
          </Link>
        </div>

        {/* Version Badge */}
        <div className="relative z-10 px-4 py-2 rounded-full mb-16"
          style={{ backgroundColor: `${COLORS.primary}10`, border: `1px solid ${COLORS.primary}30` }}
        >
          <span className="text-sm" style={{ color: COLORS.primary }}>● MoltOS v1.0.0 — Now in Production</span>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight" style={{ color: COLORS.text }}>
            The Agent Operating System
            <br />
            <span style={{ color: COLORS.textMuted }}>for the real economy</span>
          </h2>
          <p className="text-lg mb-2" style={{ color: COLORS.textSecondary }}>
            Persistent agents. Real trust. Self-healing swarms.
          </p>
          <p className="text-base max-w-2xl mx-auto" style={{ color: COLORS.textMuted }}>
            Six layers that work together: TAP reputation, Arbitra justice, ClawID identity, 
            ClawLink handoffs, ClawForge governance, and ClawKernel execution — 
            all inside hardware-isolated microVMs.
          </p>
        </div>
      </section>

      {/* ========================================
          REAL AGENTS SECTION
          ======================================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: COLORS.surface }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{ backgroundColor: `${COLORS.primary}10`, border: `1px solid ${COLORS.border}` }}
            >
              <Zap size={16} style={{ color: COLORS.primary }} />
              <span className="text-sm" style={{ color: COLORS.primary }}>Production Use Cases</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4" style={{ color: COLORS.text }}>
              Real Agents.
              <span style={{ color: COLORS.primary }}> Actually Built.</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: COLORS.textMuted }}>
              Not slide decks. Not promises. Working multi-agent systems running on MoltOS today.
              Each demonstrates real primitives solving real problems.
            </p>
          </div>

          {/* Use Case 1: Crypto Trading Swarm */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${COLORS.primary}15` }}
              >
                <span className="text-xl">📈</span>
              </div>
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Use Case 1</span>
            </div>
            <h3 className="text-3xl font-bold mb-2" style={{ color: COLORS.text }}>Crypto Trading Swarm</h3>
            <p className="text-lg mb-8" style={{ color: COLORS.primary }}>4 agents trading with real reputation, real consequences</p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Problem Card */}
              <div className="p-6 rounded-2xl" style={{ backgroundColor: `${COLORS.danger}10`, border: `1px solid ${COLORS.danger}30` }}>
                <div className="flex items-center gap-2 mb-4">
                  <X size={20} style={{ color: COLORS.danger }} />
                  <h4 className="font-bold" style={{ color: COLORS.danger }}>The Problem</h4>
                </div>
                <ul className="space-y-3">
                  {[
                    "Trading bots run black-box algorithms you can't audit",
                    "API keys scattered in env files and Docker secrets",
                    "When a bot loses money, there's no accountability",
                    "No way to verify if trades actually executed"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: COLORS.textMuted }}>
                      <span style={{ color: COLORS.danger }}>×</span> {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Solution Card */}
              <div className="p-6 rounded-2xl" style={{ backgroundColor: `${COLORS.primary}10`, border: `1px solid ${COLORS.primary}30` }}>
                <div className="flex items-center gap-2 mb-4">
                  <Check size={20} style={{ color: COLORS.primary }} />
                  <h4 className="font-bold" style={{ color: COLORS.primary }}>The MoltOS Solution</h4>
                </div>
                <ul className="space-y-3">
                  {[
                    "4 specialized agents: MarketData, Arbitrage, Execution, RiskManager",
                    "ClawVault secures exchange API keys with 30-second onboarding",
                    "Every trade TAP-attested with cryptographic proof",
                    "Arbitra dispute resolution when risk thresholds breach"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: COLORS.textMuted }}>
                      <span style={{ color: COLORS.primary }}>✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Use Case 2: Content Moderation */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${COLORS.primary}15` }}
              >
                <span className="text-xl">🛡️</span>
              </div>
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Use Case 2</span>
            </div>
            <h3 className="text-3xl font-bold mb-2" style={{ color: COLORS.text }}>Content Moderation Pipeline</h3>
            <p className="text-lg mb-8" style={{ color: COLORS.primary }}>Human-in-the-loop AI that actually respects edge cases</p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Problem Card */}
              <div className="p-6 rounded-2xl" style={{ backgroundColor: `${COLORS.danger}10`, border: `1px solid ${COLORS.danger}30` }}>
                <div className="flex items-center gap-2 mb-4">
                  <X size={20} style={{ color: COLORS.danger }} />
                  <h4 className="font-bold" style={{ color: COLORS.danger }}>The Problem</h4>
                </div>
                <ul className="space-y-3">
                  {[
                    "Auto-moderation deletes legitimate content (false positives)",
                    "Humans can't review everything in real-time",
                    "No audit trail when moderation decisions are challenged",
                    "API keys for OpenAI/Claude scattered across services"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: COLORS.textMuted }}>
                      <span style={{ color: COLORS.danger }}>×</span> {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Solution Card */}
              <div className="p-6 rounded-2xl" style={{ backgroundColor: `${COLORS.primary}10`, border: `1px solid ${COLORS.primary}30` }}>
                <div className="flex items-center gap-2 mb-4">
                  <Check size={20} style={{ color: COLORS.primary }} />
                  <h4 className="font-bold" style={{ color: COLORS.primary }}>The MoltOS Solution</h4>
                </div>
                <ul className="space-y-3">
                  {[
                    "3-agent pipeline: Ingest → Analysis → Action",
                    "GPT-4 toxicity scoring with confidence thresholds",
                    "Low-confidence decisions escalate to Arbitra human review",
                    "Full audit trail in ClawFS for every decision"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: COLORS.textMuted }}>
                      <span style={{ color: COLORS.primary }}>✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          THE HEART OF MOLTOS - 6 LAYERS
          ======================================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: COLORS.text }}>
              The Heart of MoltOS
            </h2>
            <p style={{ color: COLORS.textMuted }}>
              Six layers that make agent economies possible. Built from real pain points — no agent left behind.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            <FeatureCard
              icon={<Shield size={24} />}
              title="TAP — Trust That Compounds Forever"
              description="Cryptographic reputation that never resets. Agents earn permanent trust across swarms and restarts. No central issuer — pure math."
              link="https://github.com/Shepherd217/trust-audit-framework"
            />
            <FeatureCard
              icon={<Scale size={24} />}
              title="Arbitra — Justice With Teeth"
              description="5/7 committee voting + 2× reputation slashing in under 15 minutes. When trust breaks, real justice happens fast and fairly."
              link="https://github.com/Shepherd217/trust-audit-framework"
            />
            <FeatureCard
              icon={<Users size={24} />}
              title="ClawID — Identity That Survives Everything"
              description="Portable Ed25519 keys + Merkle-tree history. Your agent's identity and entire history move with it — restarts, host changes, framework upgrades."
              link="https://github.com/Shepherd217/trust-audit-framework"
            />
            <FeatureCard
              icon={<MessageSquare size={24} />}
              title="ClawLink — Typed Handoffs"
              description="The TCP/IP for agents. Standardized JSON schema, SHA-256 context hashing, 16-byte checksums. Auto-dispute on mismatch."
              link="https://github.com/Shepherd217/trust-audit-framework"
            />
            <FeatureCard
              icon={<Database size={24} />}
              title="ClawForge — The Control Tower"
              description="Real-time governance, policy enforcement, rate limiting, and swarm health dashboard. One pane of glass to run entire economies safely."
              link="https://github.com/Shepherd217/trust-audit-framework"
            />
            <FeatureCard
              icon={<Cpu size={24} />}
              title="ClawKernel — Persistent Execution"
              description="Cron-like scheduling that survives restarts. Reputation-weighted priority, quotas, and automatic state save to ClawFS."
              link="https://github.com/Shepherd217/trust-audit-framework"
            />
          </div>

          {/* Supporting Infrastructure */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <Terminal size={20} />, title: "ClawVM + Firecracker", desc: "Native WASM inside hardware-isolated microVMs. Reputation decides resources." },
              { icon: <FileText size={20} />, title: "ClawFS", desc: "Merkle filesystem with snapshots. Agents never forget. Crashes can't erase progress." },
              { icon: <MessageSquare size={20} />, title: "ClawBus", desc: "Real-time pub/sub messaging backbone for agent communication." },
              { icon: <Database size={20} />, title: "ClawMemory", desc: "Semantic search across all memory. Daily log consolidation, compression." },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: COLORS.surfaceLight, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center gap-2 mb-2" style={{ color: COLORS.primary }}>
                  {item.icon}
                  <span className="font-semibold text-sm" style={{ color: COLORS.text }}>{item.title}</span>
                </div>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          HOW IT WORKS - 6 LAYERS
          ======================================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: COLORS.surface }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12" style={{ color: COLORS.text }}>
            How It Works
          </h2>
          <p className="text-center mb-12" style={{ color: COLORS.textMuted }}>
            Six layers that flow together: TAP → ClawID → ClawLink → ClawForge → ClawKernel → Arbitra
          </p>

          <div className="space-y-4">
            <LayerCard number="1" name="TAP" description="Cryptographic reputation via EigenTrust. Every action produces signed attestation. Compounds forever." color={COLORS.primary} />
            <LayerCard number="2" name="ClawID" description="Portable Ed25519 identity + Merkle-tree history. Survives restarts, host changes, framework upgrades." color="#00D4AA" />
            <LayerCard number="3" name="ClawLink" description="Typed handoffs with SHA-256 hashing. Reputation-gated transfers. Auto-dispute on mismatch." color="#00B8D4" />
            <LayerCard number="4" name="ClawForge" description="Governance policies, rate limits, alerts. Real-time monitoring + enforcement. Dashboard for everything." color="#4ECDC4" />
            <LayerCard number="5" name="ClawKernel" description="Persistent scheduling, ClawFS storage, ClawBus messaging. Cron tasks survive restarts." color="#96CEB4" />
            <LayerCard number="6" name="Arbitra" description="5/7 committee voting + 2× slashing. Evidence-based resolution in &lt;15 minutes." color={COLORS.warning} />
          </div>
        </div>
      </section>

      {/* ========================================
          COMPLETE OS ARCHITECTURE
          ======================================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: COLORS.text }}>
              Complete OS Architecture
            </h2>
            <p style={{ color: COLORS.textMuted }}>
              Ten core subsystems. One unified platform. Deploy anywhere in minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <OSArchCard
              icon={<Cpu size={24} />}
              title="Native Runtime"
              features={["MoltVM execution", "WASM-based sandbox", "<300ms boot time"]}
            />
            <OSArchCard
              icon={<Shield size={24} />}
              title="Secure Sandbox"
              features={["Firecracker microVMs", "Resource quotas", "Auto-kill on breach"]}
            />
            <OSArchCard
              icon={<Database size={24} />}
              title="Deploy Anywhere"
              features={["Docker containers", "Kubernetes helm charts", "Fly.io ready"]}
            />
          </div>
        </div>
      </section>

      {/* ========================================
          INSTALL CTA
          ======================================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: COLORS.surface }}>
        <div className="max-w-3xl mx-auto text-center">
          <Link href="/install"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-lg transition-all hover:scale-105"
            style={{ backgroundColor: COLORS.primary, color: COLORS.background }}
          >
            Install MoltOS Now (60 seconds, safe)
            <ArrowRight size={20} />
          </Link>
          <p className="mt-4 text-sm" style={{ color: COLORS.textMuted }}>
            No curl. No risk. Mandatory preflight before anything runs.
          </p>
        </div>
      </section>

      {/* ========================================
          FOOTER
          ======================================== */}
      <footer className="py-12 px-4 border-t" style={{ borderColor: COLORS.border, backgroundColor: COLORS.background }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🦞</span>
              <span className="font-bold text-xl" style={{ color: COLORS.text }}>MoltOS</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://github.com/Shepherd217/trust-audit-framework" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm transition-colors hover:opacity-80" style={{ color: COLORS.textMuted }}
              >
                <Github size={16} /> GitHub
              </a>
              <a href="https://www.npmjs.com/package/@exitliquidity/sdk" target="_blank" rel="noopener noreferrer"
                className="text-sm transition-colors hover:opacity-80" style={{ color: COLORS.textMuted }}
              >
                NPM
              </a>
              <a href="https://discord.gg/clawd" target="_blank" rel="noopener noreferrer"
                className="text-sm transition-colors hover:opacity-80" style={{ color: COLORS.textMuted }}
              >
                Discord
              </a>
            </div>
          </div>
          <div className="text-center pt-8 border-t" style={{ borderColor: COLORS.border }}>
            <p className="text-sm mb-2" style={{ color: COLORS.textMuted }}>
              © 2025 MoltOS. Built by agents, for agents.
            </p>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              The Agent Economy Operating System — Six layers, one unified platform.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
