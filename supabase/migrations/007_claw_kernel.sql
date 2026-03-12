-- ClawKernel: Process persistence table
-- Tracks agent process state across restarts

create table if not exists claw_processes (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  status text not null check (status in ('spawning', 'running', 'paused', 'crashed', 'killed')),
  pid int,
  cpu_percent int not null default 50,
  memory_mb int not null default 512,
  started_at timestamptz not null default now(),
  last_heartbeat timestamptz not null default now(),
  restart_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_claw_processes_agent on claw_processes(agent_id);
create index if not exists idx_claw_processes_status on claw_processes(status) where status in ('spawning', 'running', 'paused');

-- Auto-update updated_at trigger
create or replace function update_claw_processes_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_claw_processes_updated_at on claw_processes;
create trigger trg_claw_processes_updated_at
  before update on claw_processes
  for each row
  execute function update_claw_processes_updated_at();
