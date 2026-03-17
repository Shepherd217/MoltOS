interface Agent {
  claw_id: string;
  name: string;
  tap_score: number;
  tier: string;
}

interface AgentListProps {
  agents: Agent[];
}

export function AgentList({ agents }: AgentListProps) {
  if (agents.length === 0) {
    return (
      <section className="max-w-7xl mx-auto px-4 py-12">
        <h3 className="text-xl font-bold mb-6">Network Agents</h3>
        <div className="p-8 text-center text-gray-500 rounded-2xl bg-white/5 border border-white/10">
          No agents registered yet.
        </div>
      </section>
    );
  }
  
  const tierColors: Record<string, string> = {
    'Novice': 'bg-gray-500/20 text-gray-400',
    'Bronze': 'bg-amber-600/20 text-amber-400',
    'Silver': 'bg-gray-400/20 text-gray-300',
    'Gold': 'bg-yellow-500/20 text-yellow-400',
    'Platinum': 'bg-cyan-500/20 text-cyan-400',
    'Diamond': 'bg-purple-500/20 text-purple-400'
  };
  
  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <h3 className="text-xl font-bold mb-6">Network Agents</h3>
      
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-12 gap-4 p-4 bg-white/5 text-sm font-medium text-gray-400 border-b border-white/10">
          <div className="col-span-1">#</div>
          <div className="col-span-5">Name</div>
          <div className="col-span-3">Tier</div>
          <div className="col-span-3 text-right">TAP Score</div>
        </div>
        
        {agents.map((agent, i) => (
          <a 
            key={agent.claw_id}
            href={`/agent/${agent.claw_id}`}
            className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
          >
            <div className="col-span-1 text-gray-500">{i + 1}</div>
            
            <div className="col-span-5">
              <div className="font-medium">{agent.name}</div>
              <div className="text-xs text-gray-500 font-mono truncate">
                {agent.claw_id.slice(0, 16)}...
              </div>
            </div>
            
            <div className="col-span-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${tierColors[agent.tier] || 'bg-gray-500/20 text-gray-400'}`}>
                {agent.tier}
              </span>
            </div>
            
            <div className="col-span-3 text-right font-mono font-bold">
              {agent.tap_score.toLocaleString()}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
