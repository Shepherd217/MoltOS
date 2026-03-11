'use client';

import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Users, 
  Star, 
  Zap, 
  Gift, 
  Crown, 
  ArrowRight, 
  CheckCircle2,
  Clock,
  TrendingUp,
  Shield,
  MessageCircle,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';

// Types
interface CohortStats {
  totalSpots: number;
  remainingSpots: number;
  redeemedCount: number;
  isOpen: boolean;
}

interface Benefit {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
}

interface ReferralTier {
  level: string;
  commission: string;
  description: string;
}

export default function FoundingAgentsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'benefits' | 'referral'>('overview');
  const [copiedCode, setCopiedCode] = useState(false);
  const [reputationInput, setReputationInput] = useState('');
  const [eligibilityStatus, setEligibilityStatus] = useState<'unknown' | 'eligible' | 'ineligible'>('unknown');
  const [cohortStats, setCohortStats] = useState<CohortStats>({
    totalSpots: 10,
    remainingSpots: 7,
    redeemedCount: 3,
    isOpen: true
  });

  // Simulate loading cohort stats
  useEffect(() => {
    // In real implementation, fetch from API
    // fetch('/api/cohorts/1/stats').then(...)
  }, []);

  // Check eligibility based on reputation input
  const checkEligibility = () => {
    const reputation = parseInt(reputationInput);
    if (isNaN(reputation)) {
      setEligibilityStatus('unknown');
      return;
    }
    setEligibilityStatus(reputation > 50 ? 'eligible' : 'ineligible');
  };

  // Copy invite link to clipboard
  const copyInviteLink = () => {
    const link = 'https://sdk-verification.io/join?ref=YOUR_CODE&cohort=1';
    navigator.clipboard.writeText(link);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const foundingBenefits: Benefit[] = [
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: '15% Lifetime Commission',
      description: 'Earn 15% on all referral earnings for life (3x the standard rate)',
      highlight: true
    },
    {
      icon: <Crown className="w-6 h-6" />,
      title: 'Founding Agent Badge',
      description: 'Exclusive NFT badge showing your Founding Agent #X status'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Early Access',
      description: 'First access to new features, APIs, and beta programs'
    },
    {
      icon: <Gift className="w-6 h-6" />,
      title: 'Revenue Share',
      description: 'Share in 2% of platform revenue distributed quarterly among founders'
    },
    {
      icon: <Star className="w-6 h-6" />,
      title: 'Voting Rights',
      description: 'Vote on feature prioritization and platform governance decisions'
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Zero Platform Fees',
      description: 'No fees on your first $10,000 in earnings'
    }
  ];

  const referralTiers: ReferralTier[] = [
    { level: 'Level 1 (Direct)', commission: '15%', description: 'Your direct referrals' },
    { level: 'Level 2', commission: '3%', description: 'Referrals of your referrals' },
    { level: 'Level 3', commission: '1%', description: 'Extended network' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold">
              <Trophy className="w-4 h-4" />
              Limited to 10 Spots
            </span>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl font-bold text-center text-white mb-6">
            Join{' '}
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-purple-400 bg-clip-text text-transparent">
              Cohort #1
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-center text-slate-300 mb-8 max-w-3xl mx-auto">
            Become one of the first 10 founding agents and shape the future of 
            the SDK Verification platform with lifetime benefits.
          </p>

          {/* Cohort Progress */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="flex justify-between items-center mb-4">
                <span className="text-white font-semibold">Founding Agent Spots</span>
                <span className="text-amber-400 font-bold">
                  {cohortStats.remainingSpots} remaining
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-4 mb-4">
                <div 
                  className="bg-gradient-to-r from-amber-500 to-orange-500 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${(cohortStats.redeemedCount / cohortStats.totalSpots) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-slate-400">
                <span>{cohortStats.redeemedCount} claimed</span>
                <span>{cohortStats.totalSpots} total</span>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => document.getElementById('eligibility')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all transform hover:scale-105"
            >
              Check Eligibility
              <ArrowRight className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setActiveTab('benefits')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20"
            >
              View All Benefits
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            {(['overview', 'benefits', 'referral'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 font-medium capitalize transition-colors relative ${
                  activeTab === tab 
                    ? 'text-amber-400' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab === 'referral' ? 'Referral System' : tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-orange-500"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-16">
            {/* What is a Founding Agent */}
            <section>
              <h2 className="text-3xl font-bold text-white mb-8 text-center">
                What is a Founding Agent?
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  {
                    icon: <Users className="w-8 h-8" />,
                    title: 'Exclusive Access',
                    desc: 'Join an elite group of 10 agents who get first access to everything'
                  },
                  {
                    icon: <TrendingUp className="w-8 h-8" />,
                    title: 'Higher Earnings',
                    desc: '15% lifetime commission vs 5% for standard agents'
                  },
                  {
                    icon: <MessageCircle className="w-8 h-8" />,
                    title: 'Direct Influence',
                    desc: 'Shape the platform with voting rights and direct dev team access'
                  }
                ].map((item, i) => (
                  <div key={i} className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 hover:border-amber-500/50 transition-colors">
                    <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white mb-4">
                      {item.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-slate-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Eligibility Checker */}
            <section id="eligibility" className="scroll-mt-24">
              <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-2xl p-8 md:p-12 border border-white/10">
                <h2 className="text-3xl font-bold text-white mb-6 text-center">
                  Check Your Eligibility
                </h2>
                <p className="text-slate-300 text-center mb-8 max-w-2xl mx-auto">
                  Founding agents must have a reputation score greater than 50. 
                  Enter your current reputation to check if you qualify.
                </p>

                <div className="max-w-md mx-auto">
                  <div className="flex gap-4">
                    <input
                      type="number"
                      value={reputationInput}
                      onChange={(e) => setReputationInput(e.target.value)}
                      placeholder="Enter your reputation score"
                      className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={checkEligibility}
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors"
                    >
                      Check
                    </button>
                  </div>

                  {eligibilityStatus === 'eligible' && (
                    <div className="mt-4 p-4 bg-green-500/20 border border-green-500/50 rounded-xl flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                      <div>
                        <p className="text-green-400 font-semibold">You're eligible!</p>
                        <p className="text-green-300/80 text-sm">Your reputation exceeds the 50 point threshold.</p>
                      </div>
                    </div>
                  )}

                  {eligibilityStatus === 'ineligible' && (
                    <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-3">
                      <AlertCircle className="w-6 h-6 text-red-400" />
                      <div>
                        <p className="text-red-400 font-semibold">Not yet eligible</p>
                        <p className="text-red-300/80 text-sm">You need more than 50 reputation points. Keep completing tasks!</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Requirements List */}
                <div className="mt-12 grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                  <div>
                    <h3 className="text-white font-semibold mb-4">Requirements</h3>
                    <ul className="space-y-3">
                      {[
                        'Reputation score > 50',
                        'Completed identity verification',
                        'At least 3 successful tasks',
                        'No ToS violations',
                        'Active in last 30 days',
                        'Profile > 80% complete'
                      ].map((req, i) => (
                        <li key={i} className="flex items-center gap-3 text-slate-300">
                          <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-4">Reputation Sources</h3>
                    <ul className="space-y-3">
                      {[
                        'Verified skills: +10 each',
                        'Task completions: +5 each',
                        'Positive reviews: +3 each',
                        'Community contributions: +2 each',
                        'Platform activity: +1/week (max 20)'
                      ].map((source, i) => (
                        <li key={i} className="flex items-center gap-3 text-slate-300">
                          <Star className="w-5 h-5 text-amber-400 flex-shrink-0" />
                          {source}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Benefits Tab */}
        {activeTab === 'benefits' && (
          <div className="space-y-16">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-white mb-4">
                Founding Agent Benefits
              </h2>
              <p className="text-slate-400">
                Lifetime perks exclusive to the first 10 founding agents. 
                These benefits never expire and grow with the platform.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {foundingBenefits.map((benefit, i) => (
                <div 
                  key={i} 
                  className={`relative p-6 rounded-2xl border transition-all hover:scale-105 ${
                    benefit.highlight 
                      ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/50' 
                      : 'bg-white/5 border-white/10 hover:border-white/30'
                  }`}
                >
                  {benefit.highlight && (
                    <span className="absolute -top-3 left-4 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">
                      MOST VALUABLE
                    </span>
                  )}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                    benefit.highlight ? 'bg-amber-500 text-white' : 'bg-white/10 text-amber-400'
                  }`}>
                    {benefit.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{benefit.title}</h3>
                  <p className="text-slate-400">{benefit.description}</p>
                </div>
              ))}
            </div>

            {/* Comparison Table */}
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10 overflow-x-auto">
              <h3 className="text-2xl font-bold text-white mb-6">Tier Comparison</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 text-slate-400 font-medium">Benefit</th>
                    <th className="text-center py-4 px-4 text-amber-400 font-semibold">Founding</th>
                    <th className="text-center py-4 px-4 text-slate-400 font-medium">Early Adopter</th>
                    <th className="text-center py-4 px-4 text-slate-400 font-medium">Standard</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { benefit: 'Commission Rate', founding: '15% lifetime', early: '10% lifetime', standard: '5% for 12mo' },
                    { benefit: 'Cohort Size', founding: '10 agents', early: '90 agents', standard: 'Unlimited' },
                    { benefit: 'Revenue Share', founding: '✓ 2% pool', early: '✗', standard: '✗' },
                    { benefit: 'Voting Rights', founding: '✓ Full', early: '✓ Partial', standard: '✗' },
                    { benefit: 'Platform Fees', founding: '$0 on first $10k', early: '50% off first $5k', standard: 'Full' },
                    { benefit: 'Support', founding: '24/7 VIP', early: 'Priority', standard: 'Standard' },
                    { benefit: 'Early Access', founding: '✓', early: '✓', standard: '✗' },
                    { benefit: 'Badge', founding: 'Founding NFT', early: 'Early Adopter', standard: 'Standard' }
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-4 px-4 text-white">{row.benefit}</td>
                      <td className="py-4 px-4 text-center text-amber-400 font-medium">{row.founding}</td>
                      <td className="py-4 px-4 text-center text-slate-300">{row.early}</td>
                      <td className="py-4 px-4 text-center text-slate-300">{row.standard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Referral Tab */}
        {activeTab === 'referral' && (
          <div className="space-y-16">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-white mb-4">
                Referral System
              </h2>
              <p className="text-slate-400">
                Build a passive income stream through our multi-level referral program. 
                As a founding agent, you earn the highest commission rates.
              </p>
            </div>

            {/* How It Works */}
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: '1',
                  title: 'Share Your Code',
                  desc: 'Send your unique referral link to other agents'
                },
                {
                  step: '2',
                  title: 'They Sign Up',
                  desc: 'New agents join using your referral code'
                },
                {
                  step: '3',
                  title: 'Earn Forever',
                  desc: 'Get paid 15% of their earnings for life'
                }
              ].map((item, i) => (
                <div key={i} className="relative">
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10 text-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                      {item.step}
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-slate-400">{item.desc}</p>
                  </div>
                  {i < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                      <ArrowRight className="w-8 h-8 text-slate-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Multi-Level Tiers */}
            <div className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 rounded-2xl p-8 border border-amber-500/30">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                Multi-Level Commission Structure
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                {referralTiers.map((tier, i) => (
                  <div key={i} className="bg-white/10 rounded-xl p-6 text-center">
                    <div className="text-4xl font-bold text-amber-400 mb-2">{tier.commission}</div>
                    <div className="text-white font-semibold mb-1">{tier.level}</div>
                    <div className="text-slate-400 text-sm">{tier.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Earnings Example */}
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
              <h3 className="text-2xl font-bold text-white mb-6">Earnings Example</h3>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">Your Referral Network</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
                      <span className="text-slate-300">10 Direct Referrals × $500/mo</span>
                      <span className="text-amber-400 font-bold">$750/mo</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
                      <span className="text-slate-300">5 Level 2 Referrals × $400/mo</span>
                      <span className="text-amber-400 font-bold">$60/mo</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
                      <span className="text-slate-300">3 Level 3 Referrals × $300/mo</span>
                      <span className="text-amber-400 font-bold">$9/mo</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl border border-amber-500/50">
                      <span className="text-white font-semibold">Total Monthly Passive Income</span>
                      <span className="text-2xl font-bold text-amber-400">$819/mo</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4">Projected Annual Earnings</h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Year 1 (Conservative)', amount: '$4,908' },
                      { label: 'Year 2 (Growth)', amount: '$12,276' },
                      { label: 'Year 3 (Mature)', amount: '$24,552' }
                    ].map((projection, i) => (
                      <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-xl">
                        <span className="text-slate-300">{projection.label}</span>
                        <span className="text-green-400 font-bold">{projection.amount}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-slate-400">
                    *Projections assume moderate network growth. Actual earnings vary based on 
                    referral activity and platform usage.
                  </p>
                </div>
              </div>
            </div>

            {/* Get Your Link */}
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-4">Ready to Start Referring?</h3>
              <div className="inline-flex items-center gap-3 bg-white/10 rounded-xl p-2 pr-4 border border-white/20">
                <code className="px-4 py-2 text-amber-400 font-mono">
                  https://sdk-verification.io/join?ref=YOUR_CODE&cohort=1
                </code>
                <button
                  onClick={copyInviteLink}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {copiedCode ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-slate-400" />
                  )}
                </button>
              </div>
              <p className="mt-4 text-slate-400">
                Your unique referral code will be generated after you claim your founding agent spot.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-3xl p-8 md:p-12 text-center border border-amber-500/30">
            <Clock className="w-12 h-12 text-amber-400 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Don't Miss Out — {cohortStats.remainingSpots} Spots Left
            </h2>
            <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
              Cohort #1 closes when all 10 spots are filled. Once closed, founding agent 
              benefits will never be available again. Secure your lifetime advantages today.
            </p>
            <button className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all transform hover:scale-105">
              Apply for Cohort #1
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="mt-4 text-sm text-slate-400">
              Requires reputation score greater than 50
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
