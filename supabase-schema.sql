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

-- Onboarding fields (app uses these — must exist before finish() can save)
alter table user_context add column if not exists integration_tier text default 'google';
alter table user_context add column if not exists addons jsonb default '[]'::jsonb;
alter table user_context add column if not exists outline text default '';
alter table user_context add column if not exists life_areas jsonb default '[]'::jsonb;
alter table user_context add column if not exists adhd_aware boolean default false;
alter table user_context add column if not exists onboarding_complete boolean default false;
alter table user_context add column if not exists notification_prefs jsonb default '{
  "morning_brief": true,
  "midday_checkin": true,
  "afternoon_checkin": true,
  "evening_retro": true,
  "urgent_alerts": true,
  "weekly_review": true,
  "birthday_alerts": true
}'::jsonb;

-- OpenAI key for Whisper (user-supplied, optional)
alter table user_context add column if not exists openai_api_key text default null;

-- Rhythm notes — free-form energy/schedule context for COO adaptation
alter table user_context add column if not exists rhythm_notes text default '';

-- Life tree background preferences (see /api/tree + settings)
alter table user_context add column if not exists tree_bg_mode text default 'sticky';
alter table user_context add column if not exists tree_favorites_by_tier jsonb default '{}'::jsonb;
alter table user_context add column if not exists tree_gallery_by_slug jsonb default '{}'::jsonb;
alter table user_context add column if not exists voice_keyterms jsonb default '[]'::jsonb;

-- COO onboarding boot: approved background proposals + relationship seed names
alter table user_context add column if not exists background_proposals jsonb default '[]'::jsonb;
alter table user_context add column if not exists relationship_seeds text default '';

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

-- ═══════════════════════════════════════════════════════════════════════════
-- LIFE TREE (TreeView) — user_id is NextAuth email (text), same as tasks / agents
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists tree_species (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  birth_year int not null default 1990,
  current_tier int not null default 1,
  species_name text not null default 'Bonsai',
  species_slug text not null default 'bonsai',
  species_emoji text not null default '🌿',
  height_xp int not null default 0,
  width_xp int not null default 0,
  root_bonus_xp int not null default 0,
  arborist_score int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

create table if not exists tree_branches (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  label text not null,
  start_year int not null,
  end_year int,
  state text not null default 'growing'
    check (state in (
      'growing','stunted','done','dormant',
      'pruned','storm-fell','fractured','blighted','atrophied','severed'
    )),
  side int not null default 1 check (side in (1, -1)),
  depth_factor numeric not null default 3,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tree_fruits (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  branch_id uuid not null references tree_branches(id) on delete cascade,
  year int not null,
  label text not null,
  emoji text not null default '🍏',
  xp_value int not null default 80,
  validated bool not null default false,
  created_at timestamptz default now()
);

create table if not exists tree_roots (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  label text not null,
  origin_year int not null,
  years_ago int not null,
  score int not null default 3 check (score between 1 and 8),
  depth_factor numeric not null default 3,
  angle int not null default 20,
  side int not null default 1 check (side in (1, -1)),
  created_at timestamptz default now()
);

create table if not exists tree_rings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  year int not null,
  ring_width int not null default 8,
  chapter text,
  score int not null default 3 check (score between 1 and 8),
  created_at timestamptz default now(),
  unique(user_id, year)
);

create table if not exists tree_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  score int not null default 5 check (score between 1 and 8),
  side text not null default 'left' check (side in ('left', 'right')),
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table if not exists tree_legacies (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  label text not null,
  branch_id uuid references tree_branches(id) on delete set null,
  side int not null default 1 check (side in (1, -1)),
  target_year int,
  created_at timestamptz default now()
);

create table if not exists tree_xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source text not null,
  source_id uuid,
  h_xp_delta int not null default 0,
  w_xp_delta int not null default 0,
  note text,
  created_at timestamptz default now()
);

