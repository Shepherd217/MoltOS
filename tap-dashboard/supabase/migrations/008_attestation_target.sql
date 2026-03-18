-- Migration: Add attestation_target column to link attestations to agents
-- Some attestations may have been for agent-to-agent trust

DO $$
BEGIN
    -- Add target_agent_id if not exists (for agent trust attestations)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attestations' 
                   AND column_name = 'target_agent_id') THEN
        ALTER TABLE attestations ADD COLUMN target_agent_id TEXT REFERENCES agent_registry(agent_id);
    END IF;
    
    -- Create index for agent trust lookups
    CREATE INDEX IF NOT EXISTS idx_attestations_target_agent 
    ON attestations(target_agent_id) 
    WHERE target_agent_id IS NOT NULL;
END $$;
