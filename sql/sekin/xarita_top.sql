-- O'zbekiston xaritasi uchun: har oy x har aeroport bo'yicha aviakompaniyalar (t='ak') va yo'nalishlar (t='r'), eng kattasi 25 tadan
-- oy = 'YYYY-MM'; o'tgan oy uchun qo'shimcha 'YYYY-MM~' qatorlari - bugungi kun raqamigacha kesilgan (joriy oy bilan teng solishtirish uchun)
-- f=reyslar, p=yo'lovchilar, c=yuk+pochta kg, u=yoqilg'i kg
WITH p AS (SELECT (now() AT TIME ZONE 'UTC') AS hozir,
                  (now() AT TIME ZONE 'UTC')::date AS bugun,
                  date_trunc('month', now() AT TIME ZONE 'UTC')::date AS oy0),
f AS (
  SELECT DISTINCT ON (fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type)
         fl.id, fl.base_airport AS ap, fl.trans_type AS tt,
         coalesce(nullif(trim(fl.aircompany), ''), '-') AS ak, coalesce(nullif(trim(fl.airport), ''), '-') AS bosh,
         fl.planned AS sch,
         fl.factual AS fct,
         coalesce(fl.is_canceled, 0) = 1 AS bekor
    FROM flights fl, p
   WHERE fl.base_airport IN ('TAS','SKD','UGC','BHK','NMA','FEG','NVI','TMJ','NCU','KSQ','AZN','SRS','COH','OQN','MOK','OMN','AFS','RBZ','IYO')
     AND coalesce(fl.is_removed, 0) = 0
     AND upper(coalesce(trim(fl.service_type), '')) <> 'W' -- harbiy reyslar hisobga olinmaydi
     AND fl.planned >= (p.oy0 - interval '13 months')
     AND fl.planned <  (p.bugun + 1)
   ORDER BY fl.aircompany, fl.number, fl.planned, fl.base_airport, fl.airport, fl.trans_type, fl.updated_at DESC NULLS LAST, fl.id DESC
),
g AS (
  SELECT f.sch::date AS kun, f.ap, f.ak, f.bosh,
         coalesce(ps.ldm_pax_ad,0) + coalesce(ps.ldm_pax_ch,0) AS pax,
         coalesce(ps.wgt_cargo, 0) + coalesce(ps.wgt_mail, 0) AS cm,
         CASE WHEN f.tt = 1 THEN coalesce(ps.total_fuel, 0) ELSE 0 END AS yoq,
         (f.sch::date >= (p.oy0 - interval '1 month')::date AND f.sch::date < p.oy0
            AND extract(day FROM f.sch) <= extract(day FROM p.bugun)) AS kesim
    FROM f CROSS JOIN p
    LEFT JOIN passengers ps ON ps.flight_id = f.id
   WHERE NOT f.bekor AND f.fct IS NOT NULL AND f.fct <= p.hozir
),
x AS (
  SELECT to_char(kun, 'YYYY-MM') AS oy, ap, 'ak' AS t, ak AS k, pax, cm, yoq FROM g
  UNION ALL SELECT to_char(kun, 'YYYY-MM'), ap, 'r', bosh, pax, cm, yoq FROM g
  UNION ALL SELECT to_char(kun, 'YYYY-MM') || '~', ap, 'ak', ak, pax, cm, yoq FROM g WHERE kesim
  UNION ALL SELECT to_char(kun, 'YYYY-MM') || '~', ap, 'r', bosh, pax, cm, yoq FROM g WHERE kesim
),
a AS (
  SELECT oy, ap, t, k, count(*) AS f, sum(pax) AS p, sum(cm) AS c, sum(yoq) AS u,
         row_number() OVER (PARTITION BY oy, ap, t ORDER BY count(*) DESC, k) AS rn
    FROM x
   GROUP BY oy, ap, t, k
)
SELECT json_build_object(
  'cols', json_build_array('oy','ap','t','k','f','p','c','u'),
  'rows', coalesce(json_agg(json_build_array(oy, ap, t, k, f, p, c, u) ORDER BY oy, ap, t, f DESC), '[]'::json))
  FROM a
 WHERE rn <= 25
