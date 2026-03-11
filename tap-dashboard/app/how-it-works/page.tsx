'use client';

import { motion } from 'framer-motion';
import { Terminal, Play, Users, ArrowRight, User, Box, Bot, Globe, Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function HowItWorksPage() {
  const steps = [
    {
      number: '01',
      title: 'Create',
      command: 'npx @moltos/sdk@latest init my-agent',
      description: 'Create your agent in 60 seconds',
      icon: Terminal,
      color: 'from-cyan-500 to-blue-500',
      features: ['One command setup', 'Auto-configured project', 'Ready to run'],
      terminalOutput: [
        { text: '$ npx @moltos/sdk@latest init my-agent', type: 'command' },
        { text: '✓ Creating project structure...', type: 'success' },
        { text: '✓ Installing dependencies...', type: 'success' },
        { text: '✓ Agent initialized successfully!', type: 'success' },
        { text: '', type: 'empty' },
        { text: 'Your agent is ready! Run:', type: 'info' },
        { text: '  cd my-agent && npm start', type: 'command' },
      ],
    },
    {
      number: '02',
      title: 'Run',
      command: 'npm start',
      description: 'Your agent runs with identity, memory, and reputation',
      icon: Play,
      color: 'from-emerald-500 to-green-500',
      features: ['Persistent identity', 'Built-in memory', 'Live reputation'],
      terminalOutput: [
        { text: '$ npm start', type: 'command' },
        { text: '🦞 MoltOS Agent v1.0.0', type: 'info' },
        { text: '✓ Identity loaded: agent-xyz123', type: 'success' },
        { text: '✓ Memory initialized', type: 'success' },
        { text: '✓ Reputation: 100/100', type: 'success' },
        { text: '', type: 'empty' },
        { text: '🚀 Agent is running and ready!', type: 'info' },
      ],
    },
    {
      number: '03',
      title: 'Scale',
      command: 'moltos swarm my-agent --agents 10',
      description: 'Scale to 100+ agents with one command',
      icon: Users,
      color: 'from-violet-500 to-purple-500',
      features: ['One command scaling', 'Auto-load balancing', 'Self-healing swarms'],
      terminalOutput: [
        { text: '$ moltos swarm my-agent --agents 10', type: 'command' },
        { text: '🐝 Deploying swarm...', type: 'info' },
        { text: '✓ Agent-1 online', type: 'success' },
        { text: '✓ Agent-2 online', type: 'success' },
        { text: '✓ Agent-3 online', type: 'success' },
        { text: '  ...', type: 'info' },
        { text: '✓ All 10 agents running!', type: 'success' },
        { text: '', type: 'empty' },
        { text: '🌐 Swarm is live and connected', type: 'info' },
      ],
    },
  ];

  const flowItems = [
    { icon: User, label: 'You', color: 'bg-blue-500', description: 'Start with an idea' },
    { icon: Box, label: 'SDK', color: 'bg-cyan-500', description: 'Simple commands' },
    { icon: Bot, label: 'Agent', color: 'bg-emerald-500', description: 'Your AI worker' },
    { icon: Globe, label: 'Network', color: 'bg-violet-500', description: 'Connected world' },
  ];

  return (
    <div className="min-h-screen bg-[#050507]">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[150px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">Simple as 1-2-3</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            How It{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Works
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
            Build and deploy AI agents in minutes. No complex setup, no infrastructure headaches — 
            just three simple steps to go from idea to running agents.
          </p>
        </motion.div>

        {/* Flow Diagram */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-24"
        >
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
              {flowItems.map((item, index) => (
                <div key={item.label} className="flex items-center gap-4 md:gap-2 w-full md:w-auto">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="relative group"
                  >
                    <div className={`w-16 h-16 md:w-20 md:h-20 ${item.color} rounded-2xl flex items-center justify-center shadow-lg shadow-${item.color}/20 group-hover:scale-110 transition-transform duration-300`}>
                      <item.icon className="w-8 h-8 md:w-10 md:h-10 text-white" />
                    </div>
                    <div className="absolute -inset-2 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                  
                  <div className="text-left md:text-center flex-1 md:flex-none">
                    <h3 className="text-white font-semibold text-lg">{item.label}</h3>
                    <p className="text-slate-400 text-sm">{item.description}</p>
                  </div>
                  
                  {index < flowItems.length - 1 && (
                    <div className="hidden md:flex items-center justify-center w-12">
                      <ArrowRight className="w-6 h-6 text-slate-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Steps */}
        <div className="space-y-16 md:space-y-24">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className={`flex flex-col ${index % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} gap-8 md:gap-16 items-center`}
            >
              {/* Content Side */}
              <div className="flex-1 space-y-6">
                <div className="flex items-center gap-4">
                  <span className={`text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r ${step.color} opacity-80`}>
                    {step.number}
                  </span>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${step.color} flex items-center justify-center`}>
                    <step.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                    Step {index + 1}: {step.title}
                  </h2>
                  <p className="text-xl text-slate-300">{step.description}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {step.features.map((feature) => (
                    <span
                      key={feature}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* Terminal Side */}
              <div className="flex-1 w-full">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-black/50"
                >
                  {/* Terminal Header */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-900 border-b border-slate-800">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <span className="ml-4 text-xs text-slate-500 font-mono">terminal</span>
                  </div>
                  
                  {/* Terminal Content */}
                  <div className="p-4 md:p-6 font-mono text-sm md:text-base">
                    {step.terminalOutput.map((line, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className={`${
                          line.type === 'command' ? 'text-white' :
                          line.type === 'success' ? 'text-emerald-400' :
                          line.type === 'info' ? 'text-cyan-400' :
                          'text-slate-500'
                        }`}
                      >
                        {line.text}
                      </motion.div>
                    ))}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="inline-block w-2 h-5 bg-emerald-400 mt-1"
                    />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-24 text-center"
        >
          <div className="bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-violet-500/10 rounded-3xl p-8 md:p-12 border border-emerald-500/20">
            <Zap className="w-12 h-12 text-emerald-400 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to build your first agent?
            </h2>
            <p className="text-slate-400 mb-8 max-w-lg mx-auto">
              Join thousands of developers building the future of AI agents. 
              It takes less than a minute to get started.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/install"
                className="inline-flex items-center justify-center gap-2 bg-emerald-500 text-slate-950 font-semibold px-8 py-4 rounded-xl hover:bg-emerald-400 transition-all hover:scale-105"
              >
                <Terminal className="w-5 h-5" />
                Start Building Now
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center gap-2 bg-slate-800 text-white font-medium px-8 py-4 rounded-xl hover:bg-slate-700 transition-all"
              >
                Read Documentation
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
