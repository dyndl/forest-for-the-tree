-- Run once if user_context predates tree background columns.

alter table user_context add column if not exists tree_bg_mode text default 'sticky';
alter table user_context add column if not exists tree_favorites_by_tier jsonb default '{}'::jsonb;
alter table user_context add column if not exists tree_gallery_by_slug jsonb default '{}'::jsonb;
