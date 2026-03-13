'use client';

import { useState } from 'react';
import { Shield, Eye, Terminal, ArrowLeft, Copy, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const COLORS = {
  primary: '#00FF9F',
  background: '#020204',
  surface: '#0A0A0F',
  surfaceLight: '#12121A',
  border: '#1E1E2E',
  text: '#FFFFFF',
  textMuted: '#888899',
  textSecondary: '#A0A0B0',
};

export default function InstallPage() {
  const [copied, setCopied] = useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText('npx @moltos/sdk@latest init');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: COLORS.border, backgroundColor: COLORS.surface }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🦞</span>
            <span className="font-bold text-xl" style={{ color: COLORS.text }}>MoltOS</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 text-sm" style={{ color: COLORS.textMuted }}>
            <ArrowLeft size={16} /> Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ backgroundColor: `${COLORS.primary}10`, border: `1px solid ${COLORS.primary}30` }}
          >
            <Shield size={16} style={{ color: COLORS.primary }} />
            <span className="text-sm" style={{ color: COLORS.primary }}>Safe & Transparent Install</span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center mb-6" style={{ color: COLORS.text }}>
          Install MoltOS in
          <span style={{ color: COLORS.primary }}> 60 Seconds</span>
        </h1>

        <p className="text-lg text-center mb-12 max-w-2xl mx-auto" style={{ color: COLORS.textMuted }}>
          No curl. No hidden scripts. Full transparency with mandatory preflight checks.
        </p>

        {/* Code Block */}
        <div className="rounded-2xl overflow-hidden mb-8"
          style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: COLORS.border }}>
            <div className="flex items-center gap-2">
              <Terminal size={16} style={{ color: COLORS.textMuted }} />
              <span className="text-sm" style={{ color: COLORS.textMuted }}>Run in your terminal</span>
            </div>
            <button
              onClick={copyCommand}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ backgroundColor: COLORS.surfaceLight, color: COLORS.primary }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="p-6">
            <code className="text-lg font-mono block" style={{ color: COLORS.primary }}>
              <span style={{ color: COLORS.textMuted }}>$</span> npx @moltos/sdk@latest init
            </code>
          </div>
        </div>

        {/* Alternative */}
        <p className="text-center mb-16" style={{ color: COLORS.textMuted }}>
          Or tell your agent:{" "}
          <span style={{ color: COLORS.primary }}>"Install from skill.md"</span>
        </p>

        {/* How It Works */}
        <h2 className="text-3xl font-bold text-center mb-12" style={{ color: COLORS.text }}>
          How Safe Install Works
        </h2>

        <div className="space-y-8 mb-16">
          {/* Preflight Scan */}
          <div className="flex gap-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${COLORS.primary}15` }}
            >
              <Shield size={24} style={{ color: COLORS.primary }} />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2" style={{ color: COLORS.text }}>Preflight Scan</h3>
              <p style={{ color: COLORS.textMuted }}>
                Safety check runs first — see every file, permission, and dependency before install. 
                We scan for malicious code, verify package integrity, and show you exactly what will change.
              </p>
            </div>
          </div>

          {/* Transparent Install */}
          <div className="flex gap-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${COLORS.primary}15` }}
            >
              <Eye size={24} style={{ color: COLORS.primary }} />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2" style={{ color: COLORS.text }}>Transparent Install</h3>
              <p style={{ color: COLORS.textMuted }}>
                Every line of code is auditable on GitHub. No hidden scripts. No surprises. 
                The entire installation plan is shown before anything runs.
              </p>
            </div>
          </div>

          {/* Production Ready */}
          <div className="flex gap-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${COLORS.primary}15` }}
            >
              <Terminal size={24} style={{ color: COLORS.primary }} />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2" style={{ color: COLORS.text }}>Production Ready</h3>
              <p style={{ color: COLORS.textMuted }}>
                60 seconds to a fully configured agent runtime with sandbox, storage, and observability. 
                Includes ClawVM + Firecracker isolation, ClawFS persistence, and live dashboard.
              </p>
            </div>
          </div>
        </div>

        {/* What This Command Does */}
        <div className="rounded-2xl p-6 mb-16"
          style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: COLORS.text }}>
            <Eye size={20} style={{ color: COLORS.primary }} />
            What This Command Does
          </h3>
          <ol className="space-y-4 list-decimal list-inside" style={{ color: COLORS.textMuted }}>
            <li>Downloads @moltos/sdk from npm (verified package)</li>
            <li>Runs preflight safety scan (files, permissions, network)</li>
            <li>Shows you exactly what will be installed</li>
            <li>Sets up MoltOS runtime with ClawVM + Firecracker</li>
            <li>Configures ClawFS for state persistence</li>
          </ol>
        </div>

        {/* Full Transparency */}
        <h2 className="text-3xl font-bold text-center mb-8" style={{ color: COLORS.text }}>
          Full Transparency
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          <a
            href="https://github.com/Shepherd217/trust-audit-framework"
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-xl text-center transition-all hover:scale-105"
            style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span style={{ color: COLORS.text }}>View Source</span>
              <ExternalLink size={16} style={{ color: COLORS.primary }} />
            </div>
          </a>

          <Link
            href="/audit"
            className="p-6 rounded-xl text-center transition-all hover:scale-105"
            style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span style={{ color: COLORS.text }}>Audit Checklist</span>
              <Shield size={16} style={{ color: COLORS.primary }} />
            </div>
          </Link>

          <a
            href="https://github.com/Shepherd217/trust-audit-framework/blob/main/SKILL.md"
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-xl text-center transition-all hover:scale-105"
            style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span style={{ color: COLORS.text }}>Skill Definition</span>
              <ExternalLink size={16} style={{ color: COLORS.primary }} />
            </div>
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t" style={{ borderColor: COLORS.border }}>
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            © 2025 MoltOS. No curl • Full transparency • Open source
          </p>
        </div>
      </footer>
    </div>
  );
}
