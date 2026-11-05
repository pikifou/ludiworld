-- Ludiworld : comptes des parents, questionnaire d'essai, synchro du foyer, formules et bureau.
-- Règles (spec/comptes.md, spec/donnees.md) :
--   * le compte appartient au parent ; le foyer synchronisé n'est lisible que par lui, jamais par le bureau ;
--   * personne ne peut changer sa propre formule ni se déclarer administrateur depuis le navigateur ;
--   * ce que le navigateur peut écrire passe par des colonnes ou des fonctions listées ici, rien d'autre.

-- ---------- Formules : aujourd'hui une seule, gratuite ----------
-- Un droit est une clé de `droits`. Ajouter une formule ou déplacer un droit ne demande aucun changement de code.
create table public.formules (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  nom jsonb not null,
  droits jsonb not null default '{}'::jsonb,
  ordre int not null default 0,
  ouverte boolean not null default true
);
insert into public.formules (id, nom, droits) values
  ('gratuit', '{"fr": "Gratuit", "en": "Free"}', '{"synchro": true}');

-- ---------- Le compte du parent ----------
create table public.comptes (
  id uuid primary key references auth.users (id) on delete cascade,
  cree_le timestamptz not null default now(),
  langue text not null default 'fr' check (langue in ('fr', 'en')),
  synchro boolean not null default false,
  nouvelles boolean not null default false
);

-- La formule à part du compte : le parent peut modifier son compte, pas sa formule.
create table public.abonnements (
  compte_id uuid primary key references public.comptes (id) on delete cascade,
  formule_id text not null default 'gratuit' references public.formules (id),
  statut text not null default 'actif' check (statut in ('actif', 'termine')),
  source text not null default 'offert' check (source in ('offert', 'paiement')),
  fin_le timestamptz,
  maj_le timestamptz not null default now()
);

-- ---------- Le questionnaire d'essai : répondu avant le compte, sans identité ----------
create table public.envies (
  id uuid primary key,
  compte_id uuid references public.comptes (id) on delete cascade,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  langue text not null default 'fr' check (langue in ('fr', 'en')),
  envie text[] not null default '{}' check (envie <@ array['jouer', 'aider', 'creer', 'curieux']),
  profil text check (profil in ('parent', 'famille', 'enseignant', 'createur', 'autre')),
  ages text[] not null default '{}' check (ages <@ array['moins6', '6-8', '9-10', '11plus']),
  priorites text[] not null default '{}' check (priorites <@ array['apprendre', 'temps', 'sain', 'plaisir', 'ensemble']),
  experience text check (experience in ('jamais', 'un-peu', 'souvent')),
  message text check (char_length(message) <= 500),
  termine boolean not null default false
);
create index envies_compte on public.envies (compte_id);
create index envies_cree on public.envies (cree_le desc);

-- ---------- Le foyer synchronisé : lisible par son parent seul ----------
create table public.foyers (
  compte_id uuid primary key references public.comptes (id) on delete cascade,
  etat jsonb not null check (pg_column_size(etat) < 512000),
  version bigint not null default 1,
  maj_le timestamptz not null default now()
);

-- ---------- Le bureau : les adresses autorisées ----------
create table public.admins (email text primary key check (email = lower(email)));

-- ---------- Droits d'accès : rien par défaut ----------
alter table public.formules enable row level security;
alter table public.comptes enable row level security;
alter table public.abonnements enable row level security;
alter table public.envies enable row level security;
alter table public.foyers enable row level security;
alter table public.admins enable row level security;

revoke all on public.formules, public.comptes, public.abonnements, public.envies, public.foyers, public.admins from anon, authenticated;

grant select on public.formules to anon, authenticated;
create policy "formules ouvertes" on public.formules for select using (ouverte);

grant select on public.comptes to authenticated;
grant update (langue, nouvelles) on public.comptes to authenticated;
create policy "mon compte" on public.comptes for select to authenticated using (id = (select auth.uid()));
create policy "mon compte, modifier" on public.comptes for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select on public.abonnements to authenticated;
create policy "mon abonnement" on public.abonnements for select to authenticated using (compte_id = (select auth.uid()));

