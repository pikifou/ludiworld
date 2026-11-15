-- Le bouton d'inscription annonce la synchronisation. Les comptes existants gardent leur choix.
create or replace function public.nouveau_compte() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.comptes (id, langue, nouvelles, synchro)
    values (new.id, case when m ->> 'langue' = 'en' then 'en' else 'fr' end,
      coalesce(m ->> 'nouvelles' = 'true', false), coalesce(m ->> 'synchro' = 'true', false));
  insert into public.abonnements (compte_id) values (new.id);
  if m ->> 'envie_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    update public.envies set compte_id = new.id, maj_le = now()
      where id = (m ->> 'envie_id')::uuid and compte_id is null;
  end if;
  return new;
end $$;
revoke all on function public.nouveau_compte() from public, anon, authenticated;
