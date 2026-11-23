-- Les avis de parents, refaits (Julien, 2026-11-18, décision 9) : une note de 1 à 5 étoiles et « Le jeu marche bien chez vous ? ».
-- Retirées : « La fiche dit vrai ? » (avec « Dites quoi ») et « Votre enfant y retourne de lui-même ? ».
-- « Le jeu marche bien » sert à mettre à part une mauvaise note due à un bug (« une étoile, le jeu crashe chez moi ») :
-- le public lit aussi la moyenne chez ceux pour qui le jeu marche bien.
-- La table était vide en ligne quand cette migration a été écrite : la colonne `etoiles` est obligatoire, sans valeur par défaut.
-- S'il y avait déjà des avis, cette migration échoue au lieu d'inventer une note.
-- Le reste ne change pas : un avis par compte et par jeu, le mot libre lu par Julien avant d'être montré (bureau_relire_mot),
-- rien de public sous 5 avis, le bureau sans adresse e-mail.

-- ---------- Les anciennes fonctions (leur signature ou leur résultat change) ----------
drop function public.donner_avis(text, text, text, text, text, text, text);
drop function public.avis_publics(text, text);
drop function public.bureau_avis(int, int);

-- ---------- La table ----------
-- Supprimer une colonne supprime aussi ses contraintes (dont celle qui liait fiche_quoi à fiche).
alter table public.avis drop column fiche_quoi, drop column fiche, drop column retourne;
alter table public.avis add column etoiles smallint not null check (etoiles between 1 and 5);

-- ---------- Donner ou changer son avis ----------
create function public.donner_avis(
  p_jeu text, p_etoiles int, p_marche text, p_mot text default null, p_langue text default 'fr'
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m text := nullif(btrim(p_mot), '');
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
  insert into public.avis as a (compte_id, jeu, etoiles, marche, mot, mot_etat, langue)
    values (auth.uid(), p_jeu, p_etoiles, p_marche, m, case when m is null then null else 'a-relire' end,
            case when p_langue = 'en' then 'en' else 'fr' end)
  on conflict (compte_id, jeu) do update set
    etoiles = excluded.etoiles, marche = excluded.marche, langue = excluded.langue, mot = excluded.mot,
    -- Le même mot garde sa relecture ; un mot changé repart à relire ; plus de mot, plus d'état.
    mot_etat = case when excluded.mot is null then null when excluded.mot = a.mot then a.mot_etat else 'a-relire' end,
    mot_relu_le = case when excluded.mot is not null and excluded.mot = a.mot then a.mot_relu_le end,
    maj_le = now();
end $$;

-- ---------- Ce que voient les familles ----------
-- À partir de 5 avis : le nombre, la répartition des étoiles, la moyenne (un chiffre après la virgule), la répartition de
-- « marche », et la moyenne chez ceux pour qui le jeu marche bien (null si personne). En dessous : rien (null), pas même le nombre.
-- Les mots acceptés dans la langue demandée, trois au plus, sans nom ni date.
create function public.avis_publics(p_jeu text, p_langue text default 'fr') returns jsonb
language sql stable security definer set search_path = '' as $$
  with a as (select * from public.avis where jeu = p_jeu)
  select case when (select count(*) from a) < 5 then null else jsonb_build_object(
    'total', (select count(*) from a),
    'etoiles', (select jsonb_object_agg(etoiles::text, n) from (select etoiles, count(*) as n from a group by etoiles) x),
    'moyenne', (select round(avg(etoiles), 1) from a),
    'marche', (select jsonb_object_agg(marche, n) from (select marche, count(*) as n from a group by marche) x),
    'moyenne_marche_bien', (select round(avg(etoiles), 1) from a where marche = 'oui'),
    'mots', coalesce((select jsonb_agg(mot) from (
      select mot from a where mot_etat = 'accepte' and langue = case when p_langue = 'en' then 'en' else 'fr' end
      order by mot_relu_le desc nulls last limit 3) x), '[]'::jsonb)
  ) end
$$;

-- ---------- Le bureau ----------
-- Tous les avis, sans adresse e-mail : le mot à relire d'abord.
create function public.bureau_avis(p_limite int default 200, p_decalage int default 0)
returns table (compte_id uuid, jeu text, etoiles smallint, marche text, mot text, mot_etat text,
               mot_relu_le timestamptz, langue text, cree_le timestamptz, maj_le timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.exiger_admin();
  return query
    select a.compte_id, a.jeu, a.etoiles, a.marche, a.mot, a.mot_etat, a.mot_relu_le, a.langue, a.cree_le, a.maj_le
    from public.avis a
    order by (a.mot_etat = 'a-relire') desc nulls last, a.maj_le desc
    limit least(p_limite, 1000) offset p_decalage;
end $$;

-- ---------- Qui peut appeler quoi (comme avant) ----------
revoke all on function public.donner_avis(text, int, text, text, text), public.avis_publics(text, text),
  public.bureau_avis(int, int) from public, anon, authenticated;
grant execute on function public.avis_publics(text, text) to anon, authenticated;
grant execute on function public.donner_avis(text, int, text, text, text), public.bureau_avis(int, int) to authenticated;