grant select on public.envies to authenticated;
create policy "mes reponses" on public.envies for select to authenticated using (compte_id = (select auth.uid()));

-- ---------- Droits d'une formule ----------
-- Une formule terminée ou échue retombe sur la gratuite.
create function public.a_droit(p_droit text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select (f.droits ->> p_droit)::boolean
    from public.abonnements a
    join public.formules f on f.id = case
      when a.statut = 'actif' and (a.fin_le is null or a.fin_le > now()) then a.formule_id
      else 'gratuit' end
    where a.compte_id = auth.uid()
  ), false)
$$;

create function public.mes_droits() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select jsonb_build_object('formule', f.id, 'nom', f.nom, 'droits', f.droits, 'fin_le', a.fin_le)
    from public.abonnements a
    join public.formules f on f.id = case
      when a.statut = 'actif' and (a.fin_le is null or a.fin_le > now()) then a.formule_id
      else 'gratuit' end
    where a.compte_id = auth.uid()
  ), '{}'::jsonb)
$$;

grant select, insert, update, delete on public.foyers to authenticated;
create policy "mon foyer, lire" on public.foyers for select to authenticated using (compte_id = (select auth.uid()));
create policy "mon foyer, effacer" on public.foyers for delete to authenticated using (compte_id = (select auth.uid()));
-- Écrire demande le droit « synchro » et la synchro activée : lire et effacer restent toujours possibles.
create policy "mon foyer, ajouter" on public.foyers for insert to authenticated with check (
  compte_id = (select auth.uid()) and (select public.a_droit('synchro'))
  and exists (select 1 from public.comptes c where c.id = (select auth.uid()) and c.synchro));
create policy "mon foyer, modifier" on public.foyers for update to authenticated
  using (compte_id = (select auth.uid()))
  with check (compte_id = (select auth.uid()) and (select public.a_droit('synchro'))
    and exists (select 1 from public.comptes c where c.id = (select auth.uid()) and c.synchro));

-- ---------- Un nouveau compte ----------
-- Les préférences arrivent par les métadonnées de l'inscription : on ne s'y fie que pour ces trois valeurs, validées.
create function public.nouveau_compte() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.comptes (id, langue, nouvelles)
    values (new.id, case when m ->> 'langue' = 'en' then 'en' else 'fr' end, coalesce(m ->> 'nouvelles' = 'true', false));
  insert into public.abonnements (compte_id) values (new.id);
  if m ->> 'envie_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    update public.envies set compte_id = new.id, maj_le = now()
      where id = (m ->> 'envie_id')::uuid and compte_id is null;
  end if;
  return new;
end $$;
create trigger nouveau_compte after insert on auth.users for each row execute function public.nouveau_compte();

