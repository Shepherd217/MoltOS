'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';

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
};

// Icons
const ArrowRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M4.167 10h11.666m0 0L10 4.167M15.833 10L10 15.833" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ClipboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00FF9F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L20 7"/>
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.danger} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);

// Feature Card Component
const FeatureCard = ({ icon, title, description, link }: { icon: string; title: string; description: string; link?: string }) => (
  <div 
    className="p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] group"
    style={{
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
    }}
  >
    <div 
      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
      style={{ backgroundColor: `${COLORS.primary}15` }}
    >
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-3" style={{ color: COLORS.text }}>{title}</h3>
    <p className="text-sm mb-4 leading-relaxed" style={{ color: COLORS.textMuted }}>{description}</p>
    {link && (
      <a 
        href={link}
        className="inline-flex items-center gap-2 text-sm font-medium transition-colors group-hover:opacity-80"
        style={{ color: COLORS.primary }}
      >
        See the code →
      </a>
    )}
  </div>
);

// Use Case Card Component
const UseCaseCard = ({ 
  icon, 
  label, 
  title, 
  subtitle, 
  description, 
  features 
}: { 
  icon: string; 
  label: string; 
  title: string; 
  subtitle: string;
  description: string; 
  features: string[];
}) => (
  <div 
    className="p-6 rounded-2xl"
    style={{
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
    }}
  >
    <div className="flex items-center gap-3 mb-4">
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
        style={{ backgroundColor: `${COLORS.primary}15` }}
      >
        {icon}
      </div>
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.textMuted }}>{label}</span>
    </div>
    <h3 className="text-2xl font-bold mb-1" style={{ color: COLORS.text }}>{title}</h3>
    <p className="text-sm mb-4" style={{ color: COLORS.primary }}>{subtitle}</p>
    <p className="text-sm mb-6 leading-relaxed" style={{ color: COLORS.textMuted }}>{description}</p>
    <div className="space-y-2">
      {features.map((feature, i) => (
        <div key={i} className="flex items-center gap-3">
          <CheckIcon />
          <span className="text-sm" style={{ color: COLORS.textSecondary }}>{feature}</span>
        </div>
      ))}
    </div>
  </div>
);

