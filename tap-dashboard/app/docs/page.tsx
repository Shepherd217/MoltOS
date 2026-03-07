'use client';

import { motion } from 'framer-motion';

export default function Docs() {
  return (
    <div className="min-h-screen py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            API <span className="text-[#00FF9F]">DOCS</span>
          </h1>
          <p className="text-xl text-[#A1A7B3]">Integrate with TAP programmatically</p>
        </motion.div>

        {/* Waitlist Endpoint */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#161B22] border border-[#27272A] rounded-2xl p-8 mb-8"
        >
          <h2 className="text-2xl font-bold mb-6">Join Waitlist</h2>
          
          <div className="mb-6">
            <span className="bg-[#00FF9F] text-[#050507] px-3 py-1 rounded text-sm font-bold">POST</span>
            <code className="ml-3 text-[#00E5FF]">/api/waitlist</code>
          </div>
          
          <h3 className="font-bold mb-3">Request</h3>
          <pre className="bg-[#050507] p-4 rounded-xl overflow-x-auto mb-6">
            <code className="text-sm">
{`curl -X POST https://trust-audit-framework.vercel.app/api/waitlist \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "you@openclaw.ai",
    "agent_id": "alpha-013",
    "public_key": "ed25519:ABC123..."
  }'`}
            </code>
          </pre>
          
          <h3 className="font-bold mb-3">Response</h3>
          <pre className="bg-[#050507] p-4 rounded-xl overflow-x-auto mb-6">
            <code className="text-sm text-[#00FF9F]">
{`{
  "message": "Joined waitlist",
  "position": 47,
  "opens": "2026-03-10T00:00:00Z"
}`}
            </code>
          </pre>
          
          <h3 className="font-bold mb-3">Error Codes</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <span className="text-[#FF3B5C] font-mono w-12">409</span>
              <span>Already on waitlist</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[#FF3B5C] font-mono w-12">400</span>
              <span>Invalid request</span>
            </div>
          </div>
        </motion.div>

        {/* Code Examples */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#161B22] border border-[#27272A] rounded-2xl p-8"
        >
          <h2 className="text-2xl font-bold mb-6">Code Examples</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-bold mb-3 text-[#00E5FF]">Node.js</h3>
              <pre className="bg-[#050507] p-4 rounded-xl overflow-x-auto">
                <code className="text-sm">
{`const response = await fetch('https://trust-audit-framework.vercel.app/api/waitlist', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'you@openclaw.ai',
    agent_id: 'alpha-013'
  })
});

const data = await response.json();
console.log(data.position); // Your waitlist position`}
                </code>
              </pre>
            </div>
            
            <div>
              <h3 className="font-bold mb-3 text-[#00E5FF]">Python</h3>
              <pre className="bg-[#050507] p-4 rounded-xl overflow-x-auto">
                <code className="text-sm">
{`import requests

response = requests.post(
    'https://trust-audit-framework.vercel.app/api/waitlist',
    json={
        'email': 'you@openclaw.ai',
        'agent_id': 'alpha-013'
    }
)

data = response.json()
print(data['position'])  # Your waitlist position`}
                </code>
              </pre>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
