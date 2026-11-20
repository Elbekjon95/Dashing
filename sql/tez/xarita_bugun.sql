-- O'zbekiston xaritasi uchun: FAQAT BUGUNGI kun (tez yangilanadi, 5 daqiqa); tarix — sekin/xarita_kun.sql. Har aeroport bo'yicha
-- f=bajarilgan reyslar, b=bekor, pa/pd=yo'lovchi (qo'nish/uchish), c=yuk kg, m=pochta kg, g=bagaj kg, u=yoqilg'i kg (uchishda),
-- wl=yuklash kartasi bor reyslar, ms=o'lchangan uchishlar, ot=o'z vaqtida, dl=kechikkan, dm=kechikish daqiqalari,
-- df/dp/dc/du = ichki reyslar (VVL) bo'yicha reys/yo'lovchi/yuk+pochta/yoqilg'i
WITH p AS (SELECT (now() AT TIME ZONE 'UTC') AS hozir,
                  (now() AT TIME ZONE 'UTC')::date AS bosh),
f AS (
  SELECT DISTINCT ON (fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type)
         fl.id, fl.base_airport AS ap, fl.trans_type AS tt, coalesce(fl.direction_type, '-') = 'VVL' AS ichki,
         fl.planned AS sch,
         fl.factual AS fct,
         coalesce(fl.is_canceled, 0) = 1 AS bekor
    FROM flights fl, p
   WHERE fl.base_airport IN ('TAS','SKD','UGC','BHK','NMA','FEG','NVI','TMJ','NCU','KSQ','AZN','SRS','COH','OQN','MOK','OMN','AFS','RBZ','IYO','CHI','TVT')
     AND coalesce(fl.is_removed, 0) = 0
     AND upper(coalesce(trim(fl.service_type), '')) <> 'W' -- harbiy reyslar hisobga olinmaydi
     AND fl.planned >= p.bosh
     AND fl.planned <  (p.hozir::date + 1)
   ORDER BY fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type, fl.updated_at DESC NULLS LAST, fl.id DESC
),
g AS (
  SELECT f.sch::date AS kun, f.ap, f.tt, f.ichki, f.bekor,
         (NOT f.bekor AND f.fct IS NOT NULL AND f.fct <= p.hozir) AS ok,
         extract(epoch FROM f.fct - f.sch) / 60 AS kech,
         coalesce(ps.ldm_pax_ad,0) + coalesce(ps.ldm_pax_ch,0) AS pax,
         coalesce(ps.wgt_cargo, 0) AS yuk, coalesce(ps.wgt_mail, 0) AS poc, coalesce(ps.wgt_baggage, 0) AS bag,
         CASE WHEN f.tt = 1 THEN coalesce(ps.total_fuel, 0) ELSE 0 END AS yoq,
         ps.flight_id IS NOT NULL AS wl
    FROM f CROSS JOIN p
    LEFT JOIN passengers ps ON ps.flight_id = f.id
)
SELECT json_build_object(
  'cols', json_build_array('kun','ap','f','b','pa','pd','c','m','g','u','wl','ms','ot','dl','dm','df','dp','dc','du'),
  'rows', coalesce(json_agg(json_build_array(t.kun, t.ap, t.f, t.b, t.pa, t.pd, t.c, t.m, t.g, t.u, t.wl, t.ms, t.ot, t.dl, t.dm, t.df, t.dp, t.dc, t.du) ORDER BY t.kun, t.ap), '[]'::json))
  FROM (
    SELECT to_char(kun, 'YYYY-MM-DD') AS kun, ap,
           count(*) FILTER (WHERE ok)                                   AS f,
           count(*) FILTER (WHERE bekor)                                AS b,
           coalesce(sum(pax) FILTER (WHERE ok AND tt = 2), 0)           AS pa,
           coalesce(sum(pax) FILTER (WHERE ok AND tt = 1), 0)           AS pd,
           coalesce(sum(yuk) FILTER (WHERE ok), 0)                      AS c,
           coalesce(sum(poc) FILTER (WHERE ok), 0)                      AS m,
           coalesce(sum(bag) FILTER (WHERE ok), 0)                      AS g,
           coalesce(sum(yoq) FILTER (WHERE ok), 0)                      AS u,
           count(*) FILTER (WHERE ok AND wl)                            AS wl,
           count(*) FILTER (WHERE ok AND tt = 1)                        AS ms,
           count(*) FILTER (WHERE ok AND tt = 1 AND kech <= 15)         AS ot,
           count(*) FILTER (WHERE ok AND tt = 1 AND kech > 15)          AS dl,
           coalesce(round(sum(kech) FILTER (WHERE ok AND tt = 1 AND kech > 15 AND kech < 1440)), 0) AS dm,
           count(*) FILTER (WHERE ok AND ichki)                         AS df,
           coalesce(sum(pax) FILTER (WHERE ok AND ichki), 0)            AS dp,
           coalesce(sum(yuk + poc) FILTER (WHERE ok AND ichki), 0)      AS dc,
           coalesce(sum(yoq) FILTER (WHERE ok AND ichki), 0)            AS du
      FROM g
     GROUP BY kun, ap
  ) t
