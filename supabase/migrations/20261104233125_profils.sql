-- « Vous êtes plutôt… » accepte plusieurs réponses : le profil devient une liste, comme l'envie et les âges.
alter table public.envies
  add column profils text[] not null default '{}' check (profils <@ array['parent', 'famille', 'enseignant', 'createur', 'autre']);
update public.envies set profils = array[profil] where profil is not null;
alter table public.envies drop column profil;

drop function public.enregistrer_envie(uuid, text, text[], text, text[], text[], text, text, boolean);
create function public.enregistrer_envie(
  p_id uuid, p_langue text default 'fr', p_envie text[] default '{}', p_profils text[] default '{}',
  p_ages text[] default '{}', p_priorites text[] default '{}', p_experience text default null,
  p_message text default null, p_termine boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Garde-fou contre un remplissage automatique : le questionnaire ne reçoit jamais autant de nouvelles réponses d'un coup.
  if not exists (select 1 from public.envies where id = p_id)
     and (select count(*) from public.envies where cree_le > now() - interval '1 minute') >= 60 then
    raise exception 'trop de reponses' using errcode = 'P0001';
  end if;
  -- Quelqu'un de connecté répond en son nom : ses réponses partiront avec son compte s'il l'efface.
  insert into public.envies as e (id, compte_id, langue, envie, profils, ages, priorites, experience, message, termine)
    values (p_id, auth.uid(), p_langue, p_envie, p_profils, p_ages, p_priorites, p_experience, nullif(btrim(p_message), ''), p_termine)
  on conflict (id) do update set
    compte_id = coalesce(e.compte_id, excluded.compte_id), langue = excluded.langue, envie = excluded.envie, profils = excluded.profils, ages = excluded.ages,
    priorites = excluded.priorites, experience = excluded.experience, message = excluded.message,
    termine = excluded.termine, maj_le = now()
  where e.compte_id is null or e.compte_id = auth.uid();
end $$;

create or replace function public.bureau_apercu() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
begin
  perform public.exiger_admin();
  with
    e as (select * from public.envies),
    c as (select c.*, u.email_confirmed_at, u.last_sign_in_at from public.comptes c join auth.users u on u.id = c.id),
    compte_tableau as (
      select champ, valeur, count(*) as n from (
        select 'envie' as champ, unnest(envie) as valeur from e
        union all select 'ages', unnest(ages) from e
        union all select 'priorites', unnest(priorites) from e
        union all select 'profils', unnest(profils) from e
        union all select 'experience', experience from e where experience is not null
      ) x group by champ, valeur
    )
  select jsonb_build_object(
    'parcours', jsonb_build_object(
      'commences', (select count(*) from e),
      'termines', (select count(*) from e where termine),
      'rattaches', (select count(*) from e where compte_id is not null),
      'comptes', (select count(*) from c),
      'confirmes', (select count(*) from c where email_confirmed_at is not null),
      'actifs_7j', (select count(*) from c where last_sign_in_at > now() - interval '7 days'),
      'synchro', (select count(*) from c where synchro),
      'nouvelles', (select count(*) from c where nouvelles)
    ),
    'reponses', coalesce((select jsonb_object_agg(champ, v) from (
      select champ, jsonb_object_agg(valeur, n) as v from compte_tableau group by champ) t), '{}'::jsonb),
    'semaines', coalesce((select jsonb_agg(s order by s ->> 'semaine') from (
      select jsonb_build_object('semaine', to_char(d, 'YYYY-MM-DD'),
        'envies', (select count(*) from e where date_trunc('week', e.cree_le) = d),
        'comptes', (select count(*) from c where date_trunc('week', c.cree_le) = d)) as s
      from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') d
    ) t), '[]'::jsonb),
    'formules', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nom', f.nom, 'droits', f.droits, 'ouverte', f.ouverte,
      'comptes', (select count(*) from public.abonnements a where a.formule_id = f.id)) order by f.ordre) from public.formules f), '[]'::jsonb)
  ) into r;
  return r;
end $$;

drop function public.bureau_envies(int, int);
create function public.bureau_envies(p_limite int default 200, p_decalage int default 0)
returns table (id uuid, cree_le timestamptz, langue text, envie text[], profils text[], ages text[], priorites text[],
               experience text, message text, termine boolean, email text, nouvelles boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return query
    select e.id, e.cree_le, e.langue, e.envie, e.profils, e.ages, e.priorites, e.experience, e.message, e.termine,
           u.email::text, c.nouvelles
    from public.envies e
    left join public.comptes c on c.id = e.compte_id
    left join auth.users u on u.id = e.compte_id
    order by e.cree_le desc limit least(p_limite, 1000) offset p_decalage;
end $$;

drop function public.bureau_comptes(text, int, int);
create function public.bureau_comptes(p_recherche text default null, p_limite int default 200, p_decalage int default 0)
returns table (id uuid, email text, cree_le timestamptz, confirme_le timestamptz, derniere_connexion timestamptz,
               formule text, statut text, synchro boolean, nouvelles boolean, envie text[], profils text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return query
    select c.id, u.email::text, c.cree_le, u.email_confirmed_at, u.last_sign_in_at, a.formule_id, a.statut, c.synchro, c.nouvelles,
           e.envie, e.profils
    from public.comptes c
    join auth.users u on u.id = c.id
    left join public.abonnements a on a.compte_id = c.id
    left join lateral (select x.envie, x.profils from public.envies x where x.compte_id = c.id order by x.cree_le desc limit 1) e on true
    where p_recherche is null or u.email ilike '%' || replace(replace(p_recherche, '%', '\%'), '_', '\_') || '%'
    order by c.cree_le desc limit least(p_limite, 1000) offset p_decalage;
end $$;

-- Une fonction recréée repart avec les droits par défaut : les remettre comme avant.
revoke all on function public.enregistrer_envie(uuid, text, text[], text[], text[], text[], text, text, boolean),
  public.bureau_envies(int, int), public.bureau_comptes(text, int, int) from public, anon, authenticated;
grant execute on function public.enregistrer_envie(uuid, text, text[], text[], text[], text[], text, text, boolean) to anon, authenticated;
grant execute on function public.bureau_envies(int, int), public.bureau_comptes(text, int, int) to authenticated;
