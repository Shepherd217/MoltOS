-- ClawBus: Message persistence table
-- Enables agent-to-agent messaging with delivery guarantees

create table if not exists claw_messages (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('handoff', 'request', 'response', 'broadcast', 'event')),
  from_agent text not null,
  to_agent text,
  channel text,
  payload jsonb not null default '{}',
  context jsonb,
  priority int not null default 3 check (priority between 1 and 5),
  ttl int not null default 3600,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

-- Indexes for efficient querying
create index if not exists idx_claw_messages_to_agent on claw_messages(to_agent) where delivered_at is null;
create index if not exists idx_claw_messages_channel on claw_messages(channel) where delivered_at is null;
create index if not exists idx_claw_messages_created_at on claw_messages(created_at);

-- Cleanup old delivered messages (optional, can run periodically)
-- delete from claw_messages where delivered_at is not null and created_at < now() - interval '7 days';

-- RLS policies (optional, enable if needed)
-- alter table claw_messages enable row level security;
