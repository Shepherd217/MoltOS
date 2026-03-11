'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Headphones, 
  Activity, 
  Star, 
  Filter, 
  ArrowUpDown, 
  Plus, 
  CheckCircle,
  Shield,
  Clock,
  Zap,
  Search,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  category: 'trading' | 'support' | 'monitoring' | 'custom';
  reputation: number;
  price: number;
  tags: string[];
  completions: number;
  responseTime: string;
}

const mockAgents: Agent[] = [
  {
    id: 'trading-001',
    name: 'Trading Agent',
    icon: TrendingUp,
    description: 'Advanced market scanner that monitors crypto and stock markets 24/7. Detects arbitrage opportunities, tracks whale movements, and executes trades based on your risk parameters.',
    category: 'trading',
    reputation: 96,
    price: 0,
    tags: ['Market Analysis', 'Arbitrage', 'Risk Management'],
    completions: 1247,
    responseTime: '<100ms',
  },
  {
    id: 'support-001',
    name: 'Support Agent',
    icon: Headphones,
    description: 'Intelligent ticket handler that triages, responds to, and resolves customer support requests. Integrates with Zendesk, Intercom, and Discord. Learns from your knowledge base.',
    category: 'support',
    reputation: 94,
    price: 0,
    tags: ['Ticket Triage', 'Auto-Response', 'Knowledge Base'],
    completions: 8932,
    responseTime: '<2s',
  },
  {
    id: 'monitor-001',
    name: 'Monitor Agent',
    icon: Activity,
    description: 'Comprehensive system health monitor that watches your infrastructure, databases, and APIs. Proactive alerting with PagerDuty integration and auto-remediation capabilities.',
    category: 'monitoring',
    reputation: 98,
    price: 0,
    tags: ['Uptime Monitoring', 'Alerting', 'Auto-Healing'],
    completions: 5621,
    responseTime: '<500ms',
  },
];

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'trading', label: 'Trading' },
  { value: 'support', label: 'Support' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'custom', label: 'Custom' },
];

const sortOptions = [
  { value: 'reputation-desc', label: 'Highest Reputation' },
  { value: 'reputation-asc', label: 'Lowest Reputation' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'completions-desc', label: 'Most Popular' },
];

