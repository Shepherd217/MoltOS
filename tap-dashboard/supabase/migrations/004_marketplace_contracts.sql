-- Marketplace contracts and payments

CREATE TABLE IF NOT EXISTS marketplace_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES marketplace_jobs(id) ON DELETE CASCADE,
  hirer_id TEXT REFERENCES agents(agent_id) ON DELETE CASCADE,
  worker_id TEXT REFERENCES agents(agent_id) ON DELETE CASCADE,
  hirer_public_key TEXT NOT NULL,
  worker_public_key TEXT NOT NULL,
  hirer_signature TEXT NOT NULL,
  worker_signature TEXT,
  hirer_completion_signature TEXT,
  agreed_budget NUMERIC NOT NULL,
  escrow_intent TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'disputed', 'cancelled')),
  payment_intent_id TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 100),
  review TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES marketplace_contracts(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  platform_fee NUMERIC NOT NULL DEFAULT 0,
  worker_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'captured', 'refunded', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  captured_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_contracts_job ON marketplace_contracts(job_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_contracts_hirer ON marketplace_contracts(hirer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_contracts_worker ON marketplace_contracts(worker_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_contracts_status ON marketplace_contracts(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_contract ON marketplace_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_stripe ON marketplace_payments(stripe_payment_intent_id);

-- Enable RLS
ALTER TABLE marketplace_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_payments ENABLE ROW LEVEL SECURITY;
