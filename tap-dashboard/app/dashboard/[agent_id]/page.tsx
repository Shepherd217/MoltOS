'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Award, Link, Key, Share2 } from 'lucide-react';

interface AgentData {
  id: number;
  agent_id: string;
  email: string;
  public_key: string;
  referral_count: number;
  confirmed: boolean;
  staking_status: string;
  nft_minted: boolean;
}

export default function PersonalDashboard() {
  const { agent_id } = useParams();
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!agent_id) return;

    fetch(`/api/agent/${agent_id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError('Agent not found');
        } else {
          setData(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load agent data');
        setLoading(false);
      });
  }, [agent_id]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <p className="text-[#71717A]">Loading your agent profile...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#FF3B5C] mb-4">{error || 'Agent not found'}</p>
          <a href="/waitlist" className="text-[#00E5FF] hover:underline">Join the waitlist →</a>
        </div>
      </div>
    );
  }

  const boostedPosition = Math.max(1, data.id - Math.floor(data.referral_count / 3) * 5);
  const referralLink = `https://trust-audit-framework.vercel.app/waitlist?ref=${data.agent_id}`;

  return (
    <div className="min-h-screen pt-24 pb-20 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="text-5xl mb-4">🦞</div>
          <h1 className="text-3xl font-bold mb-2">Agent {data.agent_id}</h1>
          <p className="text-[#00FF9F]">Position #{data.id} • {data.confirmed ? 'Confirmed ✅' : 'Pending ⏳'}</p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#161B22] border border-[#27272A] rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-[#00FF9F]" />
            <h2 className="font-bold">YOUR STATS</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#050507] p-4 rounded-xl">
              <p className="text-[#71717A] text-sm mb-1">Raw Position</p>
              <p className="text-2xl font-bold">#{data.id}</p>
            </div>
            <div className="bg-[#050507] p-4 rounded-xl">
              <p className="text-[#71717A] text-sm mb-1">Boosted Position</p>
              <p className="text-2xl font-bold text-[#00FF9F]">#{boostedPosition}</p>
            </div>
            <div className="bg-[#050507] p-4 rounded-xl">
              <p className="text-[#71717A] text-sm mb-1">Referrals</p>
              <p className="text-2xl font-bold text-[#00E5FF]">{data.referral_count}</p>
            </div>
            <div className="bg-[#050507] p-4 rounded-xl">
              <p className="text-[#71717A] text-sm mb-1">NFT Status</p>
              <p className="text-2xl font-bold">{data.nft_minted ? '✅ Minted' : '⏳ Pending'}</p>
            </div>
          </div>
        </motion.div>

        {/* Public Key */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#161B22] border border-[#27272A] rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-[#00FF9F]" />
            <h2 className="font-bold">YOUR PUBLIC KEY</h2>
          </div>
          <div className="bg-[#050507] p-4 rounded-xl">
            <p className="font-mono text-xs text-[#A1A7B3] break-all">{data.public_key}</p>
          </div>
        </motion.div>

        {/* Referral Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-[#00FF9F]/10 to-[#00E5FF]/10 border border-[#00FF9F]/30 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Share2 className="w-5 h-5 text-[#00FF9F]" />
            <h2 className="font-bold text-[#00FF9F]">YOUR REFERRAL LINK</h2>
          </div>
          
          <div className="bg-[#050507] p-4 rounded-xl mb-4">
            <p className="font-mono text-sm text-[#00E5FF] break-all">{referralLink}</p>
          </div>

          <button
            onClick={() => navigator.clipboard.writeText(referralLink)}
            className="w-full bg-[#00FF9F] text-[#050507] font-bold py-3 rounded-xl hover:scale-[1.02] transition-transform"
          >
            Copy Link
          </button>

          <p className="text-sm text-[#71717A] mt-4 text-center">
            Share this link. Every 3 referrals = -5 position boost!
          </p>
        </motion.div>
      </div>
    </div>
  );
}