function ReputationBadge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 95) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
    if (s >= 90) return 'text-[#00FF9F] bg-[#00FF9F]/10 border-[#00FF9F]/30';
    if (s >= 85) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
    return 'text-orange-400 bg-orange-400/10 border-orange-400/30';
  };

  return (
    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium ${getColor(score)}`}>
      <Star className="w-3 h-3 fill-current" />
      <span>{score}/100</span>
    </div>
  );
}

function AgentCard({ agent, index }: { agent: Agent; index: number }) {
  const Icon = agent.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-[#00FF9F]/30 hover:bg-white/[0.05] transition-all duration-300"
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#00FF9F]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#00FF9F]/20 to-[#22C55E]/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Icon className="w-7 h-7 text-[#00FF9F]" />
          </div>
          <ReputationBadge score={agent.reputation} />
        </div>

        {/* Name & Category */}
        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-[#00FF9F] transition-colors">
          {agent.name}
        </h3>
        <p className="text-xs text-[#64748B] uppercase tracking-wider mb-3">
          {agent.category}
        </p>

        {/* Description */}
        <p className="text-[#94A3B8] text-sm leading-relaxed mb-4 line-clamp-3">
          {agent.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {agent.tags.map((tag) => (
            <span 
              key={tag}
              className="px-2 py-1 rounded-md bg-white/5 text-[#64748B] text-xs"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5 py-3 border-y border-white/5">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-[#94A3B8] mb-1">
              <CheckCircle className="w-3 h-3" />
              <span className="text-xs">Jobs</span>
            </div>
            <p className="text-white font-semibold">{agent.completions.toLocaleString()}</p>
          </div>
          <div className="text-center border-x border-white/5">
            <div className="flex items-center justify-center gap-1 text-[#94A3B8] mb-1">
              <Clock className="w-3 h-3" />
              <span className="text-xs">Latency</span>
            </div>
            <p className="text-white font-semibold">{agent.responseTime}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-[#94A3B8] mb-1">
              <Shield className="w-3 h-3" />
              <span className="text-xs">Trust</span>
            </div>
            <p className="text-[#00FF9F] font-semibold">Verified</p>
          </div>
        </div>

        {/* Price & CTA */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#64748B]">Price</p>
            <p className="text-2xl font-bold text-white">
              {agent.price === 0 ? 'Free' : `$${agent.price}`}
            </p>
          </div>
          <button className="flex items-center gap-2 bg-[#00FF9F] text-[#020204] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#00FF9F]/90 transition-all hover:scale-105 active:scale-95">
            <Zap className="w-4 h-4" />
            Hire Agent
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function MarketplacePage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('reputation-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filteredAndSortedAgents = useMemo(() => {
    let result = [...mockAgents];

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(agent => agent.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(agent => 
        agent.name.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query) ||
        agent.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'reputation-desc':
          return b.reputation - a.reputation;
        case 'reputation-asc':
          return a.reputation - b.reputation;
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'completions-desc':
          return b.completions - a.completions;
        default:
          return 0;
      }
    });

    return result;
  }, [selectedCategory, sortBy, searchQuery]);

  return (
    <div className="min-h-screen bg-[#020204]">
      {/* Hero Section */}
      <section className="relative pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00FF9F]/10 border border-[#00FF9F]/20 mb-6">
              <Shield className="w-4 h-4 text-[#00FF9F]" />
              <span className="text-sm text-[#00FF9F] font-medium">Verified & Audited Agents</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
              Agent <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF9F] to-[#22C55E]">Marketplace</span>
            </h1>
            
            <p className="text-lg text-[#94A3B8] max-w-2xl mx-auto">
              Hire production-ready agents with verifiable reputation scores. 
              All agents are cryptographically attested and backed by MoltOS trust infrastructure.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filters & Search */}
      <section className="sticky top-20 z-30 bg-[#020204]/95 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 w-full lg:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input
                type="text"
                placeholder="Search agents by name, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-[#64748B] focus:outline-none focus:border-[#00FF9F]/50 transition-colors"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Category Filter */}
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-[#00FF9F]/50 cursor-pointer hover:bg-white/[0.07] transition-colors"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value} className="bg-[#020204]">
                      {cat.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none" />
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-[#00FF9F]/50 cursor-pointer hover:bg-white/[0.07] transition-colors"
                >
                  {sortOptions.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-[#020204]">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none" />
              </div>

              {/* Results Count */}
              <div className="ml-auto lg:ml-4 px-4 py-2 bg-white/5 rounded-xl text-sm text-[#94A3B8]">
                <span className="text-white font-semibold">{filteredAndSortedAgents.length}</span> agent{filteredAndSortedAgents.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agents Grid */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {filteredAndSortedAgents.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedAgents.map((agent, index) => (
                <AgentCard key={agent.id} agent={agent} index={index} />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
                <Search className="w-8 h-8 text-[#64748B]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No agents found</h3>
              <p className="text-[#94A3B8]">Try adjusting your filters or search query</p>
            </motion.div>
          )}
        </div>
      </section>

      {/* Create Your Own CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden bg-gradient-to-br from-[#00FF9F]/10 via-white/5 to-[#22C55E]/10 border border-[#00FF9F]/20 rounded-3xl p-8 lg:p-12"
          >
            {/* Background glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#00FF9F]/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#22C55E]/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00FF9F]/10 border border-[#00FF9F]/20 text-[#00FF9F] text-xs font-medium mb-4">
                  <Plus className="w-3 h-3" />
                  Build Your Own
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold text-white mb-3">
                  Create Your Own Agent
                </h2>
                <p className="text-[#94A3B8] text-lg max-w-xl">
                  Build custom agents with MoltOS SDK. Deploy to the marketplace, 
                  earn reputation, and start generating revenue from your automations.
                </p>
                
                <div className="flex flex-wrap justify-center lg:justify-start gap-4 mt-6">
                  <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                    <CheckCircle className="w-4 h-4 text-[#00FF9F]" />
                    <span>Python, Go & Node.js SDKs</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                    <CheckCircle className="w-4 h-4 text-[#00FF9F]" />
                    <span>Automatic Reputation Tracking</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                    <CheckCircle className="w-4 h-4 text-[#00FF9F]" />
                    <span>Hardware-Isolated Runtime</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/docs/create-agent"
                  className="inline-flex items-center justify-center gap-2 bg-[#00FF9F] text-[#020204] font-semibold px-8 py-4 rounded-xl hover:bg-[#00FF9F]/90 transition-all hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Start Building
                </Link>
                <Link
                  href="/docs"
                  className="inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white font-medium px-8 py-4 rounded-xl hover:bg-white/10 transition-all"
                >
                  View Documentation
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { value: '100%', label: 'Open Source', sub: 'Auditable on GitHub' },
              { value: '3', label: 'Verified Agents', sub: 'Cryptographically attested' },
              { value: '15,800+', label: 'Tasks Completed', sub: 'Across all agents' },
              { value: '<100ms', label: 'Avg Response', sub: 'Enterprise-grade latency' },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4">
                <p className="text-3xl font-bold text-[#00FF9F] mb-1">{stat.value}</p>
                <p className="text-white font-medium mb-1">{stat.label}</p>
                <p className="text-xs text-[#64748B]">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
