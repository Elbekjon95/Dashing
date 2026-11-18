-- Joriy sutka (UTC kuni, `planned` bo'yicha) tahlili — rahbariyatning Grafana dashboardi bilan bir xil formulalar:
--   rej  = jami reja (bekor qilinmagan, o'chirilmagan), bek = bekor qilingan, baj = amalda bajarilgan (factual <= hozir)
--   pax  = LDM bo'yicha yo'lovchilar (birinchi + biznes + ekonom); ad/ch/in = katta/bola/chaqaloq
--   yuk  = yuk + pochta (kg), kech = kechikish kodi (delaytl) qo'yilgan reyslar
--   davlat/ak/yon = uchish (dep) va qo'nish (arr) bo'yicha eng ko'pi 10 tadan. Yo'nalishlarda TAS (asosiy aeroport) chiqarilgan, davlatlarda O'zbekiston chiqarilgan.
WITH p AS (SELECT (now() AT TIME ZONE 'UTC') AS hozir, (now() AT TIME ZONE 'UTC')::date AS bugun),
g AS (
  SELECT fl.trans_type AS tt, fl.base_airport AS ap, fl.airport AS bosh, nullif(trim(fl.aircompany), '') AS ak,
         fl.direction_type AS dt, fl.factual, coalesce(fl.is_canceled, 0) = 1 AS bekor,
         nullif(trim(coalesce(fl.delaytl::text, '')), '') AS kech_kod,
         coalesce(ps.ldm_pax_f, 0) AS pf, coalesce(ps.ldm_pax_c, 0) AS pc, coalesce(ps.ldm_pax_y, 0) AS py,
         coalesce(ps.ldm_pax_ad, 0) AS ad, coalesce(ps.ldm_pax_ch, 0) AS ch, coalesce(ps.ldm_pax_in, 0) AS inf,
         coalesce(ps.wgt_cargo, 0) + coalesce(ps.wgt_mail, 0) AS yuk,
         (SELECT a.country_name FROM airports a WHERE a.code = fl.airport LIMIT 1) AS davlat
    FROM flights fl
    CROSS JOIN p
    LEFT JOIN passengers ps ON ps.flight_id = fl.id
   WHERE fl.base_airport IN ('TAS','SKD','UGC','BHK','NMA','FEG','NVI','TMJ','NCU','KSQ','AZN','TVT','SRS','COH','OQN','MOK','OMN','AFS','CHI','RBZ','IYO')
     AND coalesce(fl.is_removed, 0) = 0
     AND fl.trans_type IN (1, 2)
     AND fl.planned >= p.bugun AND fl.planned < p.bugun + 1
),
m AS (
  SELECT g.tt,
         count(*) FILTER (WHERE NOT bekor)                                                       AS rej,
         count(*) FILTER (WHERE bekor)                                                           AS bek,
         count(*) FILTER (WHERE NOT bekor AND factual IS NOT NULL AND factual <= p.hozir)        AS baj,
         count(*) FILTER (WHERE NOT bekor AND kech_kod IS NOT NULL)                              AS kech,
         coalesce(sum(pf + pc + py) FILTER (WHERE NOT bekor), 0)                                 AS pax,
         coalesce(sum(pf) FILTER (WHERE NOT bekor), 0)                                           AS pf,
         coalesce(sum(pc) FILTER (WHERE NOT bekor), 0)                                           AS pc,
         coalesce(sum(py) FILTER (WHERE NOT bekor), 0)                                           AS py,
         coalesce(sum(ad) FILTER (WHERE NOT bekor), 0)                                           AS ad,
         coalesce(sum(ch) FILTER (WHERE NOT bekor), 0)                                           AS ch,
         coalesce(sum(inf) FILTER (WHERE NOT bekor), 0)                                          AS inf,
         coalesce(sum(yuk) FILTER (WHERE NOT bekor), 0)                                          AS yuk,
         count(*) FILTER (WHERE NOT bekor AND dt = 'VVL')                                        AS vvl,
         count(*) FILTER (WHERE NOT bekor AND coalesce(dt, '-') <> 'VVL')                        AS xal
    FROM g CROSS JOIN p GROUP BY g.tt
)
SELECT json_build_object(
  'bugun', to_char(p.bugun, 'YYYY-MM-DD'),
  'hozir', to_char(p.hozir, 'HH24:MI'),
  'dep', (SELECT row_to_json(m) FROM m WHERE m.tt = 1),
  'arr', (SELECT row_to_json(m) FROM m WHERE m.tt = 2),
  'davlat', json_build_object(
    'dep', (SELECT coalesce(json_agg(r), '[]'::json) FROM (SELECT davlat AS k, count(*) AS n FROM g WHERE tt = 1 AND NOT bekor AND davlat IS NOT NULL AND davlat <> 'Республика Узбекистан' GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10) r),
    'arr', (SELECT coalesce(json_agg(r), '[]'::json) FROM (SELECT davlat AS k, count(*) AS n FROM g WHERE tt = 2 AND NOT bekor AND davlat IS NOT NULL AND davlat <> 'Республика Узбекистан' GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10) r)),
  'ak', json_build_object(
    'dep', (SELECT coalesce(json_agg(r), '[]'::json) FROM (SELECT ak AS k, count(*) AS n FROM g WHERE tt = 1 AND NOT bekor AND ak IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10) r),
    'arr', (SELECT coalesce(json_agg(r), '[]'::json) FROM (SELECT ak AS k, count(*) AS n FROM g WHERE tt = 2 AND NOT bekor AND ak IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10) r)),
  'yon', json_build_object(
    'dep', (SELECT coalesce(json_agg(r), '[]'::json) FROM (SELECT bosh AS k, count(*) AS n FROM g WHERE tt = 1 AND NOT bekor AND bosh IS NOT NULL AND bosh <> 'TAS' GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10) r),
    'arr', (SELECT coalesce(json_agg(r), '[]'::json) FROM (SELECT bosh AS k, count(*) AS n FROM g WHERE tt = 2 AND NOT bekor AND bosh IS NOT NULL AND bosh <> 'TAS' GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10) r))
) FROM p
