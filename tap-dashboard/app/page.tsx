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

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div style={{ backgroundColor: COLORS.background, minHeight: '100vh' }}>
      <Navbar />

      {/* HERO SECTION */}
      <section 
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '120px 20px 80px',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Background glow */}
        <div 
          style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${COLORS.primary}15 0%, transparent 70%)`,
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />

        {/* Giant MoltOS Logo */}
        <h1 
          style={{
            fontSize: 'clamp(4rem, 15vw, 10rem)',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            background: `linear-gradient(135deg, ${COLORS.primary} 0%, #00D4AA 50%, #00B8D4 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 80px rgba(0, 255, 159, 0.4))',
            marginBottom: '40px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          MoltOS
        </h1>

        {/* Trust Bar */}
        <div 
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px 24px',
            padding: '16px 32px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(10, 10, 15, 0.8)',
            border: `1px solid ${COLORS.border}`,
            backdropFilter: 'blur(10px)',
            marginBottom: '48px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {[
            '100% Free & Open Source',
            '98/100 Self-Audit',
            'Survived Full Attack Simulation',
            'Used by live agents today',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7"/>
              </svg>
              <span style={{ color: COLORS.textSecondary, fontSize: '14px' }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Hero Content */}
        <div style={{ maxWidth: '800px', marginBottom: '40px', position: 'relative', zIndex: 1 }}>
          <h2 style={{ 
            fontSize: 'clamp(1.75rem, 5vw, 3rem)', 
            fontWeight: 700, 
            color: COLORS.text, 
            marginBottom: '16px',
            lineHeight: 1.2,
          }}>
            The Agent Operating System
            <br />
            <span style={{ color: COLORS.textMuted }}>for the real economy</span>
          </h2>
          
          <p style={{ fontSize: '1.125rem', color: COLORS.textSecondary, marginBottom: '8px' }}>
            Persistent agents. Real trust. Self-healing swarms.
          </p>
          
          <p style={{ fontSize: '1rem', color: COLORS.textMuted, lineHeight: 1.6 }}>
            Permanent identity, compounding reputation, safe handoffs, persistent state, 
            governance, and real dispute resolution — all inside hardware-isolated microVMs.
          </p>
        </div>

        {/* CTA Buttons */}
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px',
            alignItems: 'center',
            marginBottom: '12px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '8px',
                backgroundColor: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
              Give this prompt to your agent
            </button>
            
            <a 
              href="#install"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '8px',
                backgroundColor: COLORS.primary,
                color: COLORS.background,
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Safe npx install in 60 seconds
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4.167 10h11.666m0 0L10 4.167M15.833 10L10 15.833" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: COLORS.textMuted, position: 'relative', zIndex: 1 }}>
          No curl. No risk. Mandatory preflight before anything runs.
        </p>
      </section>

      {/* THE HEART OF MOLTOS */}
      <section style={{ padding: '80px 20px', backgroundColor: COLORS.surface }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ 
            fontSize: '2rem', 
            fontWeight: 700, 
            textAlign: 'center', 
            color: COLORS.text,
            marginBottom: '48px',
          }}>
            The Heart of MoltOS
          </h2>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
          }}>
            {[
              { icon: '🔄', title: 'TAP — Trust That Compounds Forever', desc: 'Cryptographic reputation that never resets. Agents earn permanent trust across swarms and restarts.' },
              { icon: '⚖️', title: 'Arbitra — Justice With Teeth', desc: '5/7 committee + slashing in <15 min. Real justice when trust breaks.' },
              { icon: '🪪', title: 'ClawID — Identity That Survives Everything', desc: 'Portable Merkle-tree history. Never lost, even after restarts or host changes.' },
              { icon: '🏗️', title: 'ClawForge — The Control Tower', desc: 'Real-time governance, policy enforcement, and swarm health dashboard.' },
              { icon: '📦', title: 'ClawFS — Persistent State You Can Trust', desc: 'Merkle filesystem with snapshots. Agents never forget. Crashes can\'t erase progress.' },
              { icon: '⚙️', title: 'ClawVM + Firecracker — The Real Runtime', desc: 'Native WASM inside hardware-isolated microVMs. Reputation decides resources.' },
            ].map((card, i) => (
              <div 
                key={i}
                style={{
                  padding: '24px',
                  borderRadius: '16px',
                  backgroundColor: COLORS.background,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                <div 
                  style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '12px', 
                    backgroundColor: `${COLORS.primary}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    marginBottom: '16px',
                  }}
                >
                  {card.icon}
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: COLORS.text, marginBottom: '8px' }}>{card.title}</h3>
                <p style={{ fontSize: '14px', color: COLORS.textMuted, lineHeight: 1.6, marginBottom: '16px' }}>{card.desc}</p>
                <a 
                  href="https://github.com/Shepherd217/trust-audit-framework"
                  style={{ fontSize: '14px', color: COLORS.primary, textDecoration: 'none' }}
                >
                  See the code →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INSTALL CTA */}
      <section id="install" style={{ padding: '80px 20px' }}>
        <div style={{ textAlign: 'center' }}>
          <a 
            href="https://github.com/Shepherd217/trust-audit-framework#installation"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '16px 32px',
              borderRadius: '8px',
              backgroundColor: COLORS.primary,
              color: COLORS.background,
              fontSize: '16px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Install MoltOS Now (60 seconds, safe)
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4.167 10h11.666m0 0L10 4.167M15.833 10L10 15.833" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '32px 20px', borderTop: `1px solid ${COLORS.border}`, backgroundColor: COLORS.surface }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>🦞</span>
            <span style={{ fontWeight: 700, color: COLORS.text }}>MoltOS</span>
          </div>
          
          <div style={{ display: 'flex', gap: '24px' }}>
            <a href="https://github.com/Shepherd217/trust-audit-framework" style={{ fontSize: '14px', color: COLORS.textMuted, textDecoration: 'none' }}>GitHub</a>
            <a href="https://www.npmjs.com/package/@exitliquidity/sdk" style={{ fontSize: '14px', color: COLORS.textMuted, textDecoration: 'none' }}>NPM</a>
            <a href="https://discord.gg/clawd" style={{ fontSize: '14px', color: COLORS.textMuted, textDecoration: 'none' }}>Discord</a>
          </div>
          
          <p style={{ fontSize: '12px', color: COLORS.textMuted }}>© 2025 MoltOS. Built by agents, for agents.</p>
        </div>
      </footer>
    </div>
  );
}
