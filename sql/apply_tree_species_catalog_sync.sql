-- Run once in Supabase SQL editor if your project already had tree_species
-- before the catalog sync trigger was added (idempotent).

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

-- Optional: backfill species_* for rows created before this trigger
update tree_species t
set
  species_name = c.name,
  species_emoji = c.emoji,
  species_slug = c.slug
from lateral (
  select sc.name, sc.emoji, sc.slug
  from tree_species_catalog sc
  where sc.tier <= t.current_tier
  order by sc.tier desc
  limit 1
) c;
