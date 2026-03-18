-- ═══════════════════════════════════════════════════════════════
-- Forest for the Trees — Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- TASKS
create table if not exists tasks (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  name text not null,
  q text not null default 'do',         -- do | schedule | delegate | eliminate
  cat text not null default 'admin',    -- career | interview | learning | fitness | family | admin | finance
  blocks integer not null default 2,
  who text not null default 'me',       -- me | team | delegated
  notes text default '',
  done boolean not null default false,
  date text not null,                   -- YYYY-MM-DD
  source text default 'manual',        -- manual | gmail | calendar | coo
  google_task_id text,
  created_at timestamptz default now()
);
create index if not exists tasks_user_date on tasks(user_id, date);

-- SCHEDULES
create table if not exists schedules (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  date text not null,
  stale boolean default false,
  coo_message text,
  energy_read text,
  top_3_mits jsonb default '[]',
  eliminated jsonb default '[]',
  slots jsonb not null default '[]',
  calendar_events jsonb default '[]',
  email_summary jsonb default '[]',
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- AGENTS
create table if not exists agents (
  id text primary key,
  user_id text not null,
  name text not null,
  icon text default '🤖',
  area text default 'admin',
  prompt text not null,
  custom_prompt text,
  score integer default 50,
  runs integer default 0,
  streak integer default 0,
  status text default 'idle',           -- idle | thinking | ok | alert
  output text default '',
  alert text default '',
  last_run timestamptz,
  created_at timestamptz default now(),
  unique(id, user_id)
);

-- RETROS
create table if not exists retros (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  date text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- USER PROFILES (roadmap, preferences)
create table if not exists user_profiles (
  user_id text primary key,
  roadmap text default 'Land a DS/ML role in 4 weeks',
  energy_default text default 'medium',
  focus_start text default '08:00',
  focus_end text default '10:00',
  focus_start2 text default '14:00',
  focus_end2 text default '16:00',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- USER TOKENS (for cron jobs that need Google access without active session)
create table if not exists user_tokens (
  user_id text primary key,
  access_token text,
  refresh_token text,
  expires_at bigint,
  updated_at timestamptz default now()
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
alter table tasks enable row level security;
alter table schedules enable row level security;
alter table agents enable row level security;
alter table retros enable row level security;
alter table user_profiles enable row level security;
alter table user_tokens enable row level security;

-- Service role bypasses RLS (used by server-side API routes)
-- The anon key is only used client-side and should be locked down
-- For this app all DB access goes through server API routes using service role key

-- Done! Your schema is ready.

-- RELATIONSHIP CACHE (Google Contacts data, refreshed every 6h)
create table if not exists relationship_cache (
  user_id text primary key,
  contacts jsonb default '[]',
  overdue jsonb default '[]',
  birthdays jsonb default '[]',
  updated_at timestamptz default now()
);

-- RELATIONSHIP BRIEFS (COO-generated pulse notes)
create table if not exists relationship_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  date date not null,
  brief jsonb,
  weekly boolean default false,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- CONNECTOR REGISTRY (extensible integration layer for future APIs)
create table if not exists connectors (
  id text not null,
  user_id text not null,
  name text not null,
  type text not null, -- 'oauth' | 'api_key' | 'webhook'
  provider text not null, -- 'plaid' | 'oura' | 'strava' | 'whoop' etc
  credentials jsonb default '{}', -- encrypted at app level before storing
  scopes text[] default '{}',
  enabled boolean default true,
  last_sync timestamptz,
  last_error text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  primary key(id, user_id)
);

-- USER CONTEXT (COO memory — updated after each retro)
create table if not exists user_context (
  user_id text primary key,
  roadmap text default 'Land a DS/ML role in 4 weeks',
  peak_hours text default '8-10am, 2-4pm',
  energy_default text default 'medium',
  adhd_patterns text[] default '{}', -- e.g. ['avoidance', 'context-switching']
  known_blockers text[] default '{}',
  financial_goals text[] default '{}',
  relationship_tiers jsonb default '{}', -- { "Name": "close|friend|acquaintance" }
  weekly_time_budget jsonb default '{}', -- { "career": 300, "fitness": 90, ... }
  coo_notes text default '', -- running notes the COO adds about you
  updated_at timestamptz default now()
);

-- RLS for new tables
alter table relationship_cache enable row level security;
alter table relationship_briefs enable row level security;
alter table connectors enable row level security;
alter table user_context enable row level security;

create policy "users own relationship_cache" on relationship_cache for all using (user_id = current_user);
create policy "users own relationship_briefs" on relationship_briefs for all using (user_id = current_user);
create policy "users own connectors" on connectors for all using (user_id = current_user);
create policy "users own user_context" on user_context for all using (user_id = current_user);

-- MEDIA UPLOADS (voice memos, images, files)
create table if not exists media_uploads (
  id text primary key,
  user_id text not null,
  filename text,
  mime_type text,
  size_mb numeric,
  agent_id text,
  context text default '',
  type text default 'document', -- 'audio' | 'image' | 'pdf' | 'document'
  transcript text,
  analysis text,
  extracted_ideas jsonb,
  duration_seconds integer,
  segments jsonb default '[]',
  error text,
  created_at timestamptz default now()
);
create index if not exists media_user on media_uploads(user_id, created_at desc);
create index if not exists media_agent on media_uploads(user_id, agent_id);

-- AGENT CONTEXT (media and notes attached to specific agents)
create table if not exists agent_context (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  agent_id text not null,
  source_type text, -- 'audio' | 'image' | 'note' | 'pdf'
  source_id text,
  filename text,
  content text,
  created_at timestamptz default now(),
  unique(user_id, agent_id, source_id)
);
create index if not exists agent_context_idx on agent_context(user_id, agent_id);

-- RLS
alter table media_uploads enable row level security;
alter table agent_context enable row level security;
create policy "users own media" on media_uploads for all using (user_id = current_user);
create policy "users own agent_context" on agent_context for all using (user_id = current_user);