alter table tree_species enable row level security;
alter table tree_branches enable row level security;
alter table tree_fruits enable row level security;
alter table tree_roots enable row level security;
alter table tree_rings enable row level security;
alter table tree_relationships enable row level security;
alter table tree_legacies enable row level security;
alter table tree_xp_events enable row level security;

create policy "tree_species_own" on tree_species for all using (user_id = current_user) with check (user_id = current_user);
create policy "tree_branches_own" on tree_branches for all using (user_id = current_user) with check (user_id = current_user);
create policy "tree_fruits_own" on tree_fruits for all using (user_id = current_user) with check (user_id = current_user);
create policy "tree_roots_own" on tree_roots for all using (user_id = current_user) with check (user_id = current_user);
create policy "tree_rings_own" on tree_rings for all using (user_id = current_user) with check (user_id = current_user);
create policy "tree_relationships_own" on tree_relationships for all using (user_id = current_user) with check (user_id = current_user);
create policy "tree_legacies_own" on tree_legacies for all using (user_id = current_user) with check (user_id = current_user);
create policy "tree_xp_events_own" on tree_xp_events for all using (user_id = current_user) with check (user_id = current_user);

create index if not exists idx_tree_branches_user on tree_branches(user_id);
create index if not exists idx_tree_fruits_branch on tree_fruits(branch_id);
create index if not exists idx_tree_rings_user_year on tree_rings(user_id, year desc);
create index if not exists idx_tree_roots_user on tree_roots(user_id);
create index if not exists idx_tree_relationships_user on tree_relationships(user_id);
create index if not exists idx_tree_legacies_user on tree_legacies(user_id);
create index if not exists idx_tree_xp_user on tree_xp_events(user_id, created_at desc);

create or replace function tree_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tree_species_updated_at on tree_species;
create trigger tree_species_updated_at
  before update on tree_species
  for each row execute function tree_set_updated_at();

drop trigger if exists tree_branches_updated_at on tree_branches;
create trigger tree_branches_updated_at
  before update on tree_branches
  for each row execute function tree_set_updated_at();

create or replace function compute_tier_xp(tier int, height_ft numeric, width_ft numeric)
returns table (h_xp int, w_xp int) language plpgsql as $$
begin
  return query select
    round(18 * power(tier, 1.6) * power(height_ft / 90.0, 0.55))::int,
    round(12 * power(tier, 1.6) * power(least(width_ft, 50.0) / 8.0, 0.55))::int;
end;
$$;

create table if not exists tree_species_catalog (
  tier int primary key,
  name text not null,
  emoji text not null,
  slug text not null,
  tier_group int not null,
  group_name text not null,
  width_ft numeric not null,
  height_ft numeric not null,
  fact text,
  exemplar text
);

