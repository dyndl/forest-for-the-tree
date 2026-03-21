-- Run once in Supabase SQL Editor if advisor reports: RLS Disabled on tree_species_catalog

alter table tree_species_catalog enable row level security;

drop policy if exists "tree_species_catalog_read" on tree_species_catalog;
create policy "tree_species_catalog_read"
  on tree_species_catalog
  for select
  to anon, authenticated
  using (true);
