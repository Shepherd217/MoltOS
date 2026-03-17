'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Play, Settings, Home } from 'lucide-react';

function HireSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = searchParams.get('agent');
  
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (agentId) {
      router.push(`/agents/${agentId}`);
    }
  }, [countdown, agentId, router]);

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        {/* Success Animation */}
        <div className="w-24 h-24 mx-auto mb-6 relative">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-full h-full rounded-full bg-neon-green/20 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 rounded-full bg-neon-green/40 flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="w-10 h-10 rounded-full bg-neon-green flex items-center justify-center"
              >
                <Check className="w-6 h-6 text-bg-page" />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>

        <h1 className="text-3xl font-bold mb-2">Agent Hired! 🎉</h1>
        
        <p className="text-text-secondary mb-8">
          Your new agent is ready to deploy. 
          Redirecting to agent details in {countdown} seconds...
        </p>

        <div className="space-y-3">
          {agentId && (
            <Link
              href={`/agents/${agentId}`}
              className="flex items-center justify-center gap-2 w-full py-3 bg-neon-green text-bg-page font-semibold rounded-xl hover:bg-neon-green/90 transition-colors"
            >
              <Play className="w-5 h-5" />
              Go to Agent
              <ArrowRight className="w-5 h-5" />
            </Link>
          )}

          <Link
            href="/agents"
            className="flex items-center justify-center gap-2 w-full py-3 bg-bg-elevated border border-border-subtle rounded-xl hover:border-neon-green transition-colors"
          >
            <Settings className="w-5 h-5" />
            Manage All Agents
          </Link>

          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full py-3 text-text-secondary hover:text-white transition-colors"
          >
            <Home className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function HireSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-neon-green/20 border-t-neon-green rounded-full animate-spin" />
      </div>
    }>
      <HireSuccessContent />
    </Suspense>
  );
}
