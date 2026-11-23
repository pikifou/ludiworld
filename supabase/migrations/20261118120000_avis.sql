-- Les avis de parents (plan 5, validé par Julien le 2026-11-18).
-- Trois questions fermées, pas de note, pas d'étoile, pas de moyenne. Un mot libre facultatif, lu par Julien avant d'être montré.
-- Règles :
--   * un avis par compte et par jeu, modifiable ; le compte écrit et relit le sien seulement, et peut le retirer ;
--   * le public ne lit que des totaux par jeu et par réponse, et seulement à partir de 5 avis ; jamais la table elle-même ;
--   * un mot libre n'est lisible par le public qu'une fois accepté dans le bureau ; changer son mot le remet à relire ;
--   * « Dites quoi » (quand la fiche ne dit pas tout à fait vrai) n'est jamais public : il sert à corriger la fiche ;
--   * le bureau lit tout, sans adresse e-mail, et accepte ou refuse un mot libre.
-- Ce qui n'est pas vérifié ici : les 30 minutes de jeu (le temps est mesuré par l'appli, sur l'appareil). Voir spec/comptes.md.

create table public.avis (
  compte_id uuid not null references public.comptes (id) on delete cascade,
  jeu text not null check (jeu ~ '^[a-z0-9-]{1,60}$'),
  marche text not null check (marche in ('oui', 'pas-toujours', 'non')),
  fiche text not null check (fiche in ('oui', 'pas-tout-a-fait')),
  fiche_quoi text check (char_length(fiche_quoi) <= 300),
  retourne text not null check (retourne in ('oui', 'parfois', 'non')),
  mot text check (char_length(mot) <= 400),
  mot_etat text check (mot_etat in ('a-relire', 'accepte', 'refuse')),
  mot_relu_le timestamptz,
  langue text not null default 'fr' check (langue in ('fr', 'en')),
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  primary key (compte_id, jeu),
  check ((mot is null) = (mot_etat is null)),
  check (fiche_quoi is null or fiche = 'pas-tout-a-fait')
);
create index avis_jeu on public.avis (jeu);
create index avis_a_relire on public.avis (maj_le) where mot_etat = 'a-relire';

-- ---------- Droits d'accès : rien par défaut ----------
alter table public.avis enable row level security;
revoke all on public.avis from anon, authenticated;

-- Le parent relit et retire le sien. Il n'écrit que par donner_avis (qui pose l'état de relecture lui-même).
grant select, delete on public.avis to authenticated;
create policy "mon avis, lire" on public.avis for select to authenticated using (compte_id = (select auth.uid()));
create policy "mon avis, retirer" on public.avis for delete to authenticated using (compte_id = (select auth.uid()));

-- ---------- Donner ou changer son avis ----------
create function public.donner_avis(
  p_jeu text, p_marche text, p_fiche text, p_retourne text,
  p_mot text default null, p_fiche_quoi text default null, p_langue text default 'fr'
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m text := nullif(btrim(p_mot), '');
  q text := case when p_fiche = 'pas-tout-a-fait' then nullif(btrim(p_fiche_quoi), '') end;
begin
  if auth.uid() is null then raise exception 'connexion requise' using errcode = '28000'; end if;
  if not exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null) then
    raise exception 'adresse a confirmer' using errcode = '42501';
  end if;
  -- Garde-fou : un compte ne donne pas d'avis sur des dizaines de jeux d'un coup.
  if not exists (select 1 from public.avis where compte_id = auth.uid() and jeu = p_jeu)
     and (select count(*) from public.avis where compte_id = auth.uid()) >= 50 then
    raise exception 'trop d''avis' using errcode = 'P0001';
  end if;
  insert into public.avis as a (compte_id, jeu, marche, fiche, fiche_quoi, retourne, mot, mot_etat, langue)
    values (auth.uid(), p_jeu, p_marche, p_fiche, q, p_retourne, m, case when m is null then null else 'a-relire' end,
            case when p_langue = 'en' then 'en' else 'fr' end)
  on conflict (compte_id, jeu) do update set
    marche = excluded.marche, fiche = excluded.fiche, fiche_quoi = excluded.fiche_quoi, retourne = excluded.retourne,
    langue = excluded.langue, mot = excluded.mot,
    -- Le même mot garde sa relecture ; un mot changé repart à relire ; plus de mot, plus d'état.
    mot_etat = case when excluded.mot is null then null when excluded.mot = a.mot then a.mot_etat else 'a-relire' end,
    mot_relu_le = case when excluded.mot is not null and excluded.mot = a.mot then a.mot_relu_le end,
    maj_le = now();
end $$;

-- ---------- Ce que voient les familles ----------
-- Des totaux par réponse, à partir de 5 avis ; en dessous, rien (null), pas même le nombre.
-- Les mots acceptés dans la langue demandée, trois au plus, sans nom ni date.
create function public.avis_publics(p_jeu text, p_langue text default 'fr') returns jsonb
language sql stable security definer set search_path = '' as $$
  with a as (select * from public.avis where jeu = p_jeu)
  select case when (select count(*) from a) < 5 then null else jsonb_build_object(
    'total', (select count(*) from a),
    'marche', (select jsonb_object_agg(marche, n) from (select marche, count(*) as n from a group by marche) x),
    'fiche', (select jsonb_object_agg(fiche, n) from (select fiche, count(*) as n from a group by fiche) x),
    'retourne', (select jsonb_object_agg(retourne, n) from (select retourne, count(*) as n from a group by retourne) x),
    'mots', coalesce((select jsonb_agg(mot) from (
      select mot from a where mot_etat = 'accepte' and langue = case when p_langue = 'en' then 'en' else 'fr' end
      order by mot_relu_le desc nulls last limit 3) x), '[]'::jsonb)
  ) end
$$;

-- ---------- Le bureau ----------
-- Tous les avis, sans adresse e-mail : le mot à relire d'abord.
create function public.bureau_avis(p_limite int default 200, p_decalage int default 0)
returns table (compte_id uuid, jeu text, marche text, fiche text, fiche_quoi text, retourne text, mot text, mot_etat text,
               mot_relu_le timestamptz, langue text, cree_le timestamptz, maj_le timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return query
    select a.compte_id, a.jeu, a.marche, a.fiche, a.fiche_quoi, a.retourne, a.mot, a.mot_etat, a.mot_relu_le, a.langue, a.cree_le, a.maj_le
    from public.avis a
    order by (a.mot_etat = 'a-relire') desc nulls last, a.maj_le desc
    limit least(p_limite, 1000) offset p_decalage;
end $$;

-- Accepter ou refuser un mot. p_mot est le texte que Julien a lu : si le parent l'a changé entre-temps, rien ne change (false).
create function public.bureau_relire_mot(p_compte uuid, p_jeu text, p_mot text, p_accepte boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  perform public.exiger_admin();
  update public.avis set mot_etat = case when p_accepte then 'accepte' else 'refuse' end, mot_relu_le = now()
    where compte_id = p_compte and jeu = p_jeu and mot is not null and mot = p_mot;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- ---------- Qui peut appeler quoi ----------
revoke all on function public.donner_avis(text, text, text, text, text, text, text), public.avis_publics(text, text),
  public.bureau_avis(int, int), public.bureau_relire_mot(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.avis_publics(text, text) to anon, authenticated;
grant execute on function public.donner_avis(text, text, text, text, text, text, text),
  public.bureau_avis(int, int), public.bureau_relire_mot(uuid, text, text, boolean) to authenticated;