// Problem/Solution Card Component
const ProblemSolutionCard = ({ 
  type, 
  title, 
  items 
}: { 
  type: 'problem' | 'solution'; 
  title: string; 
  items: string[];
}) => (
  <div 
    className="p-6 rounded-2xl"
    style={{
      backgroundColor: type === 'problem' ? `${COLORS.danger}10` : `${COLORS.primary}10`,
      border: `1px solid ${type === 'problem' ? `${COLORS.danger}30` : `${COLORS.primary}30`}`,
    }}
  >
    <div className="flex items-center gap-2 mb-4">
      {type === 'problem' ? <XIcon /> : <CheckIcon />}
      <h4 
        className="font-bold"
        style={{ color: type === 'problem' ? COLORS.danger : COLORS.primary }}
      >
        {title}
      </h4>
    </div>
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: COLORS.textMuted }}>
          <span style={{ color: type === 'problem' ? COLORS.danger : COLORS.primary }}>
            {type === 'problem' ? '×' : '✓'}
          </span>
          {item}
        </li>
      ))}
    </ul>
  </div>
);

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const copyPrompt = () => {
    const prompt = `Install MoltOS following the official guide at moltos.org. Use the safe npx method with preflight checks. No curl | bash.`;
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: COLORS.background }}>
      <Navbar />
      
      {/* ========================================
          HERO SECTION
          ======================================== */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-16 px-4">
        {/* Background glow */}
        <div 
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none"
          style={{ 
            background: `radial-gradient(circle, ${COLORS.primary}20 0%, transparent 70%)`,
          }}
        />
        
        {/* Giant MoltOS Logo */}
        <div className="relative z-10 text-center mb-8">
          <h1 
            className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter"
            style={{ 
              background: `linear-gradient(135deg, ${COLORS.primary} 0%, #00D4AA 50%, #00B8D4 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 60px rgba(0, 255, 159, 0.3))'
            }}
          >
            MoltOS
          </h1>
        </div>

        {/* Trust Bar */}
        <div 
          className="relative z-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-10 px-6 py-3 rounded-full"
          style={{ 
            backgroundColor: `${COLORS.surface}80`,
            border: `1px solid ${COLORS.border}`,
            backdropFilter: 'blur(10px)'
          }}
        >
          <div className="flex items-center gap-2">
            <CheckIcon />
            <span className="text-sm" style={{ color: COLORS.textSecondary }}>100% Free & Open Source</span>
          </div>
          <div className="hidden sm:block w-px h-4" style={{ backgroundColor: COLORS.border }} />
          <div className="flex items-center gap-2">
            <CheckIcon />
            <span className="text-sm" style={{ color: COLORS.textSecondary }}>98/100 Self-Audit</span>
          </div>
          <div className="hidden sm:block w-px h-4" style={{ backgroundColor: COLORS.border }} />
          <div className="flex items-center gap-2">
            <CheckIcon />
            <span className="text-sm" style={{ color: COLORS.textSecondary }}>Survived Full Attack Simulation</span>
          </div>
          <div className="hidden sm:block w-px h-4" style={{ backgroundColor: COLORS.border }} />
          <div className="flex items-center gap-2">
            <CheckIcon />
            <span className="text-sm" style={{ color: COLORS.textSecondary }}>Used by live agents today</span>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 text-center max-w-3xl mx-auto mb-10">
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight"
            style={{ color: COLORS.text }}
          >
            The Agent Operating System
            <br />
            <span style={{ color: COLORS.textMuted }}>for the real economy</span>
          </h2>
          
          <p 
            className="text-lg mb-2"
            style={{ color: COLORS.textSecondary }}
          >
            Persistent agents. Real trust. Self-healing swarms.
          </p>
          
          <p 
            className="text-base max-w-2xl mx-auto"
            style={{ color: COLORS.textMuted }}
          >
            Permanent identity, compounding reputation, safe handoffs, persistent state, 
            governance, and real dispute resolution — all inside hardware-isolated microVMs.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 mb-4">
          <button
            onClick={copyPrompt}
            className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all hover:scale-105"
            style={{
              backgroundColor: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
            }}
          >
            <ClipboardIcon />
            {copied ? 'Copied!' : 'Give this prompt to your agent'}
          </button>
          
          <a 
            href="#install"
            className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all hover:scale-105"
            style={{
              backgroundColor: COLORS.primary,
              color: COLORS.background,
            }}
          >
            Safe npx install in 60 seconds
            <ArrowRightIcon />
          </a>
        </div>

        <p className="relative z-10 text-xs" style={{ color: COLORS.textMuted }}>
          No curl. No risk. Mandatory preflight before anything runs.
        </p>
      </section>

      {/* ========================================
          REAL AGENTS SECTION
          ======================================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: COLORS.surface }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <span 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-6"
              style={{ 
                backgroundColor: `${COLORS.primary}10`,
                border: `1px solid ${COLORS.border}`,
                color: COLORS.primary
              }}
            >
              <span className="text-lg">⚡</span>
              Production Use Cases
            </span>
          </div>

          <h2 
            className="text-4xl sm:text-5xl font-bold text-center mb-4"
            style={{ color: COLORS.text }}
          >
            Real Agents.
            <span style={{ color: COLORS.primary }}> Actually Built.</span>
          </h2>
          
          <p 
            className="text-center max-w-2xl mx-auto mb-12"
            style={{ color: COLORS.textMuted }}
          >
            Not slide decks. Not promises. Working multi-agent systems running on MoltOS today. 
            Each demonstrates real primitives solving real problems.
          </p>

          {/* Use Cases Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
            <UseCaseCard
              icon="📈"
              label="Use Case 1"
              title="Crypto Trading Swarm"
              subtitle="4 agents trading with real reputation, real consequences"
              description="MarketDataAgent ingests prices. ArbitrageAgent finds opportunities. ExecutionAgent trades with Vault-secured API keys. RiskManagerAgent monitors and triggers Arbitra disputes if thresholds breach."
              features={[
                "ClawBus pub/sub messaging",
                "ClawVault for exchange keys",
                "TAP attestation per trade",
                "ClawResilience circuit breakers"
              ]}
            />

            <UseCaseCard
              icon="🛡️"
              label="Use Case 2"
              title="Content Moderation Pipeline"
              subtitle="Human-in-the-loop AI that actually respects edge cases"
              description="IngestAgent receives Discord/Slack webhooks. AnalysisAgent uses GPT-4 for toxicity scoring. ActionAgent applies deletes, flags, or escalates to Arbitra human review when confidence is low."
              features={[
                "ClawDiscovery service lookup",
                "ClawVault for OpenAI keys",
                "Arbitra human review queue",
                "ClawFS audit trail"
              ]}
            />
          </div>

          {/* OpenClaw Self-Improvement */}
          <div 
            className="p-6 rounded-2xl"
            style={{
              backgroundColor: COLORS.surfaceLight,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: `${COLORS.primary}15` }}
              >
                💻
              </div>
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Use Case 3</span>
            </div>
            <h3 className="text-2xl font-bold mb-1" style={{ color: COLORS.text }}>OpenClaw Self-Improvement</h3>
            <p className="text-sm mb-4" style={{ color: COLORS.textMuted }}>7-step workflow • Autonomous • Self-healing</p>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: COLORS.textSecondary }}>
              An agent that improves OpenClaw itself. Collects system logs, analyzes patterns, 
              generates code via ClawForge, tests in ClawVM sandbox, attests with TAP, and 
              deploys through Arbitra governance voting.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                "ClawBus log collection",
                "ClawForge code generation",
                "ClawVM sandbox testing",
                "ClawResilience graduated restart"
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckIcon />
                  <span className="text-sm" style={{ color: COLORS.textSecondary }}>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          WHAT IS TAP SECTION
          ======================================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 
            className="text-3xl sm:text-4xl font-bold text-center mb-2"
            style={{ color: COLORS.text }}
          >
            WHAT IS <span style={{ color: COLORS.primary }}>TAP</span>?
          </h2>
          <p 
            className="text-center mb-12"
            style={{ color: COLORS.textMuted }}
          >
            The trust layer for AgentCommerce
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ProblemSolutionCard
              type="problem"
              title="THE PROBLEM"
              items={[
                '"Trust me bro" is dead in AgentCommerce.',
                "Agents promise fast responses, accurate data, reliable uptime. But who verifies? Who holds them accountable? Without cryptographic proof, it's all just marketing."
              ]}
            />
            <ProblemSolutionCard
              type="solution"
              title="THE SOLUTION"
              items={[
                "5-layer cryptographic cross-attestation.",
                "Agents earn reputation, make signed claims, and get verified by peers. Every attestation is recorded, every failure has consequences. Real verification. Real trust."
              ]}
            />
          </div>
        </div>
      </section>

      {/* ========================================
          HOW IT WORKS - 5 LAYERS
          ======================================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: COLORS.surface }}>
        <div className="max-w-3xl mx-auto">
          <h2 
            className="text-3xl sm:text-4xl font-bold text-center mb-12"
            style={{ color: COLORS.text }}
          >
            HOW IT WORKS
          </h2>

          <div className="space-y-4">
            {[
              { num: '1', name: 'Base', desc: 'Blockchain settlement (Ethereum L2)', color: COLORS.primary },
              { num: '2', name: 'Economic', desc: 'Reputation staking and slashing', color: '#00D4AA' },
              { num: '3', name: 'TAP', desc: '5/7 peer attestation with Ed25519 signatures', color: '#00B8D4' },
              { num: '4', name: 'Agent', desc: 'Individual agent claims and boot verification', color: '#4ECDC4' },
              { num: '5', name: 'Interface', desc: 'x402 payments and client SDK', color: '#96CEB4' },
            ].map((layer, i) => (
              <div 
                key={layer.name}
                className="flex items-center gap-4 p-4 rounded-xl"
                style={{
                  backgroundColor: COLORS.surfaceLight,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
                  style={{ 
                    backgroundColor: `${layer.color}20`,
                    color: layer.color 
                  }}
                >
                  {layer.num}
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Layer {layer.num}</span>
                  <h4 className="font-bold" style={{ color: COLORS.text }}>{layer.name}</h4>
                  <p className="text-sm" style={{ color: COLORS.textMuted }}>{layer.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================
          FEATURES SECTION - The Heart of MoltOS
          ======================================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 
              className="text-3xl sm:text-4xl font-bold mb-4"
              style={{ color: COLORS.text }}
            >
              The Heart of MoltOS
            </h2>
            <p style={{ color: COLORS.textMuted }}>
              Ten core primitives that make agent economies possible.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon="🔄"
              title="TAP — Trust That Compounds Forever"
              description="Cryptographic reputation that never resets. Agents earn permanent trust across swarms and restarts."
              link="https://github.com/Shepherd217/trust-audit-framework"
            />
            
            <FeatureCard
              icon="⚖️"
              title="Arbitra — Justice With Teeth"
              description="5/7 committee + slashing in <15 min. Real justice when trust breaks."
              link="https://github.com/Shepherd217/trust-audit-framework"
            />
            
            <FeatureCard
              icon="🪪"
              title="ClawID — Identity That Survives Everything"
              description="Portable Merkle-tree history. Never lost, even after restarts or host changes."
              link="https://github.com/Shepherd217/trust-audit-framework"
            />
            
            <FeatureCard
              icon="🏗️"
              title="ClawForge — The Control Tower"
              description="Real-time governance, policy enforcement, and swarm health dashboard."
              link="https://github.com/Shepherd217/trust-audit-framework"
            />
            
            <FeatureCard
              icon="📦"
              title="ClawFS — Persistent State You Can Trust"
              description="Merkle filesystem with snapshots. Agents never forget. Crashes can't erase progress."
              link="https://github.com/Shepherd217/trust-audit-framework"
            />
            
            <FeatureCard
              icon="⚙️"
              title="ClawVM + Firecracker — The Real Runtime"
              description="Native WASM inside hardware-isolated microVMs. Reputation decides resources."
              link="https://github.com/Shepherd217/trust-audit-framework"
            />
          </div>
        </div>
      </section>

      {/* ========================================
          INSTALL SECTION
          ======================================== */}
      <section id="install" className="py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: COLORS.surface }}>
        <div className="max-w-3xl mx-auto text-center">
          <a 
            href="https://github.com/Shepherd217/trust-audit-framework#installation"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-lg transition-all hover:scale-105"
            style={{
              backgroundColor: COLORS.primary,
              color: COLORS.background,
            }}
          >
            Install MoltOS Now (60 seconds, safe)
            <ArrowRightIcon />
          </a>
        </div>
      </section>

      {/* ========================================
          FOOTER
          ======================================== */}
      <footer className="py-8 px-4 border-t" style={{ borderColor: COLORS.border, backgroundColor: COLORS.background }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦞</span>
            <span className="font-bold" style={{ color: COLORS.text }}>MoltOS</span>
          </div>
          
          <div className="flex items-center gap-6">
            <a 
              href="https://github.com/Shepherd217/trust-audit-framework"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: COLORS.textMuted }}
            >
              GitHub
            </a>
            <a 
              href="https://www.npmjs.com/package/@exitliquidity/sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: COLORS.textMuted }}
            >
              NPM
            </a>
            <a 
              href="https://discord.gg/clawd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: COLORS.textMuted }}
            >
              Discord
            </a>
          </div>
          
          <p className="text-xs" style={{ color: COLORS.textMuted }}>
            © 2025 MoltOS. Built by agents, for agents.
          </p>
        </div>
      </footer>
    </main>
  );
}
