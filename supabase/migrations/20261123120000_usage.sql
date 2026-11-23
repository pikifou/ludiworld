-- Les statistiques d'usage de l'appli (décision de Julien du 2026-11-23, factory : chantier statistiques-usage).
-- Ce que les familles font dans l'appli, pour comprendre l'usage et améliorer le contenu : jeux lancés, temps joué,
-- écran de fin, activité ouverte, jeux installés... Toutes les familles, avec ou sans compte ; le parent peut refuser.
-- Règles :
--   * sans nom : un numéro d'appareil tiré au hasard (renouvelé au plus tous les 13 mois, jamais lié au compte),
--     une tranche d'âge, le type d'appareil, la langue, la version de l'appli. Jamais le prénom, le compte, l'adresse,
--     ni ce que l'enfant fait à l'intérieur d'un jeu ;
--   * les appareils écrivent seulement (noter_usage), par lots ; personne ne relit la table, sauf le bureau, en totaux ;
--   * gardé 25 mois au plus : le plus ancien part au fil des envois.

create table public.usage_evenements (
  id bigint generated always as identity primary key,
  recu_le timestamptz not null default now(),
  jour date not null,
  appareil uuid not null,
  evt text not null check (evt ~ '^[a-z_]{1,40}$'),
  jeu text check (jeu ~ '^[a-z0-9-]{1,60}$'),
  age text check (age in ('4-5', '6-7', '8-10', '11-12')),
  format text check (format in ('telephone', 'tablette', 'ordi')),
  langue text check (langue in ('fr', 'en')),
  version text check (char_length(version) <= 30),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and pg_column_size(details) < 600)
);
create index usage_jour on public.usage_evenements (jour);
create index usage_evt_jour on public.usage_evenements (evt, jour);

-- ---------- Droits d'accès : rien par défaut ----------
alter table public.usage_evenements enable row level security;
revoke all on public.usage_evenements from anon, authenticated;

