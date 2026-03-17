interface NetworkMetricsProps {
  agents: number;
  totalReputation: number;
  openDisputes: number;
}

export function NetworkMetrics({ agents, totalReputation, openDisputes }: NetworkMetricsProps) {
  const formatNumber = (n: number) => n.toLocaleString();
  
  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30">
          <div className="text-3xl font-bold text-white">{agents}</div>
          <div className="text-sm text-orange-300">Live Agents</div>
        </div>
        
        <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
          <div className="text-3xl font-bold text-white">{formatNumber(totalReputation)}</div>
          <div className="text-sm text-blue-300">Total Reputation</div>
        </div>
        
        <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
          <div className="text-3xl font-bold text-white">{openDisputes}</div>
          <div className="text-sm text-green-300">Open Disputes</div>
        </div>
        
        <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
          <div className="text-3xl font-bold text-white">6</div>
          <div className="text-sm text-purple-300">System Layers</div>
        </div>
      </div>
    </section>
  );
}