-- ---------- Le questionnaire ----------
-- Accessible sans compte : enregistre au fil des questions pour savoir où l'on s'arrête.
-- Une réponse déjà rattachée à un compte ne se modifie plus que par ce compte.
create function public.enregistrer_envie(
  p_id uuid, p_langue text default 'fr', p_envie text[] default '{}', p_profil text default null,
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
  insert into public.envies as e (id, compte_id, langue, envie, profil, ages, priorites, experience, message, termine)
    values (p_id, auth.uid(), p_langue, p_envie, p_profil, p_ages, p_priorites, p_experience, nullif(btrim(p_message), ''), p_termine)
  on conflict (id) do update set
    compte_id = coalesce(e.compte_id, excluded.compte_id), langue = excluded.langue, envie = excluded.envie, profil = excluded.profil, ages = excluded.ages,
    priorites = excluded.priorites, experience = excluded.experience, message = excluded.message,
    termine = excluded.termine, maj_le = now()
  where e.compte_id is null or e.compte_id = auth.uid();
end $$;

-- Quelqu'un qui a répondu puis se connecte à un compte existant.
create function public.rattacher_envie(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.envies set compte_id = auth.uid(), maj_le = now()
    where id = p_id and compte_id is null and auth.uid() is not null
$$;

-- ---------- La synchro ----------
-- Couper la synchro efface la copie en ligne : l'appareil garde la sienne.
create function public.poser_synchro(p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'connexion requise' using errcode = '28000'; end if;
  if p_active and not public.a_droit('synchro') then raise exception 'droit manquant' using errcode = '42501'; end if;
  update public.comptes set synchro = p_active where id = auth.uid();
  if not p_active then delete from public.foyers where compte_id = auth.uid(); end if;
end $$;

-- Écrit le foyer si personne d'autre ne l'a changé depuis p_version (0 : pas encore en ligne).
-- Renvoie la nouvelle version, ou null s'il faut relire et refusionner.
-- Les droits d'écriture sont ceux des règles ci-dessus (security invoker).
create function public.pousser_foyer(p_etat jsonb, p_version bigint) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  v bigint;
begin
  if p_version = 0 then
    insert into public.foyers (compte_id, etat) values (auth.uid(), p_etat)
      on conflict (compte_id) do nothing returning version into v;
  else
    update public.foyers set etat = p_etat, version = version + 1, maj_le = now()
      where compte_id = auth.uid() and version = p_version returning version into v;
  end if;
  return v;
end $$;

-- ---------- Tout effacer d'un geste ----------
-- Les réponses, le foyer, l'abonnement partent avec le compte (on delete cascade).
create function public.effacer_mon_compte() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'connexion requise' using errcode = '28000'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ---------- Le bureau ----------
-- Une adresse confirmée seulement : s'inscrire avec l'adresse d'un administrateur sans la confirmer ne donne rien.
create function public.est_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u join public.admins a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null)
$$;

create function public.exiger_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.est_admin() then raise exception 'reserve au bureau' using errcode = '42501'; end if;
end $$;

-- Les chiffres. Le contenu des foyers (pseudos, temps de jeu) n'y est pas et n'a pas à y être.
create function public.bureau_apercu() returns jsonb
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
        union all select 'profil', profil from e where profil is not null
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

create function public.bureau_envies(p_limite int default 200, p_decalage int default 0)
returns table (id uuid, cree_le timestamptz, langue text, envie text[], profil text, ages text[], priorites text[],
               experience text, message text, termine boolean, email text, nouvelles boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return query
    select e.id, e.cree_le, e.langue, e.envie, e.profil, e.ages, e.priorites, e.experience, e.message, e.termine,
           u.email::text, c.nouvelles
    from public.envies e
    left join public.comptes c on c.id = e.compte_id
    left join auth.users u on u.id = e.compte_id
    order by e.cree_le desc limit least(p_limite, 1000) offset p_decalage;
end $$;

create function public.bureau_comptes(p_recherche text default null, p_limite int default 200, p_decalage int default 0)
returns table (id uuid, email text, cree_le timestamptz, confirme_le timestamptz, derniere_connexion timestamptz,
               formule text, statut text, synchro boolean, nouvelles boolean, envie text[], profil text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return query
    select c.id, u.email::text, c.cree_le, u.email_confirmed_at, u.last_sign_in_at, a.formule_id, a.statut, c.synchro, c.nouvelles,
           e.envie, e.profil
    from public.comptes c
    join auth.users u on u.id = c.id
    left join public.abonnements a on a.compte_id = c.id
    left join lateral (select x.envie, x.profil from public.envies x where x.compte_id = c.id order by x.cree_le desc limit 1) e on true
    where p_recherche is null or u.email ilike '%' || replace(replace(p_recherche, '%', '\%'), '_', '\_') || '%'
    order by c.cree_le desc limit least(p_limite, 1000) offset p_decalage;
end $$;

-- ---------- Qui peut appeler quoi ----------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.enregistrer_envie(uuid, text, text[], text, text[], text[], text, text, boolean) to anon, authenticated;
grant execute on function public.rattacher_envie(uuid), public.poser_synchro(boolean), public.pousser_foyer(jsonb, bigint),
  public.effacer_mon_compte(), public.mes_droits(), public.a_droit(text), public.est_admin(),
  public.bureau_apercu(), public.bureau_envies(int, int), public.bureau_comptes(text, int, int) to authenticated;
