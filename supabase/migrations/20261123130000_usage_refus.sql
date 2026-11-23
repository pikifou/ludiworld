-- Compter ceux qui refusent les statistiques (décision de Julien du 2026-11-23), pour savoir si l'échantillon est représentatif.
-- Quand un parent décoche la case, l'appli envoie une seule fois « statistiques_refusees » (« statistiques_reprises » s'il
-- recoche), avec un numéro neuf tiré pour ce seul fait, la tranche d'âge et le type d'appareil. Le bureau les compte à part :
-- ils n'entrent ni dans les appareils ni dans les autres totaux.

create or replace function public.bureau_usage(p_jours int default 90) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  depuis date := current_date - greatest(7, least(coalesce(p_jours, 90), 750));
  r jsonb;
begin
  perform public.exiger_admin();
  with
    -- les choix des parents (« refusé », « accepté de nouveau ») portent un numéro neuf chacun : comptés à part
    tout as (select * from public.usage_evenements where jour >= depuis),
    u as (select * from tout where evt not in ('statistiques_refusees', 'statistiques_reprises')),
    ch as (select * from tout where evt in ('statistiques_refusees', 'statistiques_reprises'))
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
    'choix', jsonb_build_object(
      'refus', (select count(*) from ch where evt = 'statistiques_refusees'),
      'reprises', (select count(*) from ch where evt = 'statistiques_reprises'),
      'age', coalesce((select jsonb_object_agg(coalesce(age, '?'), n) from (select age, count(*) n from ch where evt = 'statistiques_refusees' group by age) x), '{}'::jsonb),
      'format', coalesce((select jsonb_object_agg(coalesce(format, '?'), n) from (select format, count(*) n from ch where evt = 'statistiques_refusees' group by format) x), '{}'::jsonb)
    ),
    'vues', coalesce((select jsonb_object_agg(c, n) from (
      select coalesce(details ->> 'cote', '?') as c, count(*) as n from u where evt = 'vue' group by 1) x), '{}'::jsonb)
  ) into r;
  return r;
end $$;

revoke all on function public.bureau_usage(int) from public, anon, authenticated;
grant execute on function public.bureau_usage(int) to authenticated;