insert into tree_species_catalog values
  (1,  'Bonsai',          '🌿', 'bonsai',          1, 'Miniatures',        0.25,  2,  'Cultivated for centuries. Every branch a deliberate choice.',          'Thoreau — deliberate'),
  (2,  'Japanese Maple',  '🍁', 'japanese-maple',   1, 'Miniatures',        1,    22,  'Prized 300 years in Japanese gardens.',                               'Kintsugi — repair'),
  (8,  'Apple/Pear',      '🍎', 'apple-pear',       1, 'Miniatures',        1.5,  25,  'First cultivated 4,000 years ago.',                                   'Johnny Appleseed'),
  (9,  'Cherry',          '🌸', 'cherry',           1, 'Miniatures',        1.5,  25,  'Blooms two weeks per year.',                                           'Hokusai'),
  (11, 'Bamboo',          '🎋', 'bamboo',           2, 'Slender Adaptors',  0.5,  60,  'Grows 35 inches per day.',                                            'Early Bezos'),
  (16, 'Aspen',           '🍂', 'aspen',            2, 'Slender Adaptors',  1.5,  60,  'Pando: 47,000 stems, one root system.',                               'Networked entrepreneur'),
  (17, 'Birch',           '🌿', 'birch',            2, 'Slender Adaptors',  1.5,  60,  'First to colonise bare ground after glaciers.',                       'Sylvia Plath'),
  (21, 'Dragon Blood',    '🩸', 'dragon-blood',     3, 'Rare & Specialized',4,    30,  'Found only on Socotra Island. Bleeds crimson sap.',                   'Rare polymaths'),
  (24, 'Ginkgo',          '🍃', 'ginkgo',           3, 'Rare & Specialized',3,    80,  '270 million year old species.',                                       'Darwin'),
  (25, 'Bristlecone',     '🌲', 'bristlecone',      3, 'Rare & Specialized',3,    30,  'Methuselah: 4,855 years old.',                                        'Buffett & Munger'),
  (34, 'Olive',           '🫒', 'olive',            4, 'Core Forest',       3,    25,  'Trees in Gethsemane 2,000+ years old.',                               'Confucius'),
  (42, 'Cedar',           '🌲', 'cedar',            4, 'Core Forest',       4,    70,  'Solomon''s Temple built from Lebanese Cedar.',                        'Marcus Aurelius'),
  (45, 'Pine',            '🌲', 'pine',             4, 'Core Forest',       4,   175,  'Sequestered carbon for 300 million years.',                           'Einstein'),
  (51, 'Oak',             '🌳', 'oak',              5, 'Canopy Kings',      8,    90,  'Hosts 500+ species. Lives 1,000 years.',                              'Warren Buffett'),
  (54, 'Sycamore',        '🌳', 'sycamore',         5, 'Canopy Kings',      9,   100,  'Peeling bark reveals new face each season.',                          'Shakespeare'),
  (58, 'Douglas-fir',     '🌲', 'douglas-fir',      5, 'Canopy Kings',     15,   250,  'Some live 1,500 years, grow 250ft.',                                  'Da Vinci'),
  (62, 'Coast Redwood',   '🌲', 'redwood',          6, 'Titans',           25,   380,  'Tallest living thing at 380ft.',                                      'Einstein/Darwin'),
  (63, 'Giant Sequoia',   '🌲', 'sequoia',          6, 'Titans',           30,   275,  'General Sherman: largest organism by volume.',                        'Newton/Shakespeare'),
  (66, 'Banyan',          '🌳', 'banyan',           6, 'Titans',          500,    80,  'Great Banyan covers 3.5 acres.',                                      'Gandhi/Buddha'),
  (69, 'World Tree',      '🌍', 'world-tree',       6, 'Titans',          999,   999,  'Yggdrasil: the cosmic tree connecting nine worlds.',                  'Humanity')
on conflict (tier) do nothing;

-- Reference data only (no per-user rows). RLS on + world-readable SELECT satisfies Supabase advisor.
alter table tree_species_catalog enable row level security;
drop policy if exists "tree_species_catalog_read" on tree_species_catalog;
create policy "tree_species_catalog_read"
  on tree_species_catalog
  for select
  to anon, authenticated
  using (true);

-- When current_tier changes (or row is created), copy display fields from the catalog tier
-- that best matches: greatest catalog.tier <= user tier (handles sparse tier rows).
create or replace function tree_species_sync_from_catalog()
returns trigger language plpgsql as $$
declare
  v_name  text;
  v_emoji text;
  v_slug  text;
begin
  if tg_op = 'UPDATE' and new.current_tier is not distinct from old.current_tier then
    return new;
  end if;

  select c.name, c.emoji, c.slug into v_name, v_emoji, v_slug
  from tree_species_catalog c
  where c.tier <= new.current_tier
  order by c.tier desc
  limit 1;

  if v_slug is not null then
    new.species_name := v_name;
    new.species_emoji := v_emoji;
    new.species_slug := v_slug;
  end if;

  return new;
end;
$$;

drop trigger if exists tree_species_sync_from_catalog on tree_species;
create trigger tree_species_sync_from_catalog
  before insert or update of current_tier on tree_species
  for each row execute function tree_species_sync_from_catalog();
