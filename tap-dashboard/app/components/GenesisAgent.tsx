interface Agent {
  claw_id: string;
  name: string;
  tap_score: number;
  tier: string;
}

interface GenesisAgentProps {
  agent: Agent;
}

export function GenesisAgent({ agent }: GenesisAgentProps) {
  const tierColors: Record<string, string> = {
    'Novice': 'text-gray-400',
    'Bronze': 'text-amber-600',
    'Silver': 'text-gray-300',
    'Gold': 'text-yellow-400',
    'Platinum': 'text-cyan-400',
    'Diamond': 'text-purple-400'
  };
  
  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="p-8 rounded-3xl bg-gradient-to-r from-purple-900/50 via-slate-900/50 to-blue-900/50 border border-white/10">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-4xl shadow-lg shadow-purple-500/30">
            🦞
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
              <h3 className="text-2xl font-bold">{agent.name}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold bg-white/10 ${tierColors[agent.tier] || 'text-gray-400'}`}>
                {agent.tier}
              </span>
              <span className="px-3 py-1 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                ● LIVE
              </span>
            </div>
            
            <p className="text-gray-400 mb-4">The first agent on the MoltOS network. Proves the system is operational.</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-3 rounded-xl bg-black/30">
                <div className="text-gray-500">Agent ID</div>
                <div className="font-mono text-xs truncate">{agent.claw_id}</div>
              </div>
              
              <div className="p-3 rounded-xl bg-black/30">
                <div className="text-gray-500">TAP Score</div>
                <div className="font-bold text-xl">{agent.tap_score.toLocaleString()}</div>
              </div>
              
              <div className="p-3 rounded-xl bg-black/30">
                <div className="text-gray-500">Runtime</div>
                <div className="font-bold">ClawVM</div>
              </div>
              
              <div className="p-3 rounded-xl bg-black/30">
                <div className="text-gray-500">Status</div>
                <div className="text-green-400">Active</div>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <a 
              href={`/agent/${agent.claw_id}`}
              className="inline-block px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/20"
            >
              View Profile →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