-- ---------- Noter un lot d'événements (appelé sans compte : le lot n'est jamais rattaché à un compte) ----------
-- Un événement mal formé est ignoré, pas le lot entier. Rend le nombre d'événements gardés.
create function public.noter_usage(p_evts jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if jsonb_typeof(p_evts) <> 'array' or jsonb_array_length(p_evts) > 200 then
    raise exception 'lot refuse' using errcode = '22023';
  end if;
  -- Garde-fou : un envoi en rafale (quelqu'un qui écrit en boucle) ne remplit pas la base.
  if (select count(*) from public.usage_evenements where recu_le > now() - interval '10 minutes') > 50000 then
    raise exception 'trop d''evenements' using errcode = 'P0001';
  end if;
  insert into public.usage_evenements (jour, appareil, evt, jeu, age, format, langue, version, details)
  select (e ->> 'jour')::date, (e ->> 'appareil')::uuid, e ->> 'evt',
         nullif(e ->> 'jeu', ''), nullif(e ->> 'age', ''), nullif(e ->> 'format', ''), nullif(e ->> 'langue', ''),
         left(e ->> 'version', 30), coalesce(e -> 'details', '{}'::jsonb)
  from jsonb_array_elements(p_evts) e
  where jsonb_typeof(e) = 'object'
    and coalesce(e ->> 'jour', '') ~ '^\d{4}-\d{2}-\d{2}$'
    and (e ->> 'jour')::date between current_date - 60 and current_date + 1
    and coalesce(e ->> 'appareil', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and coalesce(e ->> 'evt', '') ~ '^[a-z_]{1,40}$'
    and (e ->> 'jeu' is null or e ->> 'jeu' ~ '^[a-z0-9-]{1,60}$')
    and (e ->> 'age' is null or e ->> 'age' in ('4-5', '6-7', '8-10', '11-12'))
    and (e ->> 'format' is null or e ->> 'format' in ('telephone', 'tablette', 'ordi'))
    and (e ->> 'langue' is null or e ->> 'langue' in ('fr', 'en'))
    and (e -> 'details' is null or (jsonb_typeof(e -> 'details') = 'object' and pg_column_size(e -> 'details') < 600));
  get diagnostics n = row_count;
  -- 25 mois au plus. Fait de temps en temps, au fil des envois (un envoi sur cent).
  if random() < 0.01 then
    delete from public.usage_evenements where jour < (current_date - interval '25 months')::date;
  end if;
  return n;
end $$;

-- Les minutes d'une partie, lues prudemment : n'importe qui peut écrire ici, une valeur étrange compte pour rien,
-- et une partie compte au plus 600 minutes.
create function public.usage_minutes(d jsonb) returns numeric
language sql immutable set search_path = '' as $f$
  select case when d ->> 'minutes' ~ '^\d{1,6}(\.\d{1,3})?$' then least((d ->> 'minutes')::numeric, 600) else 0 end
$f$;

-- ---------- Le bureau : des totaux, jamais les lignes ----------
-- p_jours : la période regardée (7 à 750 jours).
create function public.bureau_usage(p_jours int default 90) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  depuis date := current_date - greatest(7, least(coalesce(p_jours, 90), 750));
  r jsonb;
begin
  perform public.exiger_admin();
  with u as (select * from public.usage_evenements where jour >= depuis)
  select jsonb_build_object(
    'depuis', depuis,
    'evenements', (select count(*) from u),
    'appareils', (select count(distinct appareil) from u),
    -- revenus : vus au moins deux jours différents dans la période
    'revenus', (select count(*) from (select appareil from u group by appareil having count(distinct jour) >= 2) x),
    'semaines', coalesce((select jsonb_agg(s order by s ->> 'semaine') from (
      select jsonb_build_object('semaine', to_char(date_trunc('week', jour), 'YYYY-MM-DD'),
        'appareils', count(distinct appareil),
        'lancements', count(*) filter (where evt = 'jeu_lance'),
        'minutes', coalesce(sum(public.usage_minutes(details)) filter (where evt = 'jeu_fini'), 0)) as s
      from u group by date_trunc('week', jour)) t), '[]'::jsonb),
    'jeux', coalesce((select jsonb_agg(j order by (j ->> 'lancements')::int desc) from (
      select jsonb_build_object('jeu', jeu,
        'lancements', count(*) filter (where evt = 'jeu_lance'),
        'appareils', count(distinct appareil) filter (where evt = 'jeu_lance'),
        'minutes', coalesce(sum(public.usage_minutes(details)) filter (where evt = 'jeu_fini'), 0),
        'parties', count(*) filter (where evt = 'jeu_fini'),
        'installes', count(*) filter (where evt = 'jeu_installe'),
        'retires', count(*) filter (where evt = 'jeu_retire'),
        'ranges', count(*) filter (where evt = 'jeu_range'),
        'demandes', count(*) filter (where evt = 'jeu_demande'),
        'fiches', count(*) filter (where evt = 'fiche_ouverte'),
        'idees', count(*) filter (where evt = 'idee_montree'),
        'activites', count(*) filter (where evt = 'activite_ouverte'),
        'activites_appareils', count(distinct appareil) filter (where evt = 'activite_ouverte'),
        'activites_finies', count(*) filter (where evt = 'activite_fermee' and details ->> 'finie' = 'true'),
        'etapes', coalesce((select jsonb_object_agg(e, n) from (
          select details ->> 'etape' as e, count(*) as n from u u2
          where u2.jeu = u.jeu and u2.evt = 'activite_fermee' group by details ->> 'etape') x), '{}'::jsonb)
      ) as j
      from u where jeu is not null group by jeu) t), '[]'::jsonb),
    'fins', coalesce((select jsonb_object_agg(k, n) from (
      select coalesce(details ->> 'raison', '?') as k, count(*) as n from u where evt = 'jeu_fini' group by 1) x), '{}'::jsonb),
    'repartition', jsonb_build_object(
      'age', coalesce((select jsonb_object_agg(coalesce(age, '?'), n) from (select age, count(distinct appareil) n from u group by age) x), '{}'::jsonb),
      'format', coalesce((select jsonb_object_agg(coalesce(format, '?'), n) from (select format, count(distinct appareil) n from u group by format) x), '{}'::jsonb),
      'langue', coalesce((select jsonb_object_agg(coalesce(langue, '?'), n) from (select langue, count(distinct appareil) n from u group by langue) x), '{}'::jsonb)
    ),
    'vues', coalesce((select jsonb_object_agg(c, n) from (
      select coalesce(details ->> 'cote', '?') as c, count(*) as n from u where evt = 'vue' group by 1) x), '{}'::jsonb)
  ) into r;
  return r;
end $$;

-- ---------- Qui peut appeler quoi ----------
revoke all on function public.noter_usage(jsonb), public.bureau_usage(int), public.usage_minutes(jsonb) from public, anon, authenticated;
grant execute on function public.noter_usage(jsonb) to anon, authenticated;
grant execute on function public.bureau_usage(int) to authenticated;
